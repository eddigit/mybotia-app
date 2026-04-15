import { Bot } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { AgentPresenceCard } from "@/components/agents/AgentPresenceCard";
import { agents } from "@/data/mock";

export default function AgentsPage() {
  const onlineCount = agents.filter(a => a.status === 'online' || a.status === 'listening' || a.status === 'busy').length;
  const totalTasks = agents.reduce((sum, a) => sum + (a.tasksCompleted || 0), 0);

  return (
    <div className="p-8 space-y-8">
      <ModuleHeader
        icon={Bot}
        title="Collaborateurs IA"
        subtitle={`${agents.length} agents · ${onlineCount} en ligne`}
      />

      {/* Status summary — Sovereign style */}
      <div className="card-sharp p-5 flex items-center gap-6">
        {[
          { label: 'En ligne', count: agents.filter(a => a.status === 'online').length, color: 'bg-emerald-400' },
          { label: 'Occupe', count: agents.filter(a => a.status === 'busy').length, color: 'bg-amber-400' },
          { label: 'Ecoute', count: agents.filter(a => a.status === 'listening').length, color: 'bg-cyan-400' },
          { label: 'Hors ligne', count: agents.filter(a => a.status === 'offline').length, color: 'bg-zinc-500' },
        ].filter(s => s.count > 0).map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className={`w-2 h-2 ${s.color}`} />
            <span className="text-xs font-medium text-text-secondary">
              {s.count} {s.label.toLowerCase()}
            </span>
          </div>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-4 p-2 border border-accent-primary/15">
          <div>
            <span className="micro-label text-text-muted">Total taches</span>
            <p className="text-sm font-headline font-extrabold text-text-primary">{totalTasks.toLocaleString()}</p>
          </div>
        </div>
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
