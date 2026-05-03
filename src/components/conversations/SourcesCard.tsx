"use client";

// Bloc 4B — affiche les outils/sources réellement appelés par l'agent durant
// la génération d'une réponse. Données issues du final event `tools_called`
// propagé par claude-bridge (poc-bridge.py).
//
// Règle CTO : on n'affiche QUE ce qui est techniquement observé. Pas de
// "fichiers workspace" supposés. Le workspace n'apparaît pas comme source
// certaine — il est implicite (toujours chargé en contexte).

import { useState } from "react";
import {
  Database,
  Archive,
  FolderOpen,
  Globe,
  Terminal,
  Wrench,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCall } from "@/hooks/use-api";

const categoryMeta: Record<
  ToolCall["category"],
  { label: string; icon: typeof Database; color: string }
> = {
  kb:    { label: "KB",      icon: Database,   color: "text-accent-glow border-accent-primary/30 bg-accent-primary/10" },
  crm:   { label: "CRM",     icon: FolderOpen, color: "text-amber-300 border-amber-400/30 bg-amber-400/10" },
  file:  { label: "Fichier", icon: FileText,   color: "text-text-secondary border-border-default bg-surface-3/50" },
  web:   { label: "Web",     icon: Globe,      color: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10" },
  shell: { label: "Shell",   icon: Terminal,   color: "text-text-muted border-border-default bg-surface-3/50" },
  other: { label: "Outil",   icon: Wrench,     color: "text-text-muted border-border-default bg-surface-3/50" },
};

function categoryFor(tool: ToolCall): ToolCall["category"] {
  // Special-case : kb_search avec visibility_filter "private:lea" => archive
  if (tool.category === "kb") {
    const vf = tool.args?.visibility_filter;
    if (typeof vf === "string" && vf.startsWith("private:")) return "kb"; // garde "kb" comme catégorie technique, on labelise différemment plus bas
  }
  return tool.category;
}

function isArchive(tool: ToolCall): boolean {
  if (tool.category !== "kb") return false;
  const vf = tool.args?.visibility_filter;
  return typeof vf === "string" && vf.startsWith("private:");
}

export function SourcesCard({ tools }: { tools?: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!tools || tools.length === 0) {
    return (
      <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 text-[10px] text-text-muted/70 italic">
        <Wrench className="w-3 h-3" />
        Aucun outil externe appelé — réponse depuis le contexte agent
      </div>
    );
  }

  // Compteurs par catégorie (et split kb -> kb / archive)
  const counts: Record<string, number> = {};
  for (const t of tools) {
    const key = isArchive(t) ? "archive" : categoryFor(t);
    counts[key] = (counts[key] || 0) + 1;
  }

  return (
    <div className="mt-3 border border-border-subtle bg-surface-2/50">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-surface-3/40 transition-all"
        title="Détail des outils utilisés pour cette réponse"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
            Sources utilisées · {tools.length}
          </span>
          {Object.entries(counts).map(([key, n]) => {
            const meta =
              key === "archive"
                ? { label: "Archive", icon: Archive, color: "text-violet-300 border-violet-400/30 bg-violet-400/10" }
                : categoryMeta[key as ToolCall["category"]];
            const Icon = meta.icon;
            return (
              <span
                key={key}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight border",
                  meta.color
                )}
              >
                <Icon className="w-3 h-3" />
                {meta.label} ×{n}
              </span>
            );
          })}
        </div>
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-text-muted shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 py-2 border-t border-border-subtle space-y-2">
          {tools.map((t, i) => {
            const archive = isArchive(t);
            const meta = archive
              ? { label: "Archive Léa", icon: Archive, color: "text-violet-300" }
              : { ...categoryMeta[categoryFor(t)], color: categoryMeta[categoryFor(t)].color.split(" ")[0] };
            const Icon = meta.icon;
            return (
              <div key={i} className="text-[11px]">
                <div className={cn("flex items-center gap-1.5 font-mono font-bold", meta.color)}>
                  <Icon className="w-3 h-3" />
                  {t.name}
                  <span className="text-text-muted ml-1 font-sans font-normal italic">
                    {meta.label}
                  </span>
                </div>
                {Object.keys(t.args || {}).length > 0 && (
                  <div className="ml-4 mt-0.5 text-text-muted font-mono text-[10px] space-y-0.5">
                    {Object.entries(t.args).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-text-secondary shrink-0">{k}:</span>
                        <span className="break-all">
                          {typeof v === "string" ? v : JSON.stringify(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
