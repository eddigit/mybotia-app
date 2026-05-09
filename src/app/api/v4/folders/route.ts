import { query } from "@/lib/v4/db";
import { apiError } from "@/lib/v4/errors";
import { resolveChatCockpit } from "@/lib/v4/session";

function cockpitErr(status: number, msg: string) {
  const code =
    status === 403 ? "forbidden" : status === 401 ? "unauthorized" : "validation_failed";
  return apiError(code, msg);
}

interface FolderRow {
  id: string;
  tenant_slug: string;
  user_email: string;
  name: string;
  description: string | null;
  agent_id: string | null;
  client_ref: string | null;
  project_ref: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

function toApi(r: FolderRow) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    agentId: r.agent_id,
    clientRef: r.client_ref,
    projectRef: r.project_ref,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function GET(request: Request) {
  // V1.1.G — Filtre cockpit (tenant) au lieu de tenant JWT.
  const cockpit = await resolveChatCockpit(request);
  if (!cockpit.ok) return cockpitErr(cockpit.status, cockpit.error);
  const { session, tenantSlug } = cockpit;
  const { rows } = await query<FolderRow>(
    `SELECT * FROM chat.folders
     WHERE tenant_slug=$1 AND user_email=$2 AND archived_at IS NULL
     ORDER BY updated_at DESC`,
    [tenantSlug, session.email]
  );
  return Response.json(rows.map(toApi));
}

export async function POST(request: Request) {
  // V1.1.G — Création scope cockpit.
  const cockpit = await resolveChatCockpit(request);
  if (!cockpit.ok) return cockpitErr(cockpit.status, cockpit.error);
  const { session, tenantSlug } = cockpit;

  let body: { name?: string; description?: string; agentId?: string; clientRef?: string; projectRef?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("validation_failed", "Body JSON invalide");
  }
  const name = (body.name ?? "").trim();
  if (!name) return apiError("validation_failed", "name requis", { field: "name" });
  if (name.length > 200) return apiError("validation_failed", "name trop long");

  try {
    const { rows } = await query<FolderRow>(
      `INSERT INTO chat.folders (tenant_slug, user_email, name, description, agent_id, client_ref, project_ref)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        tenantSlug,
        session.email,
        name,
        body.description ?? null,
        body.agentId ?? null,
        body.clientRef ?? null,
        body.projectRef ?? null,
      ]
    );
    return Response.json(toApi(rows[0]), { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("folders_unique_name")) {
      return apiError("conflict", `Dossier "${name}" déjà existant`, { field: "name" });
    }
    console.error("[v4/folders] POST error:", e);
    return apiError("validation_failed", "Erreur création dossier");
  }
}
