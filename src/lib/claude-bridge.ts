// Claude Code Bridge integration — replaces OpenClaw
// Connects to the Claude Bridge HTTP service on VPS2 (Damien)
// Uses claude -p (headless mode) under Max x20 subscription

const BRIDGE_URL = process.env.CLAUDE_BRIDGE_URL || "http://127.0.0.1:9400";
const BRIDGE_TOKEN = process.env.CLAUDE_BRIDGE_TOKEN || "mybotia-bridge-poc-2026";

async function bridgeFetch(path: string, options?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180_000); // 3 min timeout
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    signal: controller.signal,
    ...options,
    headers: {
      Authorization: `Bearer ${BRIDGE_TOKEN}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  clearTimeout(timeoutId);
  return res;
}

// ---- Types (same interface as openclaw.ts) ----

export interface UserContext {
  name: string;
  email: string;
  role: string;
  tenant_slug: string;
  is_superadmin: boolean;
}

export interface ConversationSummary {
  id: string;
  sessionId: string;
  agentId: string;
  agentName: string;
  key: string;
  channel: string;
  target: string;
  updatedAt: string;
  model: string;
  title: string;
  projectId?: string;
  projectRef?: string;
  projectName?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  sender?: string;
}

export interface AgentResponse {
  content: string;
  sessionId: string;
  model?: string;
  tierUsed?: string;
  error?: string;
}

// Tier de modele : "fast" (Sonnet, defaut) ou "deep" (Opus, mode reflexion)
// Ignore par le bridge sur canaux temps reel (voice / whatsapp) — toujours Sonnet.
export type ModelTier = "fast" | "deep";

// ---- Session listing ----

export async function listConversations(userEmail?: string): Promise<ConversationSummary[]> {
  const qs = userEmail ? `?user_email=${encodeURIComponent(userEmail)}` : "";
  const res = await bridgeFetch(`/conversations${qs}`);
  if (!res.ok) {
    throw new Error(`Bridge error: ${res.status}`);
  }
  return res.json();
}

// ---- Message history ----

export async function getSessionMessages(
  sessionId: string,
  limit = 50
): Promise<ChatMessage[]> {
  const res = await bridgeFetch(
    `/conversations/${encodeURIComponent(sessionId)}/messages?limit=${limit}`
  );
  if (!res.ok) {
    throw new Error(`Bridge error: ${res.status}`);
  }
  return res.json();
}

// ---- Project memory ----

export async function getProjectMemory(
  projectRef: string
): Promise<string | null> {
  return null;
}

export async function saveProjectMemory(
  projectRef: string,
  content: string
): Promise<void> {}

export async function listProjectMemories(): Promise<
  { projectRef: string; updatedAt: string; size: number }[]
> {
  return [];
}

// ---- Send message to agent (streaming with live status) ----

export function projectSessionId(
  projectId: string,
  agentId: string
): string {
  return `project-${projectId}-${agentId}`;
}

export async function sendAgentMessage(
  agentId: string,
  message: string,
  sessionId?: string,
  projectContext?: {
    projectRef: string;
    projectName: string;
    clientName?: string;
    description?: string;
  },
  userContext?: UserContext,
  onStatus?: (status: string) => void,
  onDelta?: (delta: string) => void,
  modelTier: ModelTier = "fast"
): Promise<AgentResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180_000);

  try {
    const res = await fetch(`${BRIDGE_URL}/chat/stream`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${BRIDGE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        session_id: sessionId,
        agent_id: agentId,
        project_context: projectContext,
        user_context: userContext,
        model_tier: modelTier,
      }),
    });
    clearTimeout(timeoutId);

    if (!res.ok || !res.body) {
      const fallback = await bridgeFetch("/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          session_id: sessionId,
          agent_id: agentId,
          project_context: projectContext,
          user_context: userContext,
          model_tier: modelTier,
        }),
      });
      const data = await fallback.json();
      return {
        content: data.result || "",
        sessionId: data.session_id || sessionId || "",
        model: data.model_used,
        tierUsed: data.tier_used,
        error: !fallback.ok ? (data.detail || `Bridge error`) : undefined,
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let resultSessionId = sessionId || "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.status && onStatus) {
            onStatus(evt.status);
          }
          if (evt.delta) {
            fullContent += evt.delta;
            if (onDelta) onDelta(evt.delta);
          }
          if (evt.done) {
            resultSessionId = evt.session_id || resultSessionId;
            if (evt.result && !fullContent) fullContent = evt.result;
          }
        } catch {
          // skip malformed
        }
      }
    }

    return {
      content: fullContent,
      sessionId: resultSessionId,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const fallback = await bridgeFetch("/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        session_id: sessionId,
        agent_id: agentId,
        project_context: projectContext,
        user_context: userContext,
        model_tier: modelTier,
      }),
    });
    const data = await fallback.json();
    return {
      content: data.result || "",
      sessionId: data.session_id || sessionId || "",
      model: data.model_used,
      tierUsed: data.tier_used,
    };
  }
}
