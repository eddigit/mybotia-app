"use client";

import { useState } from "react";
import {
  MessageSquare,
  Phone,
  Send,
  Globe,
  Plus,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import type { ConversationItem } from "@/hooks/use-api";

const channelIcons: Record<string, typeof MessageSquare> = {
  whatsapp: Phone,
  telegram: Send,
  webchat: Globe,
  direct: Bot,
  unknown: MessageSquare,
};

type FilterKey = "all" | "whatsapp" | "telegram" | "webchat";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "telegram", label: "Telegram" },
  { key: "webchat", label: "WebChat" },
];

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNewChat,
}: {
  conversations: ConversationItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNewChat?: () => void;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = conversations.filter((c) => {
    if (filter === "all") return true;
    return c.channel === filter;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold font-headline text-text-primary">
            Conversations
          </h2>
          {onNewChat && (
            <button
              onClick={onNewChat}
              className="flex items-center justify-center w-7 h-7 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20 transition-all rounded-sm"
              title="Nouvelle conversation"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
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
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <span className="micro-label text-text-muted">
              Aucune conversation
            </span>
          </div>
        )}
        {filtered.map((conv) => {
          const ChannelIcon = channelIcons[conv.channel] || MessageSquare;
          const isActive = conv.id === activeId;

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                "w-full text-left px-5 py-3.5 border-b border-border-subtle transition-all",
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
                    <span className="text-xs font-bold text-text-primary truncate">
                      {conv.title}
                    </span>
                    <span className="text-[10px] text-text-muted font-mono shrink-0">
                      {formatRelativeTime(conv.updatedAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-accent-glow font-semibold">
                      {conv.agentName}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {conv.channel}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
