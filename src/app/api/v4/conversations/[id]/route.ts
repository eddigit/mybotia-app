import { query } from "@/lib/v4/db";
import { apiError } from "@/lib/v4/errors";
import { resolveChatCockpit } from "@/lib/v4/session";
import { getDisplayName } from "@/lib/v4/tenant-registry";

// V1.1.G — Helper de mapping erreur cockpit → apiError code.
function cockpitErr(status: number, msg: string) {
  const code =
    status === 403 ? "forbidden" : status === 401 ? "unauthorized" : "validation_failed";
  return apiError(code, msg);
}

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cockpit = await resolveChatCockpit(_req);
  if (!cockpit.ok) return cockpitErr(cockpit.status, cockpit.error);
  const { session, tenantSlug, agentId } = cockpit;
  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError("not_found", "Conversation introuvable");

  // V1.1.G — Filtre tenant cockpit + agent cockpit (NULL toléré legacy).
  const { rows } = await query<ConvRow>(
    `SELECT * FROM chat.conversations
     WHERE id=$1 AND tenant_slug=$2 AND user_email=$3
       AND (agent_id = $4 OR agent_id IS NULL)
       AND archived_at IS NULL`,
    [id, tenantSlug, session.email, agentId]
  );
  if (rows.length === 0) return apiError("not_found", "Conversation introuvable");

  const r = rows[0];
  return Response.json({
    id: r.id,
    agentId: r.agent_id,
    agentName: getDisplayName(r.agent_id),
    folderId: r.folder_id,
    title: r.title,
    channel: r.channel,
    projectRef: r.project_ref,
    clientRef: r.client_ref,
    pinnedAt: r.pinned_at,
    lastMessageAt: r.last_message_at,
    messageCount: r.message_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}

// PATCH partielle : folderId / title / pinned / archived. Un champ par appel idéal.
// Folder : null = retirer du dossier, UUID = move (vérification ownership folder).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cockpit = await resolveChatCockpit(request);
  if (!cockpit.ok) return cockpitErr(cockpit.status, cockpit.error);
  const { session, tenantSlug, agentId } = cockpit;
  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError("not_found", "Conversation introuvable");

  // V1.1.G — Ownership scope cockpit (tenant + agent).
  const own = await query<{ id: string }>(
    `SELECT id FROM chat.conversations
     WHERE id=$1 AND tenant_slug=$2 AND user_email=$3
       AND (agent_id = $4 OR agent_id IS NULL)
       AND archived_at IS NULL`,
    [id, tenantSlug, session.email, agentId]
  );
  if (own.rowCount === 0) return apiError("not_found", "Conversation introuvable");

  let body: {
    folderId?: string | null;
    title?: string;
    pinned?: boolean;
    archived?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return apiError("validation_failed", "Body JSON invalide");
  }

  const sets: string[] = [];
  const params2: unknown[] = [];
  const push = (col: string, v: unknown) => {
    params2.push(v);
    sets.push(`${col} = $${params2.length}`);
  };

  if ("folderId" in body) {
    if (body.folderId === null) {
      push("folder_id", null);
    } else if (typeof body.folderId === "string") {
      if (!UUID_RE.test(body.folderId)) {
        return apiError("validation_failed", "folderId invalide");
      }
      // V1.1.G — folder ownership scope cockpit.
      const f = await query<{ id: string }>(
        `SELECT id FROM chat.folders
         WHERE id=$1 AND tenant_slug=$2 AND user_email=$3 AND archived_at IS NULL`,
        [body.folderId, tenantSlug, session.email]
      );
      if (f.rowCount === 0) {
        return apiError("not_found", "Dossier introuvable ou non autorisé", {
          field: "folderId",
        });
      }
      push("folder_id", body.folderId);
    }
  }
  if (typeof body.title === "string") {
    const t = body.title.trim().slice(0, 200);
    if (!t) return apiError("validation_failed", "title vide");
    push("title", t);
  }
  if (typeof body.pinned === "boolean") {
    push("pinned_at", body.pinned ? new Date().toISOString() : null);
  }
  if (typeof body.archived === "boolean") {
    push("archived_at", body.archived ? new Date().toISOString() : null);
  }

  if (sets.length === 0) {
    return apiError("validation_failed", "Aucun champ à mettre à jour");
  }
  params2.push(id);
  const sql = `UPDATE chat.conversations SET ${sets.join(", ")}, updated_at=now()
               WHERE id = $${params2.length} RETURNING *`;
  const { rows } = await query<ConvRow>(sql, params2);
  const r = rows[0];

  return Response.json({
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
  });
}

// DELETE = suppression définitive. Les messages partent en cascade (FK ON DELETE CASCADE).
// Pour archiver (soft), passer par PATCH { archived: true }.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cockpit = await resolveChatCockpit(_request);
  if (!cockpit.ok) return cockpitErr(cockpit.status, cockpit.error);
  const { session, tenantSlug, agentId } = cockpit;
  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError("not_found", "Conversation introuvable");

  // V1.1.G — DELETE scope cockpit (tenant + agent + user).
  const { rowCount } = await query(
    `DELETE FROM chat.conversations
     WHERE id = $1 AND tenant_slug = $2 AND user_email = $3
       AND (agent_id = $4 OR agent_id IS NULL)`,
    [id, tenantSlug, session.email, agentId]
  );
  if (rowCount === 0) return apiError("not_found", "Conversation introuvable");
  return Response.json({ ok: true, id });
}
