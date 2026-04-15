import {
  Bot,
  MessageSquare,
  Phone,
  Send,
  Globe,
  Zap,
  Clock,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VoiceControlButton } from "@/components/shared/VoiceControlButton";
import type { Agent } from "@/types";

const channelIcons: Record<string, typeof MessageSquare> = {
  whatsapp: Phone,
  telegram: Send,
  webchat: Globe,
  email: MessageSquare,
};

export function AgentPresenceCard({ agent }: { agent: Agent }) {
  return (
    <div className="glass-card p-5 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 border border-accent-primary/20 flex items-center justify-center group-hover:border-accent-primary/40 transition-all">
              <Bot className="w-6 h-6 text-accent-glow" />
            </div>
            <div className={cn(
              "absolute -bottom-0.5 -right-0.5 status-dot",
              `status-dot-${agent.status}`
            )} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{agent.name}</h3>
            <p className="text-xs text-text-secondary">{agent.role}</p>
          </div>
        </div>
        <StatusBadge status={agent.status} size="sm" dot />
      </div>

      {/* Description */}
      <p className="text-xs text-text-muted leading-relaxed mb-4">{agent.description}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2/50 border border-border-subtle">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-text-primary">{agent.tasksCompleted}</p>
            <p className="text-[9px] text-text-muted">Taches</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2/50 border border-border-subtle">
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-text-primary">{agent.responseTime}</p>
            <p className="text-[9px] text-text-muted">Reponse</p>
          </div>
        </div>
      </div>

      {/* Specialties */}
      <div className="mb-4">
        <span className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 block">Specialites</span>
        <div className="flex flex-wrap gap-1">
          {agent.specialties.map((s) => (
            <span key={s} className="px-2 py-0.5 rounded-full text-[10px] bg-accent-primary/5 text-accent-glow border border-accent-primary/10">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Channels */}
      <div className="mb-4">
        <span className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 block">Canaux</span>
        <div className="flex gap-2">
          {agent.channels.map((ch) => {
            const Icon = channelIcons[ch] || Globe;
            return (
              <div
                key={ch}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-surface-3 border border-border-subtle"
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
        <div className="flex items-center gap-1.5 mb-4 text-[10px] text-text-muted">
          <Clock className="w-3 h-3" />
          <span>
            Derniere activite : {new Date(agent.lastActive).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-border-subtle">
        <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-accent-primary/10 border border-accent-primary/20 text-accent-glow text-xs font-medium hover:bg-accent-primary/15 transition-all">
          <MessageSquare className="w-3.5 h-3.5" />
          Contacter
        </button>
        <VoiceControlButton agentName={agent.name} compact />
      </div>
    </div>
  );
}
