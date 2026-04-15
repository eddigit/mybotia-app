"use client";

import { useState } from "react";
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

type FilterKey = "all" | "active" | "pending";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "active", label: "Actives" },
  { key: "pending", label: "En attente" },
];

export function ConversationList({
  conversations,
  activeId,
  onSelect,
}: {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = conversations.filter((c) => {
    if (filter === "all") return true;
    if (filter === "active") return c.status === "active";
    return c.status === "pending";
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.04]">
        <h2 className="text-sm font-bold font-headline text-text-primary mb-3">Conversations</h2>
        <div className="flex gap-1 bg-surface-1 p-1 rounded-sm">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-tight transition-all rounded-sm",
                filter === f.key
                  ? "bg-accent-primary/10 text-accent-glow"
                  : "text-text-muted hover:bg-surface-3/50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((conv) => {
          const ChannelIcon = channelIcons[conv.channel] || MessageSquare;
          const isActive = conv.id === activeId;

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                "w-full text-left px-5 py-3.5 border-b border-white/[0.04] transition-all",
                isActive
                  ? "bg-accent-primary/5 border-l-2 border-l-accent-primary"
                  : "hover:bg-surface-3/30 border-l-2 border-l-transparent"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-surface-3 shrink-0 mt-0.5">
                  <ChannelIcon className="w-3.5 h-3.5 text-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-bold text-text-primary truncate">{conv.title}</span>
                    <span className="text-[10px] text-text-muted font-mono shrink-0">
                      {formatRelativeTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <StatusBadge status={conv.status} size="xs" />
                    {conv.agentName && (
                      <span className="text-[10px] text-accent-glow font-semibold">{conv.agentName}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted truncate">{truncate(conv.lastMessage, 80)}</p>
                </div>
                {conv.unread > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-accent-primary text-white shrink-0">
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
