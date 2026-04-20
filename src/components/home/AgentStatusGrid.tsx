import { Bot, ChevronRight, Zap, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";
import Link from "next/link";

export function AgentStatusGrid({ agents }: { agents: Agent[] }) {
  return (
    <div className="card-sharp p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-header text-xs font-bold tracking-tight uppercase text-text-primary font-headline">
          Equipe IA
        </h3>
        <Link href="/agents" className="micro-label text-accent-glow hover:underline flex items-center gap-0.5">
          Tout voir <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-1">
        {agents.slice(0, 5).map((agent) => (
          <Link
            key={agent.id}
            href="/agents"
            className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-3/30 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-accent-glow" />
                </div>
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full",
                  agent.status === 'online' && "bg-emerald-400",
                  agent.status === 'busy' && "bg-amber-400",
                  agent.status === 'listening' && "bg-cyan-400",
                  agent.status === 'offline' && "bg-zinc-500",
                )} />
              </div>
              <div>
                <span className="text-xs font-semibold text-text-primary">{agent.name}</span>
                <p className="text-[10px] text-text-muted">{agent.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {agent.tasksCompleted && (
                <span className="text-[10px] text-text-muted font-mono">{agent.tasksCompleted}</span>
              )}
              <div className="flex gap-0.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1 h-3",
                      i <= (agent.status === 'online' ? 4 : agent.status === 'busy' ? 3 : agent.status === 'listening' ? 2 : 1)
                        ? "bg-accent-primary"
                        : "bg-surface-3/30"
                    )}
                  />
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
