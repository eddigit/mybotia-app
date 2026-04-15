import { Bot, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";
import Link from "next/link";

export function AgentStatusGrid({ agents }: { agents: Agent[] }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Equipe IA</h3>
        <Link href="/agents" className="text-[10px] text-accent-glow hover:underline flex items-center gap-0.5">
          Tout voir <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {agents.slice(0, 4).map((agent) => (
          <div
            key={agent.id}
            className="flex flex-col items-center gap-2 p-3 rounded-lg bg-surface-2/30 border border-border-subtle hover:border-border-default transition-all cursor-pointer"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary/15 to-accent-secondary/15 border border-white/[0.06] flex items-center justify-center">
                <Bot className="w-5 h-5 text-accent-glow" />
              </div>
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 status-dot",
                `status-dot-${agent.status}`
              )} />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-text-primary">{agent.name}</p>
              <p className="text-[10px] text-text-muted truncate max-w-[100px]">{agent.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
