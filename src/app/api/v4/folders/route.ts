import { query } from "@/lib/v4/db";
import { apiError } from "@/lib/v4/errors";
import { getSessionV4 } from "@/lib/v4/session";

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

export async function GET() {
  const session = await getSessionV4();
  if (!session) return apiError("unauthorized", "Non authentifié");
  const { rows } = await query<FolderRow>(
    `SELECT * FROM chat.folders
     WHERE tenant_slug=$1 AND user_email=$2 AND archived_at IS NULL
     ORDER BY updated_at DESC`,
    [session.tenantSlug, session.email]
  );
  return Response.json(rows.map(toApi));
}

export async function POST(request: Request) {
  const session = await getSessionV4();
  if (!session) return apiError("unauthorized", "Non authentifié");

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
        session.tenantSlug,
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
