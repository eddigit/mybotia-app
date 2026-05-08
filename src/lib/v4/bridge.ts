// Adaptateur app V4 → bridge Claude prod (port 9400). Lecture seule du bridge :
// on consomme POST /chat. Le bridge n'est pas modifié pour B4.

const BRIDGE_URL = process.env.CLAUDE_BRIDGE_URL || "http://127.0.0.1:9400";
const BRIDGE_TOKEN = process.env.CLAUDE_BRIDGE_TOKEN;

export interface BridgeUserContext {
  name: string;
  email: string;
  role: string;
  tenant_slug: string;
  is_superadmin: boolean;
  // V1 garde-fou Voice/Conv (Agent 4 — 2026-05-08) : refs métier propagées
  // côté bridge pour que l'agent sache de qui on parle. Optionnels — bridge
  // existant ignore poliment ces champs s'il ne les lit pas encore.
  client_ref?: string | null;
  project_ref?: string | null;
  channel?: string | null;
  conversation_id?: string | null;
}

export interface BridgeChatResponse {
  result: string;
  session_id: string;
  duration_ms: number;
  model_used: string;
  tier_used?: string | null;
}

export class BridgeError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`Bridge HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = "BridgeError";
    this.status = status;
    this.body = body;
  }
}

export async function bridgeChat(input: {
  message: string;
  agentId: string;
  userContext: BridgeUserContext;
  sessionId?: string | null;
  modelTier?: "fast" | "deep";
  projectContext?: Record<string, unknown>;
}): Promise<BridgeChatResponse> {
  if (!BRIDGE_TOKEN) {
    throw new Error("CLAUDE_BRIDGE_TOKEN absent dans l'environnement de l'app V4");
  }
  const payload: Record<string, unknown> = {
    message: input.message,
    agent_id: input.agentId,
    user_context: input.userContext,
    model_tier: input.modelTier ?? "fast",
  };
  if (input.sessionId) payload.session_id = input.sessionId;
  if (input.projectContext) payload.project_context = input.projectContext;

  const res = await fetch(`${BRIDGE_URL}/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BRIDGE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    // Bridge appelle Claude → laisser une fenêtre large
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new BridgeError(res.status, body);
  }
  return (await res.json()) as BridgeChatResponse;
}
