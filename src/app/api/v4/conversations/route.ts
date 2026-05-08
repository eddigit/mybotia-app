import { query } from "@/lib/v4/db";
import { apiError } from "@/lib/v4/errors";
import { getSessionV4 } from "@/lib/v4/session";
import {
  resolveAgentId,
  UnknownTenantError,
  getDisplayName,
} from "@/lib/v4/tenant-registry";

interface ConvRow {
  id: string;
  tenant_slug: string;
  user_email: string;
  agent_id: string;
  folder_id: string | null;
  title: string;
  channel: string;
  project_ref: string | null;
  client_ref: string | null;
  bridge_session_id: string | null;
  pinned_at: string | null;
  archived_at: string | null;
  last_message_at: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

function toApi(r: ConvRow) {
  return {
    id: r.id,
    agentId: r.agent_id,
    agentName: getDisplayName(r.agent_id),
    folderId: r.folder_id,
    title: r.title,
    channel: r.channel,
    projectRef: r.project_ref,
    clientRef: r.client_ref,
    pinnedAt: r.pinned_at,
    archivedAt: r.archived_at,
    lastMessageAt: r.last_message_at,
    messageCount: r.message_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function GET(request: Request) {
  const session = await getSessionV4();
  if (!session) return apiError("unauthorized", "Non authentifié");

  const url = new URL(request.url);
  const folderId = url.searchParams.get("folderId");
  const archived = url.searchParams.get("archived") === "true";

  const where: string[] = ["tenant_slug = $1", "user_email = $2"];
  const params: unknown[] = [session.tenantSlug, session.email];
  where.push(archived ? "archived_at IS NOT NULL" : "archived_at IS NULL");
  if (folderId) {
    params.push(folderId);
    where.push(`folder_id = $${params.length}`);
  }

  const { rows } = await query<ConvRow>(
    `SELECT * FROM chat.conversations WHERE ${where.join(" AND ")}
     ORDER BY last_message_at DESC NULLS LAST, created_at DESC LIMIT 200`,
    params
  );
  return Response.json(rows.map(toApi));
}

export async function POST(request: Request) {
  const session = await getSessionV4();
  if (!session) return apiError("unauthorized", "Non authentifié");

  let body: {
    agentId?: string;
    folderId?: string | null;
    projectRef?: string;
    clientRef?: string;
    title?: string;
  };
  try {
    body = await request.json();
  } catch {
    return apiError("validation_failed", "Body JSON invalide");
  }

  let agentId: string;
  try {
    agentId = resolveAgentId(session.tenantSlug, body.agentId, session.isSuperadmin);
  } catch (err) {
    if (err instanceof UnknownTenantError) {
      return apiError("tenant_unknown", `Tenant non configuré: ${err.tenantSlug}`);
    }
    const code = (err as Error & { code?: string }).code;
    if (code === "agent_unknown") return apiError("agent_unknown", (err as Error).message);
    if (code === "tenant_agent_mismatch") return apiError("tenant_agent_mismatch", (err as Error).message);
    return apiError("validation_failed", err instanceof Error ? err.message : "Agent invalide");
  }

  // Validation folder ownership si fourni
  if (body.folderId) {
    const f = await query<{ id: string }>(
      `SELECT id FROM chat.folders
       WHERE id=$1 AND tenant_slug=$2 AND user_email=$3 AND archived_at IS NULL`,
      [body.folderId, session.tenantSlug, session.email]
    );
    if (f.rowCount === 0) {
      return apiError("not_found", "Dossier introuvable ou non autorisé", { field: "folderId" });
    }
  }

  const title = (body.title ?? "").trim() || "Nouvelle conversation";
  const channel = body.projectRef ? "project" : "chat";

  const { rows } = await query<ConvRow>(
    `INSERT INTO chat.conversations
       (tenant_slug, user_email, agent_id, folder_id, title, channel, project_ref, client_ref)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [
      session.tenantSlug,
      session.email,
      agentId,
      body.folderId ?? null,
      title.slice(0, 200),
      channel,
      body.projectRef ?? null,
      body.clientRef ?? null,
    ]
  );

  return Response.json(toApi(rows[0]), { status: 201 });
}
