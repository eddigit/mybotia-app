import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";
import Link from "next/link";
import { AgentOrb } from "@/components/agents/AgentOrb";

const STATUS_LABEL: Record<string, string> = {
  online: "Disponible",
  busy: "Occupe",
  listening: "Ecoute",
  speaking: "Parle",
  thinking: "Reflechit",
  offline: "Hors ligne",
};

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
            className="flex items-center justify-between px-3 py-2.5 hover:bg-surface-3/30 transition-all cursor-pointer group rounded-md"
          >
            <div className="flex items-center gap-3 min-w-0">
              <AgentOrb agent={agent} size="sm" />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-text-primary block truncate">{agent.name}</span>
                <p className="text-[10px] text-text-muted truncate">{agent.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] text-text-muted hidden lg:inline">
                {STATUS_LABEL[agent.status] ?? agent.status}
              </span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1 h-3 rounded-sm",
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
