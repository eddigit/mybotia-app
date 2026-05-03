"use client";

import {
  Search,
  Bell,
  PanelRight,
  PanelRightClose,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "@/components/shared/ThemeSwitcher";

export function TopBar({
  railOpen,
  onToggleRail,
  onOpenPalette,
}: {
  railOpen: boolean;
  onToggleRail: () => void;
  onOpenPalette?: () => void;
}) {
  // Bloc 4C — bouton qui ouvre la Command Palette globale (Cmd/Ctrl+K).
  // Détection plateforme pour afficher le bon raccourci visuel.
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/i.test(navigator.platform);
  return (
    <header className="flex items-center justify-between h-16 px-8 bg-surface-0/80 backdrop-blur-md border-b border-border-subtle sticky top-0 z-40 shadow-2xl shadow-black/10 dark:shadow-black/20">
      {/* Search — bouton qui ouvre la Command Palette */}
      <div className="flex items-center flex-1 max-w-md">
        <button
          type="button"
          onClick={onOpenPalette}
          className="relative w-full group flex items-center bg-surface-1 hover:bg-surface-2 transition-all py-2.5 pl-10 pr-20 rounded-lg text-left focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
          title="Recherche globale (Cmd/Ctrl+K)"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <span className="text-sm text-text-muted truncate">
            Rechercher clients, projets, agents…
          </span>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[9px] font-bold bg-surface-3 rounded border border-border-subtle text-text-muted font-mono">
              {isMac ? "⌘" : "CTRL"}
            </kbd>
            <kbd className="px-1.5 py-0.5 text-[9px] font-bold bg-surface-3 rounded border border-border-subtle text-text-muted font-mono">
              K
            </kbd>
          </div>
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-4">
        {/* Notifications — placeholder, shows badge */}
        <div className="relative flex items-center justify-center w-9 h-9 text-text-muted">
          <Bell className="w-[18px] h-[18px]" />
        </div>

        {/* Theme switcher */}
        <ThemeSwitcher />

        {/* Divider */}
        <div className="h-6 w-px bg-border-subtle" />

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
