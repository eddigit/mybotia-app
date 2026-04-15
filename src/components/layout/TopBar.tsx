"use client";

import {
  Search,
  Bell,
  PanelRight,
  PanelRightClose,
  Sparkles,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function TopBar({
  railOpen,
  onToggleRail,
}: {
  railOpen: boolean;
  onToggleRail: () => void;
}) {
  return (
    <header className="flex items-center justify-between h-14 px-5 border-b border-border-subtle bg-surface-1/50 backdrop-blur-sm shrink-0">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <div className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-text-muted text-sm transition-all hover:border-border-default focus-within:border-accent-primary/30 focus-within:ring-1 focus-within:ring-accent-primary/10">
          <Search className="w-4 h-4 shrink-0" />
          <input
            type="text"
            placeholder="Rechercher conversations, contacts, dossiers..."
            className="w-full bg-transparent outline-none text-text-primary placeholder:text-text-muted"
          />
          <kbd className="hidden md:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-text-muted bg-surface-3 border border-border-subtle">
            <span className="text-[9px]">&#8984;</span>K
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* AI command */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-accent-glow bg-accent-primary/10 border border-accent-primary/20 hover:bg-accent-primary/15 transition-all">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-xs font-medium">Demander a l&apos;IA</span>
        </button>

        {/* Notifications */}
        <button className="relative flex items-center justify-center w-9 h-9 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/[0.03] transition-all">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-primary" />
        </button>

        {/* Rail toggle */}
        <button
          onClick={onToggleRail}
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg transition-all",
            railOpen
              ? "text-accent-glow bg-accent-primary/10"
              : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
          )}
        >
          {railOpen ? (
            <PanelRightClose className="w-[18px] h-[18px]" />
          ) : (
            <PanelRight className="w-[18px] h-[18px]" />
          )}
        </button>

        {/* User avatar */}
        <div className="ml-2 flex items-center justify-center w-8 h-8 rounded-full bg-accent-primary/20 border border-accent-primary/30">
          <User className="w-4 h-4 text-accent-glow" />
        </div>
      </div>
    </header>
  );
}
