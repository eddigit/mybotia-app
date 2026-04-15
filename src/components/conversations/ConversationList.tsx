"use client";

import {
  MessageSquare,
  Phone,
  Send,
  Mail,
  Globe,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime, truncate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Conversation } from "@/types";

const channelIcons: Record<string, typeof MessageSquare> = {
  whatsapp: Phone,
  telegram: Send,
  email: Mail,
  webchat: Globe,
  voice: Mic,
};

const channelColors: Record<string, string> = {
  whatsapp: "text-emerald-400",
  telegram: "text-blue-400",
  email: "text-amber-400",
  webchat: "text-violet-400",
  voice: "text-cyan-400",
};

export function ConversationList({
  conversations,
  activeId,
  onSelect,
}: {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <h2 className="text-sm font-semibold text-text-primary mb-2">Conversations</h2>
        <div className="flex gap-1">
          {['Toutes', 'Actives', 'En attente', 'Resolues'].map((filter) => (
            <button
              key={filter}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                filter === 'Toutes'
                  ? "bg-accent-primary/10 text-accent-glow"
                  : "text-text-muted hover:text-text-secondary hover:bg-white/[0.03]"
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conv) => {
          const ChannelIcon = channelIcons[conv.channel] || MessageSquare;
          const isActive = conv.id === activeId;

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                "w-full text-left px-4 py-3 border-b border-border-subtle transition-all",
                isActive
                  ? "bg-accent-primary/5 border-l-2 border-l-accent-primary"
                  : "hover:bg-white/[0.02] border-l-2 border-l-transparent"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5",
                  channelColors[conv.channel],
                  "bg-current/10"
                )} style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}>
                  <ChannelIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-text-primary truncate">{conv.title}</span>
                    <span className="text-[10px] text-text-muted shrink-0">
                      {formatRelativeTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <StatusBadge status={conv.status} size="xs" />
                    {conv.agentName && (
                      <span className="text-[10px] text-accent-glow">{conv.agentName}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted truncate">{truncate(conv.lastMessage, 80)}</p>
                </div>
                {conv.unread > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-accent-primary text-white shrink-0">
                    {conv.unread}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
