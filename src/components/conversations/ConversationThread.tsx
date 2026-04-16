"use client";

import { useEffect, useRef } from "react";
import { Bot, User, Settings2, Loader2, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationItem, ChatMessage } from "@/hooks/use-api";
import { MessageComposer } from "./MessageComposer";

function MessageBubble({ message }: { message: ChatMessage }) {
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
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 shrink-0",
          isAssistant
            ? "bg-accent-primary/10 border border-accent-primary/20"
            : "bg-surface-3"
        )}
      >
        {isAssistant ? (
          <Bot className="w-4 h-4 text-accent-glow" />
        ) : (
          <User className="w-4 h-4 text-text-muted" />
        )}
      </div>

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
            {isAssistant ? "IA" : message.sender || "Vous"}
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
        <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  );
}

export function ConversationThread({
  conversation,
  messages,
  loading,
  sending,
  onSend,
}: {
  conversation: ConversationItem;
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  onSend: (text: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-surface-0/50 backdrop-blur-sm shrink-0">
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

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <Bot className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-muted">
                Ecrivez un message pour demarrer la conversation
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {sending && (
          <div className="flex gap-3 animate-fade-in">
            <div className="flex items-center justify-center w-8 h-8 shrink-0 bg-accent-primary/10 border border-accent-primary/20">
              <Bot className="w-4 h-4 text-accent-glow" />
            </div>
            <div className="px-5 py-4 bg-surface-2 border border-border-subtle">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-accent-glow animate-spin" />
                <span className="text-[11px] text-text-muted">
                  {conversation.agentName} reflechit...
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
