import { Bot } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { AgentPresenceCard } from "@/components/agents/AgentPresenceCard";
import { agents } from "@/data/mock";

export default function AgentsPage() {
  const onlineCount = agents.filter(a => a.status === 'online' || a.status === 'listening' || a.status === 'busy').length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <ModuleHeader
        icon={Bot}
        title="Collaborateurs IA"
        subtitle={`${agents.length} agents · ${onlineCount} en ligne`}
      />

      {/* Status summary strip */}
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl glass-card">
        {[
          { label: 'En ligne', count: agents.filter(a => a.status === 'online').length, color: 'bg-emerald-400' },
          { label: 'Occupe', count: agents.filter(a => a.status === 'busy').length, color: 'bg-amber-400' },
          { label: 'Ecoute', count: agents.filter(a => a.status === 'listening').length, color: 'bg-cyan-400' },
          { label: 'Hors ligne', count: agents.filter(a => a.status === 'offline').length, color: 'bg-zinc-500' },
        ].filter(s => s.count > 0).map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${s.color}`} />
            <span className="text-xs text-text-secondary">
              {s.count} {s.label.toLowerCase()}
            </span>
          </div>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-text-muted">
          Total taches completees : {agents.reduce((sum, a) => sum + (a.tasksCompleted || 0), 0).toLocaleString()}
        </span>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {agents.map((agent) => (
          <AgentPresenceCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
