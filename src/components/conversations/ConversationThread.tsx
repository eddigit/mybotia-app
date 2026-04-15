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
      <div className="flex items-center justify-center py-3 animate-fade-in">
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-3/50 border border-white/[0.04]">
          <Settings2 className="w-3 h-3 text-text-muted" />
          <span className="text-[11px] text-text-muted font-mono">{message.content}</span>
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
        "flex items-center justify-center w-8 h-8 shrink-0",
        isAgent
          ? "bg-accent-primary/10 border border-accent-primary/20"
          : "bg-surface-3"
      )}>
        {isAgent ? <Bot className="w-4 h-4 text-accent-glow" /> : <User className="w-4 h-4 text-text-muted" />}
      </div>

      {/* Bubble */}
      <div className={cn(
        "max-w-[70%] px-5 py-4",
        isAgent
          ? "bg-surface-2 border border-white/[0.04]"
          : "bg-accent-primary/10 border border-accent-primary/15"
      )}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn(
            "text-[11px] font-bold",
            isAgent ? "text-accent-glow" : "text-text-primary"
          )}>
            {message.sender}
          </span>
          <span className="text-[10px] text-text-muted font-mono">
            {new Date(message.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-sm text-text-primary leading-relaxed">{message.content}</p>

        {/* Actions */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/[0.06]">
            {message.actions.map((action) => (
              <button
                key={action.id}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all",
                  action.type === 'primary'
                    ? "bg-accent-primary text-white hover:bg-accent-primary/80"
                    : "bg-surface-3 text-text-secondary border border-white/[0.06] hover:bg-surface-4"
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
      <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between bg-surface-0/50 backdrop-blur-sm">
        <div>
          <h2 className="text-sm font-bold text-text-primary font-headline">{conversation.title}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-text-muted">
              {conversation.participants.join(', ')}
            </span>
            <span className="text-text-muted">·</span>
            <span className="text-[11px] text-accent-glow font-semibold">{conversation.agentName}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Composer */}
      <MessageComposer agentName={conversation.agentName || 'IA'} />
    </div>
  );
}
