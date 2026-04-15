"use client";

import {
  Search,
  Bell,
  PanelRight,
  PanelRightClose,
  Zap,
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
    <header className="flex items-center justify-between h-16 px-8 bg-surface-0/80 backdrop-blur-md border-b border-white/[0.04] sticky top-0 z-40 shadow-2xl shadow-black/20">
      {/* Search */}
      <div className="flex items-center flex-1 max-w-md">
        <div className="relative w-full group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Rechercher dans l'intelligence..."
            className="w-full bg-surface-1 border-none text-sm py-2.5 pl-10 pr-20 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-primary/40 transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[9px] font-bold bg-surface-3 rounded border border-white/[0.06] text-text-muted font-mono">CMD</kbd>
            <kbd className="px-1.5 py-0.5 text-[9px] font-bold bg-surface-3 rounded border border-white/[0.06] text-text-muted font-mono">K</kbd>
          </div>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative flex items-center justify-center w-9 h-9 text-text-muted hover:text-text-primary transition-all">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent-primary rounded-full ring-2 ring-surface-0" />
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-white/[0.06]" />

        {/* System Active pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-primary/10 rounded-full border border-accent-primary/20">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
          <span className="micro-label text-accent-glow">Systeme actif</span>
        </div>

        {/* Rail toggle */}
        <button
          onClick={onToggleRail}
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg transition-all",
            railOpen
              ? "text-accent-glow bg-accent-primary/10"
              : "text-text-muted hover:text-text-primary"
          )}
        >
          {railOpen ? (
            <PanelRightClose className="w-[18px] h-[18px]" />
          ) : (
            <PanelRight className="w-[18px] h-[18px]" />
          )}
        </button>
      </div>
    </header>
  );
}
