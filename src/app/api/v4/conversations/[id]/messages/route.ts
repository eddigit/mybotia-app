import { query } from "@/lib/v4/db";
import { apiError } from "@/lib/v4/errors";
import { getSessionV4 } from "@/lib/v4/session";
import { bridgeChat, BridgeError } from "@/lib/v4/bridge";

interface MsgRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  tool_calls: unknown;
  attachments: unknown;
  sources: unknown;
  model_tier: string | null;
  pinned_at: string | null;
  created_at: string;
}

function toApi(m: MsgRow) {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    role: m.role,
    content: m.content,
    toolCalls: m.tool_calls,
    attachments: m.attachments,
    sources: m.sources,
    modelTier: m.model_tier,
    pinnedAt: m.pinned_at,
    createdAt: m.created_at,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadConversation(
  conversationId: string,
  tenantSlug: string,
  userEmail: string
): Promise<{
  archived: boolean;
  agentId: string;
  bridgeSessionId: string | null;
  channel: string | null;
  clientRef: string | null;
  projectRef: string | null;
} | null> {
  const { rows } = await query<{
    archived_at: string | null;
    agent_id: string;
    bridge_session_id: string | null;
    channel: string | null;
    client_ref: string | null;
    project_ref: string | null;
  }>(
    `SELECT archived_at, agent_id, bridge_session_id, channel, client_ref, project_ref
       FROM chat.conversations
     WHERE id=$1 AND tenant_slug=$2 AND user_email=$3`,
    [conversationId, tenantSlug, userEmail]
  );
  if (rows.length === 0) return null;
  return {
    archived: rows[0].archived_at !== null,
    agentId: rows[0].agent_id,
    bridgeSessionId: rows[0].bridge_session_id,
    channel: rows[0].channel,
    clientRef: rows[0].client_ref,
    projectRef: rows[0].project_ref,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionV4();
  if (!session) return apiError("unauthorized", "Non authentifié");
  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError("not_found", "Conversation introuvable");

  const conv = await loadConversation(id, session.tenantSlug, session.email);
  if (!conv) return apiError("not_found", "Conversation introuvable");

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

  const { rows } = await query<MsgRow>(
    `SELECT * FROM chat.messages WHERE conversation_id=$1
     ORDER BY created_at ASC LIMIT $2`,
    [id, limit]
  );
  return Response.json(rows.map(toApi));
}

// B4 — POST réel via bridge Claude prod (port 9400 /chat non-stream).
// Streaming SSE différé en B5+ (ou intégration AI SDK UI ultérieure).
// Règle dure : pas de création de conversation cachée — 404 si l'id n'existe pas.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionV4();
  if (!session) return apiError("unauthorized", "Non authentifié");
  const { id } = await params;
  if (!UUID_RE.test(id)) return apiError("not_found", "Conversation introuvable");

  const conv = await loadConversation(id, session.tenantSlug, session.email);
  if (!conv) return apiError("not_found", "Conversation introuvable");
  if (conv.archived) return apiError("conflict", "Conversation archivée");

  let body: { content?: string; modelTier?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("validation_failed", "Body JSON invalide");
  }
  const content = (body.content ?? "").trim();
  if (!content) return apiError("validation_failed", "content requis", { field: "content" });
  const modelTier: "fast" | "deep" = body.modelTier === "premium" ? "deep" : "fast";
  // Affichage client : "standard" / "premium" — masque le nom modèle (doctrine UB).
  const displayTier = modelTier === "deep" ? "premium" : "standard";

  // 1) Insert user message d'abord (audit même si bridge plante).
  const userInsert = await query<MsgRow>(
    `INSERT INTO chat.messages (conversation_id, role, content, model_tier)
     VALUES ($1,'user',$2,$3) RETURNING *`,
    [id, content, displayTier]
  );

  // 2) Appel bridge Claude prod /chat avec session_id existant si déjà peuplé.
  let bridgeResp;
  try {
    bridgeResp = await bridgeChat({
      message: content,
      agentId: conv.agentId,
      sessionId: conv.bridgeSessionId,
      modelTier,
      userContext: {
        name: session.email || "Utilisateur",
        email: session.email,
        role: session.role || "member",
        tenant_slug: session.tenantSlug,
        is_superadmin: session.isSuperadmin,
        // V1 garde-fou (Agent 4 — 2026-05-08) : Léa doit savoir de qui/quoi on
        // parle. On propage les refs de la conv (peuplées si l'UI les a posées
        // à la création). MCP/bridge ignorent poliment si non lus.
        client_ref: conv.clientRef,
        project_ref: conv.projectRef,
        channel: conv.channel,
        conversation_id: id,
      },
    });
  } catch (e) {
    if (e instanceof BridgeError) {
      return apiError(
        "bridge_error",
        `Bridge a répondu ${e.status}`,
        { status: e.status }
      );
    }
    console.error("[v4/messages] bridge call failed:", e);
    return apiError("bridge_error", e instanceof Error ? e.message : "Bridge injoignable");
  }

  // 3) Persister bridge_session_id si pas encore peuplé. (Le bridge peut renvoyer
  // un session_id différent — on stocke seulement le premier pour stabilité UI.)
  if (!conv.bridgeSessionId && bridgeResp.session_id) {
    await query(
      `UPDATE chat.conversations SET bridge_session_id=$1, updated_at=now()
       WHERE id=$2 AND bridge_session_id IS NULL`,
      [bridgeResp.session_id, id]
    );
  }

  // 4) Insert assistant message
  const asstInsert = await query<MsgRow>(
    `INSERT INTO chat.messages (conversation_id, role, content, model_tier)
     VALUES ($1,'assistant',$2,$3) RETURNING *`,
    [id, bridgeResp.result, displayTier]
  );

  return Response.json(
    {
      userMessage: toApi(userInsert.rows[0]),
      assistantMessage: toApi(asstInsert.rows[0]),
      // Métadonnées bridge — pas exposées à l'UI client par défaut, utiles pour debug staging.
      meta: {
        durationMs: bridgeResp.duration_ms,
        tierUsed: bridgeResp.tier_used,
        sessionPersisted: !conv.bridgeSessionId,
      },
    },
    { status: 201 }
  );
}
