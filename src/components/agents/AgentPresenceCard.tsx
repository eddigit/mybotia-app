import {
  MessageSquare,
  Phone,
  Send,
  Globe,
  Zap,
  Clock,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";
import { AgentOrb } from "@/components/agents/AgentOrb";

const channelIcons: Record<string, typeof MessageSquare> = {
  whatsapp: Phone,
  telegram: Send,
  webchat: Globe,
  email: MessageSquare,
};

export function AgentPresenceCard({ agent }: { agent: Agent }) {
  return (
    <div className="card-sharp p-6 group">
      {/* Centered presence widget — photo orb */}
      <div className="flex flex-col items-center text-center mb-5">
        <div className="mb-3">
          <AgentOrb agent={agent} size="xl" />
        </div>

        <h3 className="text-base font-extrabold text-text-primary font-headline">{agent.name}</h3>
        <p className="text-xs text-text-secondary mt-0.5">{agent.role}</p>

        {/* Status pill */}
        <div className={cn(
          "mt-2 flex items-center gap-2 py-1 px-3 rounded-full text-[10px] font-bold",
          agent.status === 'online' ? "bg-emerald-400/10 text-emerald-400" :
          agent.status === 'busy' ? "bg-amber-400/10 text-amber-400" :
          agent.status === 'listening' ? "bg-cyan-400/10 text-cyan-400" :
          "bg-surface-4 text-text-muted"
        )}>
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            agent.status === 'online' && "bg-emerald-400 animate-pulse",
            agent.status === 'busy' && "bg-amber-400",
            agent.status === 'listening' && "bg-cyan-400 animate-pulse",
            agent.status === 'offline' && "bg-zinc-500",
          )} />
          {agent.status === 'online' ? 'En ligne' : agent.status === 'busy' ? 'Occupe' : agent.status === 'listening' ? 'Ecoute' : 'Hors ligne'}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-text-secondary leading-relaxed mb-4 text-center">{agent.description}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-3/50">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-headline font-extrabold text-text-primary">{agent.tasksCompleted}</p>
            <p className="micro-label text-text-muted">Taches</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-3/50">
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-headline font-extrabold text-text-primary">{agent.responseTime}</p>
            <p className="micro-label text-text-muted">Reponse</p>
          </div>
        </div>
      </div>

      {/* Specialties */}
      <div className="mb-4">
        <span className="section-title mb-2 block">Specialites</span>
        <div className="flex flex-wrap gap-1">
          {agent.specialties.map((s) => (
            <span key={s} className="px-2 py-0.5 bg-surface-4 text-[10px] text-text-muted font-mono">
              #{s.toLowerCase().replace(/\s/g, '-')}
            </span>
          ))}
        </div>
      </div>

      {/* Channels */}
      <div className="mb-4">
        <span className="section-title mb-2 block">Canaux</span>
        <div className="flex gap-1.5">
          {agent.channels.map((ch) => {
            const Icon = channelIcons[ch] || Globe;
            return (
              <div
                key={ch}
                className="flex items-center justify-center w-8 h-8 bg-surface-3/50 border border-border-subtle"
                title={ch}
              >
                <Icon className="w-3.5 h-3.5 text-text-muted" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Last active */}
      {agent.lastActive && (
        <div className="flex items-center gap-1.5 mb-4 text-[10px] text-text-muted font-mono">
          <Clock className="w-3 h-3" />
          Derniere activite : {new Date(agent.lastActive).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-border-subtle">
        <a
          href="/conversations"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent-primary/10 border border-accent-primary/20 text-accent-glow text-xs font-bold uppercase tracking-wider hover:bg-accent-primary/15 transition-all"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Contacter
        </a>
      </div>
    </div>
  );
}
