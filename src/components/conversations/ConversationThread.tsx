"use client";

import { Bot, User, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, Conversation } from "@/types";
import { MessageComposer } from "./MessageComposer";

function MessageBubble({ message }: { message: Message }) {
  const isAgent = message.senderType === 'agent';
  const isSystem = message.senderType === 'system';
  const isUser = message.senderType === 'user';

  if (isSystem) {
    return (
      <div className="flex items-center justify-center py-2 animate-fade-in">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-3/50 border border-border-subtle">
          <Settings2 className="w-3 h-3 text-text-muted" />
          <span className="text-[11px] text-text-muted">{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex gap-3 animate-fade-in",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <div className={cn(
        "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
        isAgent
          ? "bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 border border-accent-primary/30"
          : "bg-surface-3 border border-border-subtle"
      )}>
        {isAgent ? <Bot className="w-4 h-4 text-accent-glow" /> : <User className="w-4 h-4 text-text-muted" />}
      </div>

      {/* Bubble */}
      <div className={cn(
        "max-w-[70%] rounded-2xl px-4 py-3",
        isAgent
          ? "bg-surface-3 border border-border-subtle rounded-tl-md"
          : "bg-accent-primary/15 border border-accent-primary/20 rounded-tr-md"
      )}>
        <div className="flex items-center gap-2 mb-1">
          <span className={cn(
            "text-[11px] font-semibold",
            isAgent ? "text-accent-glow" : "text-text-primary"
          )}>
            {message.sender}
          </span>
          <span className="text-[10px] text-text-muted">
            {new Date(message.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-sm text-text-primary leading-relaxed">{message.content}</p>

        {/* Actions */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border-subtle">
            {message.actions.map((action) => (
              <button
                key={action.id}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  action.type === 'primary'
                    ? "bg-accent-primary text-white hover:bg-accent-primary/90"
                    : "bg-white/5 text-text-secondary border border-border-subtle hover:bg-white/[0.08]"
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConversationThread({
  conversation,
  messages,
}: {
  conversation: Conversation;
  messages: Message[];
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{conversation.title}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-text-muted">
              {conversation.participants.join(', ')}
            </span>
            <span className="text-[10px] text-text-muted">·</span>
            <span className="text-[11px] text-accent-glow">{conversation.agentName}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Composer */}
      <MessageComposer agentName={conversation.agentName || 'IA'} />
    </div>
  );
}
