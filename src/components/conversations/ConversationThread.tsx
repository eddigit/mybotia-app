"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { User, Settings2, Loader2, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationItem, ChatMessage } from "@/hooks/use-api";
import { getAgentAvatar, MYBOTIA_LOGO } from "@/lib/agent-avatars";
import { MessageComposer } from "./MessageComposer";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ClientContextCard } from "./ClientContextCard";
import {
  DocumentCard,
  detectDocumentReferences,
} from "@/components/shared/DocumentCard";
import { SourcesCard } from "./SourcesCard";
import { ChatActionBar } from "./ChatActionBar";

// Cle localStorage pour le contexte client d'une conversation.
// Ecrite par /conversations/page.tsx lors d'un seed depuis /crm/[id]
// (et lors du remplacement temp-id -> session-id reel apres 1er message).
const CLIENT_CONTEXT_KEY_PREFIX = "client-context-conv-";

function readClientContext(
  conversationId: string
): { id: string; name: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(
      CLIENT_CONTEXT_KEY_PREFIX + conversationId
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === "string" && typeof parsed.name === "string") {
      return { id: parsed.id, name: parsed.name };
    }
    return null;
  } catch {
    return null;
  }
}

function AgentAvatar({
  agentId,
  agentName,
  size = 32,
}: {
  agentId?: string;
  agentName?: string;
  size?: number;
}) {
  const avatar = agentId ? getAgentAvatar(agentId) : null;
  const imgUrl = avatar?.url || MYBOTIA_LOGO;
  const alt = agentName || agentId || "Collaborateur IA";
  return (
    <div
      className="flex items-center justify-center shrink-0 rounded-full overflow-hidden bg-accent-primary/10 border border-accent-primary/20"
      style={{ width: size, height: size }}
    >
      <Image
        src={imgUrl}
        alt={alt}
        width={size}
        height={size}
        className="w-full h-full object-cover"
        unoptimized
      />
    </div>
  );
}

function MessageBubble({
  message,
  agentId,
  agentName,
  clientContext,
  onSeedPrompt,
}: {
  message: ChatMessage;
  agentId?: string;
  agentName?: string;
  clientContext?: { id: string; name: string } | null;
  onSeedPrompt?: (text: string) => void;
}) {
  const isAssistant = message.role === "assistant";
  const isSystem = message.role === "system";
  const isUser = message.role === "user";

  if (isSystem) {
    return (
      <div className="flex items-center justify-center py-3 animate-fade-in">
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-3/50 border border-border-subtle">
          <Settings2 className="w-3 h-3 text-text-muted" />
          <span className="text-[11px] text-text-muted font-mono line-clamp-2">
            {message.content}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      {isAssistant ? (
        <AgentAvatar agentId={agentId} agentName={agentName} />
      ) : (
        <div className="flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-surface-3 border border-border-subtle">
          <User className="w-4 h-4 text-text-muted" />
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[70%] px-5 py-4",
          isAssistant
            ? "bg-surface-2 border border-border-subtle"
            : "bg-accent-primary/10 border border-accent-primary/15"
        )}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={cn(
              "text-[11px] font-bold",
              isAssistant ? "text-accent-glow" : "text-text-primary"
            )}
          >
            {isAssistant ? agentName || "Collaborateur IA" : message.sender || "Vous"}
          </span>
          {message.timestamp && (
            <span className="text-[10px] text-text-muted font-mono">
              {new Date(message.timestamp).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        {isAssistant ? (
          <div className="text-sm leading-relaxed">
            <MarkdownRenderer content={message.content} />
            <DocumentReferencesInline content={message.content} />
            {message.toolsCalled !== undefined && (
              <SourcesCard tools={message.toolsCalled} />
            )}
            <ChatActionBar
              agentName={agentName}
              messageContent={message.content}
              clientContext={clientContext}
              onSeedPrompt={onSeedPrompt}
            />
          </div>
        ) : (
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        )}
      </div>
    </div>
  );
}

// Detecte les references documents (devis/factures) dans un message Lea
// et affiche une DocumentCard cliquable pour chacune. Lecture seule par
// defaut (boutons FSM Telecharger/Generer geres par DocumentCard).
function DocumentReferencesInline({ content }: { content: string }) {
  const refs = detectDocumentReferences(content);
  if (refs.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {refs.map(({ ref, kind }) => (
        <DocumentCard
          key={`${kind}-${ref}`}
          modulepart={kind}
          reference={ref}
          compact
        />
      ))}
    </div>
  );
}

export function ConversationThread({
  conversation,
  messages,
  loading,
  sending,
  statusText,
  onSend,
}: {
  conversation: ConversationItem;
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  statusText?: string;
  onSend: (text: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [clientCtx, setClientCtx] = useState<{ id: string; name: string } | null>(
    null
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Charger le contexte client (si conv issue d'un seed depuis /crm/[id]).
  // Re-evalue a chaque changement de conv : le contexte est specifique au sessionId.
  useEffect(() => {
    setClientCtx(readClientContext(conversation.id));
  }, [conversation.id]);

  const agentId = conversation.agentId;
  const agentName = conversation.agentName;

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-surface-0/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <AgentAvatar agentId={agentId} agentName={agentName} size={36} />
          <div>
            <h2 className="text-sm font-bold text-text-primary font-headline">
              {conversation.title}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-accent-glow font-semibold">
                {conversation.agentName}
              </span>
              <span className="text-text-muted">·</span>
              <span className="text-[11px] text-text-muted">
                {conversation.channel === "project"
                  ? "session projet"
                  : conversation.channel}
              </span>
              {conversation.projectId && (
                <>
                  <span className="text-text-muted">·</span>
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
                    <Brain className="w-3 h-3" />
                    Memoire active
                  </span>
                </>
              )}
              {conversation.model && (
                <>
                  <span className="text-text-muted">·</span>
                  <span className="text-[10px] text-text-muted font-mono">
                    {conversation.model}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Client context card (seed depuis /crm/[id]) */}
      {clientCtx && (
        <ClientContextCard clientId={clientCtx.id} clientName={clientCtx.name} />
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <div className="text-center flex flex-col items-center gap-3">
              <AgentAvatar agentId={agentId} agentName={agentName} size={48} />
              <p className="text-sm text-text-muted max-w-[240px]">
                Ecrivez un message pour demarrer la conversation avec{" "}
                {agentName || "votre collaborateur IA"}.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            agentId={agentId}
            agentName={agentName}
            clientContext={clientCtx}
            onSeedPrompt={onSend}
          />
        ))}
        {sending && (
          <div className="flex gap-3 animate-fade-in">
            <AgentAvatar agentId={agentId} agentName={agentName} />
            <div className="px-5 py-4 bg-surface-2 border border-border-subtle">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-accent-glow animate-spin" />
                <span className="text-[11px] text-text-muted truncate max-w-[300px]">
                  {statusText || `${conversation.agentName} reflechit...`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <MessageComposer
        agentName={conversation.agentName}
        onSend={onSend}
        disabled={sending}
      />
    </div>
  );
}
