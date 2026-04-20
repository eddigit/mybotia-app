"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MoreVertical,
  Mic,
  MicOff,
  Zap,
  ChevronRight,
  TrendingUp,
  FileText,
  Clock,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { agents, tasks, insights } from "@/data/mock";
import { AgentOrb, AgentWaveform } from "@/components/agents/AgentOrb";

type TabId = "suggestions" | "activity" | "tasks";

export function ContextRail({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("suggestions");
  const [activeAgentId, setActiveAgentId] = useState<string>(agents[0].id);
  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? agents[0];

  const tabs: { id: TabId; label: string }[] = [
    { id: "suggestions", label: "Insights" },
    { id: "activity", label: "Activite" },
    { id: "tasks", label: "Taches" },
  ];

  const isSpeaking = activeAgent.status === "speaking";
  const isThinking = activeAgent.status === "thinking";
  const isListening = activeAgent.status === "listening";
  const hue = activeAgent.hue ?? 200;

  return (
    <aside className="w-[340px] h-full bg-surface-1/90 backdrop-blur-xl flex flex-col shrink-0 animate-slide-in-right border-l border-border-subtle">
      {/* Header */}
      <div className="p-5 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-accent-glow font-extrabold font-headline text-sm">
              Agent en direct
            </h3>
            <p className="micro-label text-text-muted mt-0.5">
              Presence MyBotIA
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active agent — Jarvis style */}
      <div
        className="px-5 py-6 flex flex-col items-center text-center border-b border-border-subtle relative overflow-hidden"
        style={{
          background: `radial-gradient(ellipse at top, hsl(${hue} 90% 55% / 0.08), transparent 70%)`,
        }}
      >
        <AgentOrb agent={activeAgent} size="xl" showPulse />

        <h3 className="mt-4 text-base font-bold text-text-primary font-headline">
          {activeAgent.name}
        </h3>
        <p className="text-xs text-text-secondary mt-0.5">{activeAgent.role}</p>

        {/* Live state line */}
        <div className="mt-3 flex items-center justify-center gap-2 min-h-[20px]">
          {isSpeaking && <AgentWaveform active hue={hue} />}
          {isThinking && (
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          )}
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              isSpeaking && "text-violet-400",
              isThinking && "text-accent-glow",
              isListening && "text-cyan-400",
              !isSpeaking && !isThinking && !isListening && "text-emerald-400"
            )}
          >
            {isSpeaking
              ? "Parle"
              : isThinking
              ? "Reflechit"
              : isListening
              ? "Ecoute"
              : activeAgent.status === "busy"
              ? "Occupe"
              : "Disponible"}
          </span>
        </div>

        {/* Live transcript */}
        {activeAgent.liveTranscript && (
          <p className="mt-3 text-xs text-text-secondary italic leading-relaxed max-w-[240px]">
            &ldquo;{activeAgent.liveTranscript}&rdquo;
          </p>
        )}

        {/* Talk / mute */}
        <div className="mt-4 flex items-center gap-2 w-full">
          <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent-primary/10 border border-accent-primary/20 text-accent-glow text-xs font-bold hover:bg-accent-primary/15 transition-all rounded-md">
            <Mic className="w-3.5 h-3.5" />
            Parler
          </button>
          <button className="flex items-center justify-center w-10 h-10 bg-surface-3 border border-border-subtle text-text-muted hover:text-text-primary transition-all rounded-md">
            <MicOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Other agents — mini strip */}
      <div className="px-5 py-4 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-3">
          <span className="section-title">Equipe</span>
          <Link
            href="/agents"
            className="micro-label text-accent-glow hover:underline"
          >
            Tout voir
          </Link>
        </div>
        <div className="flex gap-2 flex-wrap">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setActiveAgentId(agent.id)}
              className={cn(
                "relative rounded-full transition-all",
                agent.id === activeAgentId
                  ? "ring-2 ring-accent-primary ring-offset-2 ring-offset-surface-1 scale-110"
                  : "opacity-70 hover:opacity-100"
              )}
              title={`${agent.name} — ${agent.role}`}
            >
              <AgentOrb agent={agent} size="sm" showPulse={false} />
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 pt-4">
        <div className="flex gap-1 bg-surface-2 p-1 rounded-md">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold uppercase tracking-tight rounded transition-all",
                activeTab === tab.id
                  ? "bg-accent-primary/15 text-accent-glow"
                  : "text-text-muted hover:bg-surface-3/50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "suggestions" && (
          <div className="p-5 space-y-3">
            {insights.map((insight, i) => (
              <div
                key={insight.id}
                className={cn(
                  "p-3 bg-surface-2 border animate-fade-in rounded-md",
                  insight.priority === "high"
                    ? "border-l-4 border-l-accent-primary border-y-border-subtle border-r-border-subtle"
                    : "border-border-subtle"
                )}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <TrendingUp
                    className={cn(
                      "w-3 h-3",
                      insight.priority === "high"
                        ? "text-accent-glow"
                        : "text-text-muted"
                    )}
                  />
                  <span
                    className={cn(
                      "micro-label",
                      insight.priority === "high"
                        ? "text-accent-glow"
                        : "text-text-muted"
                    )}
                  >
                    {insight.type === "recommendation"
                      ? "Recommandation"
                      : insight.type === "alert"
                      ? "Alerte"
                      : "Opportunite"}
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed mb-2">
                  {insight.description}
                </p>
                {insight.agentName && (
                  <p className="text-[10px] text-text-muted">
                    via{" "}
                    <span className="text-accent-glow font-semibold">
                      {insight.agentName}
                    </span>
                  </p>
                )}
                {insight.actionLabel && (
                  <button className="mt-2 micro-label text-text-muted hover:text-accent-glow transition-colors flex items-center gap-1">
                    {insight.actionLabel}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="p-5">
            <div className="space-y-1.5">
              {tasks
                .filter((t) => t.status !== "done")
                .slice(0, 6)
                .map((task) => (
                  <Link
                    key={task.id}
                    href="/tasks"
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-surface-2 hover:bg-surface-3 transition-all rounded-md group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          task.priority === "critical" && "bg-red-400",
                          task.priority === "high" && "bg-orange-400",
                          task.priority === "medium" && "bg-amber-400",
                          task.priority === "low" && "bg-zinc-400"
                        )}
                      />
                      <span className="text-xs text-text-secondary truncate">
                        {task.title}
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-glow shrink-0 transition-colors" />
                  </Link>
                ))}
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="p-5">
            <h4 className="section-title mb-3">Documents recents</h4>
            <div className="space-y-1.5">
              {[
                { name: "Devis Systemic v2.pdf", time: "Il y a 2h" },
                { name: "CR reunion IGH.docx", time: "Hier" },
                { name: "Pipeline Q2 2026.xlsx", time: "12 avr" },
              ].map((doc) => (
                <Link
                  key={doc.name}
                  href="/documents"
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-surface-2 hover:bg-surface-3 transition-all rounded-md group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="text-xs text-text-secondary truncate">
                      {doc.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-text-muted shrink-0">
                    <Clock className="w-2.5 h-2.5" />
                    {doc.time}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom latency indicator */}
      <div className="p-4 border-t border-border-subtle">
        <div className="flex items-center gap-3 p-3 border border-accent-primary/15 rounded-md bg-accent-primary/5">
          <Zap className="w-4 h-4 text-accent-glow" />
          <div className="flex-1">
            <div className="micro-label text-text-muted">Latence</div>
            <div className="text-sm font-bold text-text-primary">
              &lt; 3s{" "}
              <span className="text-emerald-400 text-[10px] font-normal">
                Stable
              </span>
            </div>
          </div>
          <Bot className="w-4 h-4 text-text-muted" />
        </div>
      </div>
    </aside>
  );
}
