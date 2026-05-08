// Helpers fetch côté client. Pas de TanStack pour rester sobre — on s'en passe en B3.

export interface FolderApi {
  id: string;
  name: string;
  description: string | null;
  agentId: string | null;
  clientRef: string | null;
  projectRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationApi {
  id: string;
  agentId: string;
  agentName: string;
  folderId: string | null;
  title: string;
  channel: string;
  projectRef: string | null;
  clientRef: string | null;
  pinnedAt: string | null;
  archivedAt: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageApi {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls: unknown;
  attachments: unknown;
  sources: unknown;
  modelTier: string | null;
  pinnedAt: string | null;
  createdAt: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let body: ApiError | null = null;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      // ignore
    }
    const err = new Error(body?.message ?? `HTTP ${res.status}`) as Error & {
      code?: string;
      status?: number;
    };
    err.code = body?.error;
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export type FolderCascade = "archive-children" | "move-out" | "delete-children";

export const v4Api = {
  listFolders: () => apiFetch<FolderApi[]>("/api/v4/folders"),
  createFolder: (name: string) =>
    apiFetch<FolderApi>("/api/v4/folders", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  renameFolder: (id: string, name: string) =>
    apiFetch<FolderApi>(`/api/v4/folders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  archiveFolder: (
    id: string,
    cascade?: "archive-children" | "move-out"
  ) =>
    apiFetch<FolderApi>(`/api/v4/folders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true, cascade }),
    }),
  deleteFolder: (
    id: string,
    cascade?: "delete-children" | "move-out"
  ) => {
    const qs = cascade ? `?cascade=${encodeURIComponent(cascade)}` : "";
    return apiFetch<{ ok: true; id: string }>(
      `/api/v4/folders/${encodeURIComponent(id)}${qs}`,
      { method: "DELETE" }
    );
  },
  listConversations: (folderId?: string | null) =>
    apiFetch<ConversationApi[]>(
      folderId
        ? `/api/v4/conversations?folderId=${encodeURIComponent(folderId)}`
        : `/api/v4/conversations`
    ),
  getConversation: (id: string) =>
    apiFetch<ConversationApi>(`/api/v4/conversations/${encodeURIComponent(id)}`),
  updateConversation: (
    id: string,
    patch: { folderId?: string | null; title?: string; pinned?: boolean; archived?: boolean }
  ) =>
    apiFetch<ConversationApi>(`/api/v4/conversations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  archiveConversation: (id: string) =>
    apiFetch<ConversationApi>(`/api/v4/conversations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    }),
  deleteConversation: (id: string) =>
    apiFetch<{ ok: true; id: string }>(
      `/api/v4/conversations/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    ),
  createConversation: (input: {
    title?: string;
    folderId?: string | null;
    agentId?: string;
    projectRef?: string;
    clientRef?: string;
  }) =>
    apiFetch<ConversationApi>("/api/v4/conversations", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listMessages: (conversationId: string) =>
    apiFetch<MessageApi[]>(
      `/api/v4/conversations/${encodeURIComponent(conversationId)}/messages`
    ),
  sendMessage: (
    conversationId: string,
    content: string,
    modelTier?: "standard" | "premium"
  ) =>
    apiFetch<{ userMessage: MessageApi; assistantMessage: MessageApi }>(
      `/api/v4/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ content, modelTier: modelTier ?? "standard" }),
      }
    ),
};
