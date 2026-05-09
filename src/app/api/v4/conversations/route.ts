import { query } from "@/lib/v4/db";
import { apiError } from "@/lib/v4/errors";
import { resolveChatCockpit } from "@/lib/v4/session";
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
  // V1.1.G — Filtre cockpit (tenant + agent) au lieu de tenant JWT seul.
  const cockpit = await resolveChatCockpit(request);
  if (!cockpit.ok) {
    const code =
      cockpit.status === 403
        ? "forbidden"
        : cockpit.status === 401
          ? "unauthorized"
          : "validation_failed";
    return apiError(code, cockpit.error);
  }
  const { session, tenantSlug, agentId } = cockpit;

  const url = new URL(request.url);
  const folderId = url.searchParams.get("folderId");
  const archived = url.searchParams.get("archived") === "true";

  // Filtre obligatoire :
  //   tenant_slug = cockpit
  //   agent_id   = agent du cockpit OR NULL (legacy null toléré)
  //   user_email = session.email (isolation intra-tenant)
  const where: string[] = [
    "tenant_slug = $1",
    "user_email = $2",
    "(agent_id = $3 OR agent_id IS NULL)",
  ];
  const params: unknown[] = [tenantSlug, session.email, agentId];
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
  // V1.1.G — Création scope cockpit (pas tenant JWT). Sinon Gilles depuis
  // cockpit VLM créerait des conversations marquées tenant_slug=mybotia.
  const cockpit = await resolveChatCockpit(request);
  if (!cockpit.ok) {
    const code =
      cockpit.status === 403
        ? "forbidden"
        : cockpit.status === 401
          ? "unauthorized"
          : "validation_failed";
    return apiError(code, cockpit.error);
  }
  const { session, tenantSlug, agentId: cockpitAgentId } = cockpit;

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
    // L'agent attendu est celui du cockpit. Superadmin peut overrider via body
    // (debug), sinon refus si le body demande un autre agent.
    agentId = resolveAgentId(tenantSlug, body.agentId, session.isSuperadmin);
    // Sécurité supplémentaire : non-superadmin → on force agent du cockpit.
    if (!session.isSuperadmin) agentId = cockpitAgentId;
  } catch (err) {
    if (err instanceof UnknownTenantError) {
      return apiError("tenant_unknown", `Tenant non configuré: ${err.tenantSlug}`);
    }
    const code = (err as Error & { code?: string }).code;
    if (code === "agent_unknown") return apiError("agent_unknown", (err as Error).message);
    if (code === "tenant_agent_mismatch") return apiError("tenant_agent_mismatch", (err as Error).message);
    return apiError("validation_failed", err instanceof Error ? err.message : "Agent invalide");
  }

  // Validation folder ownership si fourni — scope cockpit + user.
  if (body.folderId) {
    const f = await query<{ id: string }>(
      `SELECT id FROM chat.folders
       WHERE id=$1 AND tenant_slug=$2 AND user_email=$3 AND archived_at IS NULL`,
      [body.folderId, tenantSlug, session.email]
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
      tenantSlug,
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
