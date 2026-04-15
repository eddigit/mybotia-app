"use client";

import {
  X,
  Mic,
  MicOff,
  Bot,
  FileText,
  CheckSquare,
  ChevronRight,
  Sparkles,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { agents, tasks, insights } from "@/data/mock";

export function ContextRail({ onClose }: { onClose: () => void }) {
  const activeAgent = agents[0]; // Lea as default context agent

  return (
    <aside className="w-[320px] h-full border-l border-border-subtle bg-surface-1 flex flex-col shrink-0 animate-slide-in-right">
      {/* Agent header */}
      <div className="px-4 py-4 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium">
            Agent contextuel
          </span>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 border border-accent-primary/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-accent-glow" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 status-dot status-dot-online" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">{activeAgent.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                En ligne
              </span>
            </div>
            <span className="text-xs text-text-secondary">{activeAgent.role}</span>
          </div>
        </div>

        {/* Voice control */}
        <div className="mt-3 flex items-center gap-2">
          <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-accent-primary/10 border border-accent-primary/20 text-accent-glow text-xs font-medium hover:bg-accent-primary/15 transition-all">
            <Mic className="w-3.5 h-3.5" />
            Parler a {activeAgent.name}
          </button>
          <button className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-3 border border-border-subtle text-text-muted hover:text-text-primary transition-all">
            <MicOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Context summary */}
        <div className="px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-accent-glow" />
            <span className="text-xs font-medium text-text-primary">Resume contextuel</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            3 conversations actives dont 1 prioritaire (Systemic). Demo MVP prevue demain.
            2 taches critiques en cours. Pipeline commercial a 27 840 EUR.
          </p>
        </div>

        {/* Suggestions */}
        <div className="px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-primary">Suggestions</span>
            <span className="text-[10px] text-text-muted">{insights.length}</span>
          </div>
          <div className="space-y-2">
            {insights.map((insight) => (
              <button
                key={insight.id}
                className="w-full text-left p-2.5 rounded-lg bg-surface-2/50 border border-border-subtle hover:border-border-default transition-all group"
              >
                <div className="flex items-start gap-2">
                  <div className={cn(
                    "mt-0.5 w-1.5 h-1.5 rounded-full shrink-0",
                    insight.priority === 'high' ? "bg-orange-400" : "bg-blue-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary leading-snug">{insight.title}</p>
                    <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">{insight.description}</p>
                    {insight.actionLabel && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-accent-glow font-medium group-hover:underline">
                        {insight.actionLabel}
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Related tasks */}
        <div className="px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs font-medium text-text-primary">Taches liees</span>
            </div>
            <span className="text-[10px] text-text-muted">
              {tasks.filter(t => t.status !== 'done').length}
            </span>
          </div>
          <div className="space-y-1">
            {tasks
              .filter(t => t.status !== 'done')
              .slice(0, 4)
              .map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded text-xs hover:bg-white/[0.02] transition-colors"
                >
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    task.priority === 'critical' && "bg-red-400",
                    task.priority === 'high' && "bg-orange-400",
                    task.priority === 'medium' && "bg-amber-400",
                    task.priority === 'low' && "bg-zinc-400",
                  )} />
                  <span className="text-text-secondary truncate flex-1">{task.title}</span>
                  <span className="text-[10px] text-text-muted shrink-0">{task.assignee}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Recent documents */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-xs font-medium text-text-primary">Documents recents</span>
            </div>
          </div>
          <div className="space-y-1">
            {[
              { name: "Devis Systemic v2.pdf", time: "Il y a 2h" },
              { name: "CR reunion IGH.docx", time: "Hier" },
              { name: "Pipeline Q2 2026.xlsx", time: "12 avr" },
            ].map((doc) => (
              <div
                key={doc.name}
                className="flex items-center gap-2 py-1.5 px-2 rounded text-xs hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span className="text-text-secondary truncate flex-1">{doc.name}</span>
                <div className="flex items-center gap-1 text-[10px] text-text-muted shrink-0">
                  <Clock className="w-2.5 h-2.5" />
                  {doc.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick input */}
      <div className="px-3 py-3 border-t border-border-subtle">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-border-subtle text-sm">
          <input
            type="text"
            placeholder={`Demander a ${activeAgent.name}...`}
            className="flex-1 bg-transparent outline-none text-xs text-text-primary placeholder:text-text-muted"
          />
          <Sparkles className="w-3.5 h-3.5 text-accent-primary/50" />
        </div>
      </div>
    </aside>
  );
}
