"use client";

import { useState } from "react";
import {
  X,
  Mic,
  MicOff,
  Bot,
  FileText,
  CheckSquare,
  ChevronRight,
  Zap,
  Clock,
  TrendingUp,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { agents, tasks, insights } from "@/data/mock";

type TabId = 'suggestions' | 'activity' | 'tasks';

export function ContextRail({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>('suggestions');
  const activeAgent = agents[0]; // Lea as default

  const tabs: { id: TabId; label: string }[] = [
    { id: 'suggestions', label: 'Suggestions' },
    { id: 'activity', label: 'Activite' },
    { id: 'tasks', label: 'Taches' },
  ];

  return (
    <aside className="w-[320px] h-full bg-surface-1/90 backdrop-blur-xl flex flex-col shrink-0 animate-slide-in-right shadow-[-20px_0_40px_rgba(99,102,241,0.03)]">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-accent-glow font-extrabold font-headline text-sm">IA Insights</h3>
            <p className="micro-label text-text-muted mt-0.5">Analyse active</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-1 p-1 rounded-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold uppercase tracking-tight rounded-sm transition-all",
                activeTab === tab.id
                  ? "bg-accent-primary/10 text-accent-glow"
                  : "text-text-muted hover:bg-surface-3/50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Presence Widget — centered, Jarvis style */}
      <div className="px-6 pb-6 flex flex-col items-center text-center border-b border-white/[0.04]">
        <div className="relative mb-4">
          {/* Outer ring */}
          <div className="w-20 h-20 rounded-full bg-accent-primary/10 flex items-center justify-center border border-accent-primary/20">
            {/* Inner core */}
            <div className="w-14 h-14 rounded-full bg-accent-primary flex items-center justify-center animate-glow-breathe">
              <Bot className="w-7 h-7 text-white" />
            </div>
          </div>
          {/* Pulse ring */}
          <div className="absolute inset-0 rounded-full border border-accent-primary/20 animate-pulse-ring" />
        </div>
        <h3 className="text-sm font-bold text-text-primary font-headline">{activeAgent.name} est en ligne</h3>
        <p className="text-xs text-text-secondary mt-1 mb-3">{activeAgent.role}</p>

        {/* Voice + quick input */}
        <div className="flex items-center gap-2 w-full">
          <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent-primary/10 border border-accent-primary/20 text-accent-glow text-xs font-bold hover:bg-accent-primary/15 transition-all">
            <Mic className="w-3.5 h-3.5" />
            Parler
          </button>
          <button className="flex items-center justify-center w-9 h-9 bg-surface-3 border border-white/[0.06] text-text-muted hover:text-text-primary transition-all">
            <MicOff className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Accuracy indicator */}
        <div className="mt-3 flex items-center gap-2 py-1.5 px-3 bg-surface-2 rounded-full text-[10px] font-bold text-accent-glow">
          <Zap className="w-3 h-3" />
          7 AGENTS ACTIFS
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'suggestions' && (
          <div className="p-6 space-y-4">
            {insights.map((insight, i) => (
              <div
                key={insight.id}
                className={cn(
                  "p-4 bg-surface-3/50 border animate-fade-in",
                  insight.priority === 'high'
                    ? "border-l-4 border-l-accent-primary border-t-white/[0.04] border-r-white/[0.04] border-b-white/[0.04]"
                    : "border-white/[0.04] border-l-4 border-l-white/[0.08]"
                )}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className={cn("w-3.5 h-3.5", insight.priority === 'high' ? "text-accent-glow" : "text-text-muted")} />
                  <span className={cn("micro-label", insight.priority === 'high' ? "text-accent-glow" : "text-text-muted")}>
                    {insight.type === 'recommendation' ? 'Recommandation' : insight.type === 'alert' ? 'Alerte' : 'Opportunite'}
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed mb-2">{insight.description}</p>
                {insight.actionLabel && (
                  <button className="micro-label text-text-muted hover:text-text-primary transition-colors flex items-center gap-1">
                    {insight.actionLabel}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="p-6">
            <h4 className="section-title mb-4">Taches en cours</h4>
            <div className="space-y-2">
              {tasks
                .filter(t => t.status !== 'done')
                .slice(0, 5)
                .map((task) => (
                  <button
                    key={task.id}
                    className="w-full text-left px-4 py-3 bg-surface-1 hover:bg-surface-3/50 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        task.priority === 'critical' && "bg-red-400",
                        task.priority === 'high' && "bg-orange-400",
                        task.priority === 'medium' && "bg-amber-400",
                        task.priority === 'low' && "bg-zinc-400",
                      )} />
                      <span className="text-xs text-text-secondary truncate">{task.title}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-glow shrink-0 transition-colors" />
                  </button>
                ))}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-6">
            <h4 className="section-title mb-4">Documents recents</h4>
            <div className="space-y-2">
              {[
                { name: "Devis Systemic v2.pdf", time: "Il y a 2h" },
                { name: "CR reunion IGH.docx", time: "Hier" },
                { name: "Pipeline Q2 2026.xlsx", time: "12 avr" },
              ].map((doc) => (
                <button
                  key={doc.name}
                  className="w-full text-left px-4 py-3 bg-surface-1 hover:bg-surface-3/50 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="text-xs text-text-secondary truncate">{doc.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-text-muted shrink-0">
                    <Clock className="w-2.5 h-2.5" />
                    {doc.time}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom latency indicator */}
      <div className="p-4 bg-surface-1/50">
        <div className="flex items-center gap-4 p-3 border border-accent-primary/15 rounded-lg">
          <Zap className="w-4 h-4 text-accent-glow" />
          <div>
            <div className="micro-label text-text-muted">Latence</div>
            <div className="text-sm font-bold text-text-primary">
              &lt; 3s <span className="text-emerald-400 text-xs">Stable</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
