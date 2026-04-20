"use client";

import Link from "next/link";
import { AgentOrb, AgentWaveform } from "@/components/agents/AgentOrb";
import type { Agent } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  online: "Disponible",
  busy: "Occupe",
  listening: "Ecoute",
  speaking: "Parle",
  thinking: "Reflechit",
  offline: "Hors ligne",
};

/**
 * Horizontal band of agent presence orbs on the command center.
 * Each orb shows photo + signature ring + live status line below.
 */
export function LiveAgentBand({ agents }: { agents: Agent[] }) {
  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="section-header text-sm font-bold tracking-tight uppercase text-text-primary font-headline">
          Equipe en direct
        </h2>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="micro-label text-text-muted">
            {agents.filter((a) => a.status !== "offline").length} actifs
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scroll-smooth">
          {agents.map((agent) => {
            const isSpeaking = agent.status === "speaking";
            const isThinking = agent.status === "thinking";
            return (
              <Link
                key={agent.id}
                href="/agents"
                className={cn(
                  "group flex-shrink-0 w-[220px] card-sharp p-4 transition-all",
                  "hover:border-accent-primary/30"
                )}
                style={{
                  borderTop: `2px solid hsl(${agent.hue ?? 200} 80% 55% / 0.4)`,
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <AgentOrb agent={agent} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-text-primary truncate">
                      {agent.name}
                    </div>
                    <div className="text-[10px] text-text-muted truncate">
                      {agent.role}
                    </div>
                  </div>
                </div>

                {/* Live transcript or status */}
                <div className="min-h-[32px] flex items-center gap-2">
                  {isSpeaking ? (
                    <AgentWaveform active hue={agent.hue ?? 200} />
                  ) : isThinking ? (
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1 h-1 rounded-full bg-accent-primary animate-pulse"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                  ) : null}
                  {agent.liveTranscript && (
                    <p className="text-[11px] text-text-secondary leading-snug line-clamp-2 flex-1">
                      {agent.liveTranscript}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between">
                  <span className="micro-label text-text-muted">
                    {STATUS_LABEL[agent.status] ?? agent.status}
                  </span>
                  {agent.tasksCompleted !== undefined && (
                    <span className="text-[10px] font-mono text-accent-glow">
                      {agent.tasksCompleted}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
