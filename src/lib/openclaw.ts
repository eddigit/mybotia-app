// OpenClaw Gateway integration — server-side only
// Reads session data from disk + executes CLI commands for agent interaction
// Project-scoped conversations with per-project business memory

import { execFile } from "child_process";
import { readFile, readdir, writeFile, mkdir } from "fs/promises";
import { join, basename } from "path";

const OPENCLAW_BIN = "openclaw";
const AGENTS_DIR = "/home/gilles/.openclaw/agents";
const PROJECT_MEMORIES_DIR =
  "/home/gilles/.openclaw/workspace/project-memories";

// Known agent metadata
const AGENT_NAMES: Record<string, string> = {
  main: "Lea",
  julian: "Julian",
  nina: "Nina",
  oscar: "Oscar",
  bullsage: "BullSage",
  "agent-rh": "Agent RH",
};

// ---- Session listing ----

interface SessionEntry {
  sessionId: string;
  updatedAt: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
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

function parseSessionKey(key: string): {
  agentId: string;
  channel: string;
  target: string;
  projectId?: string;
} {
  const parts = key.split(":");
  const agentId = parts[1] || "main";

  // Project-scoped sessions: agent:{agentId}:project-{projectId}-{agentId}
  if (parts[2]?.startsWith("project-")) {
    const match = parts[2].match(/^project-(\d+)-/);
    return {
      agentId,
      channel: "project",
      target: parts[2],
      projectId: match?.[1],
    };
  }

  if (parts.length === 3 && parts[2] === "main") {
    return { agentId, channel: "direct", target: "main" };
  }
  if (parts.length >= 4) {
    const channel = parts[2];
    const target = parts.slice(3).join(":");
    return { agentId, channel, target };
  }
  if (parts[2]?.startsWith("chat-")) {
    return { agentId, channel: "webchat", target: parts[2] };
  }
  return { agentId, channel: "unknown", target: parts.slice(2).join(":") };
}

function generateTitle(
  channel: string,
  target: string,
  agentName: string,
  projectName?: string
): string {
  if (channel === "project" && projectName) {
    return `${projectName}`;
  }
  if (channel === "direct" && target === "main")
    return `${agentName} — Session principale`;
  if (channel === "webchat") return `${agentName} — WebChat`;
  if (channel === "telegram") {
    if (target.startsWith("direct:")) return `${agentName} — Telegram DM`;
    return `${agentName} — Telegram groupe`;
  }
  if (channel === "whatsapp") {
    if (target.includes("@g.us")) return `${agentName} — WhatsApp groupe`;
    return `${agentName} — WhatsApp DM`;
  }
  return `${agentName} — ${channel}`;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const conversations: ConversationSummary[] = [];

  const agentDirs = await readdir(AGENTS_DIR).catch(() => []);

  for (const agentId of agentDirs) {
    const sessionsPath = join(
      AGENTS_DIR,
      agentId,
      "sessions",
      "sessions.json"
    );
    try {
      const raw = await readFile(sessionsPath, "utf-8");
      const sessions: Record<string, SessionEntry> = JSON.parse(raw);

      for (const [key, sess] of Object.entries(sessions)) {
        const { channel, target, projectId } = parseSessionKey(key);
        const agentName = AGENT_NAMES[agentId] || agentId;

        conversations.push({
          id: sess.sessionId,
          sessionId: sess.sessionId,
          agentId,
          agentName,
          key,
          channel,
          target,
          updatedAt: new Date(sess.updatedAt).toISOString(),
          model: sess.model || "unknown",
          title: generateTitle(channel, target, agentName),
          projectId,
        });
      }
    } catch {
      // No sessions file for this agent
    }
  }

  // Sort by most recent first
  conversations.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return conversations;
}

// ---- Message history from session JSONL ----

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  sender?: string;
}

export async function getSessionMessages(
  sessionId: string,
  limit = 50
): Promise<ChatMessage[]> {
  const agentDirs = await readdir(AGENTS_DIR).catch(() => []);

  for (const agentId of agentDirs) {
    const sessionFile = join(
      AGENTS_DIR,
      agentId,
      "sessions",
      `${sessionId}.jsonl`
    );
    try {
      const raw = await readFile(sessionFile, "utf-8");
      const lines = raw.trim().split("\n");
      const messages: ChatMessage[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type !== "message") continue;

          const msg = entry.message;
          if (!msg || !msg.role) continue;

          let text = "";
          if (typeof msg.content === "string") {
            text = msg.content;
          } else if (Array.isArray(msg.content)) {
            text = msg.content
              .filter((c: { type: string }) => c.type === "text")
              .map((c: { text: string }) => c.text)
              .join("\n");
          }

          if (!text) continue;

          // Skip noise
          if (msg.role === "system" && text.length > 500) continue;
          if (msg.role === "user" && text.startsWith("System: [")) continue;
          if (msg.role === "user" && text.startsWith("Read HEARTBEAT"))
            continue;
          if (text === "NO_REPLY" || text === "NO_RESPONSE") continue;
          if (
            msg.role === "user" &&
            text.startsWith("Read ") &&
            text.includes("workspace context")
          )
            continue;
          // Skip project context injection (internal, not user-facing)
          if (
            msg.role === "user" &&
            text.startsWith("[CONTEXTE PROJET")
          )
            continue;

          let sender: string | undefined;
          if (msg.role === "user") {
            const senderMatch = text.match(/^(?:From|De)\s+([^:]+?):\s*/);
            if (senderMatch) sender = senderMatch[1];
          }

          messages.push({
            id: entry.id || `msg-${messages.length}`,
            role: msg.role as "user" | "assistant" | "system",
            content: text.slice(0, 5000),
            timestamp: entry.timestamp || "",
            sender,
          });
        } catch {
          // Skip malformed lines
        }
      }

      return messages.slice(-limit);
    } catch {
      // File not found, try next agent
    }
  }

  return [];
}

// ---- Project memory ----

export async function getProjectMemory(
  projectRef: string
): Promise<string | null> {
  try {
    const filePath = join(PROJECT_MEMORIES_DIR, `${projectRef}.md`);
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

export async function saveProjectMemory(
  projectRef: string,
  content: string
): Promise<void> {
  await mkdir(PROJECT_MEMORIES_DIR, { recursive: true });
  const filePath = join(PROJECT_MEMORIES_DIR, `${projectRef}.md`);
  await writeFile(filePath, content, "utf-8");
}

export async function listProjectMemories(): Promise<
  { projectRef: string; updatedAt: string; size: number }[]
> {
  try {
    const files = await readdir(PROJECT_MEMORIES_DIR);
    const results = [];
    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      const raw = await readFile(join(PROJECT_MEMORIES_DIR, f), "utf-8");
      results.push({
        projectRef: basename(f, ".md"),
        updatedAt: new Date().toISOString(),
        size: raw.length,
      });
    }
    return results;
  } catch {
    return [];
  }
}

// ---- Send message to agent (via CLI) ----

export interface AgentResponse {
  content: string;
  sessionId: string;
  model?: string;
  error?: string;
}

function execPromise(
  cmd: string,
  args: string[],
  timeout = 120000
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { timeout, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
        } else {
          resolve(stdout);
        }
      }
    );
  });
}

/**
 * Build the session ID for a project-scoped conversation.
 * Deterministic: same project + agent = same session (continuity).
 */
export function projectSessionId(
  projectId: string,
  agentId: string
): string {
  return `project-${projectId}-${agentId}`;
}

/**
 * Send a message to an agent, optionally within a project context.
 * When projectRef + projectName are provided, injects project context
 * and memory into the message.
 */
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
  const args = ["agent", "--json"];

  if (agentId && agentId !== "main") {
    args.push("--agent", agentId);
  }

  // Build the actual message with project context injection
  let fullMessage = message;

  if (projectContext) {
    const memory = await getProjectMemory(projectContext.projectRef);
    const contextLines = [
      `[CONTEXTE PROJET — ${projectContext.projectRef}]`,
      `Projet: ${projectContext.projectName}`,
    ];
    if (projectContext.clientName) {
      contextLines.push(`Client: ${projectContext.clientName}`);
    }
    if (projectContext.description) {
      contextLines.push(`Description: ${projectContext.description}`);
    }
    if (memory) {
      contextLines.push(`\nMemoire metier du projet:\n${memory}`);
    }
    contextLines.push(
      `\nInstructions: Tu es dans le contexte du projet ${projectContext.projectRef}. ` +
        `Reponds en tenant compte de ce projet et de sa memoire metier. ` +
        `Si tu apprends des informations importantes sur ce projet ` +
        `(decisions, preferences client, contraintes, etc.), ` +
        `termine ta reponse par un bloc [MEMOIRE_PROJET] contenant les points cles a retenir.`
    );
    contextLines.push(`[/CONTEXTE PROJET]\n`);
    contextLines.push(message);
    fullMessage = contextLines.join("\n");
  }

  args.push("--message", fullMessage);

  if (sessionId) {
    args.push("--session-id", sessionId);
  }

  try {
    const output = await execPromise(OPENCLAW_BIN, args, 120000);
    const parsed = JSON.parse(output);

    let responseContent =
      parsed.response || parsed.text || parsed.content || output;

    // Extract and save project memory if the agent generated one
    if (projectContext && typeof responseContent === "string") {
      const memoryMatch = responseContent.match(
        /\[MEMOIRE_PROJET\]([\s\S]*?)(?:\[\/MEMOIRE_PROJET\]|$)/
      );
      if (memoryMatch) {
        const newMemory = memoryMatch[1].trim();
        // Append to existing memory
        const existing = await getProjectMemory(projectContext.projectRef);
        const date = new Date().toISOString().slice(0, 10);
        const entry = `\n## ${date}\n${newMemory}\n`;
        const updated = existing
          ? existing + entry
          : `# Memoire metier — ${projectContext.projectName}\n${entry}`;
        await saveProjectMemory(projectContext.projectRef, updated);

        // Remove the memory block from the visible response
        responseContent = responseContent
          .replace(/\[MEMOIRE_PROJET\][\s\S]*?(?:\[\/MEMOIRE_PROJET\]|$)/, "")
          .trim();
      }
    }

    return {
      content: responseContent,
      sessionId: parsed.sessionId || sessionId || "",
      model: parsed.model,
    };
  } catch (e) {
    return {
      content: "",
      sessionId: sessionId || "",
      error: e instanceof Error ? e.message : "Erreur agent",
    };
  }
}
