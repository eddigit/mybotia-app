// OpenClaw Gateway integration — via HTTP bridge on VPS
// The bridge runs on the VPS alongside the gateway and translates
// HTTP requests into OpenClaw CLI calls + filesystem reads.

const BRIDGE_URL = process.env.OPENCLAW_BRIDGE_URL || "https://bridge.mybotia.com";
const BRIDGE_TOKEN = process.env.OPENCLAW_BRIDGE_TOKEN || "";

async function bridgeFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${BRIDGE_TOKEN}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  return res;
}

// ---- Types ----

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
  error?: string;
}

// ---- Session listing ----

export async function listConversations(): Promise<ConversationSummary[]> {
  const res = await bridgeFetch("/conversations");
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
  // Project memory is handled by the bridge during chat
  return null;
}

export async function saveProjectMemory(
  projectRef: string,
  content: string
): Promise<void> {
  // Project memory saving is handled by the bridge during chat
}

export async function listProjectMemories(): Promise<
  { projectRef: string; updatedAt: string; size: number }[]
> {
  return [];
}

// ---- Send message to agent ----

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
  }
): Promise<AgentResponse> {
  const res = await bridgeFetch("/chat", {
    method: "POST",
    body: JSON.stringify({
      agentId,
      message,
      sessionId,
      projectContext,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      content: "",
      sessionId: sessionId || "",
      error: data.error || `Bridge error: ${res.status}`,
    };
  }

  return data;
}
