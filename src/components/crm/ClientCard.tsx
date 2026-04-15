import { Building2, Mail, Phone, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Client } from "@/types";

export function ClientCard({ client }: { client: Client }) {
  return (
    <div className="glass-card p-4 cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary/10 to-accent-secondary/10 border border-white/[0.06]">
            <Building2 className="w-5 h-5 text-accent-glow" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent-glow transition-colors">
              {client.company}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <User className="w-3 h-3 text-text-muted" />
              <span className="text-xs text-text-secondary">{client.name}</span>
            </div>
          </div>
        </div>
        <StatusBadge status={client.status} size="xs" dot />
      </div>

      {client.revenue !== undefined && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-surface-2/50 border border-border-subtle">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Revenu annuel</span>
          <p className="text-lg font-semibold text-text-primary mt-0.5">
            {formatCurrency(client.revenue)}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        {client.email && (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Mail className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="truncate">{client.email}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Phone className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span>{client.phone}</span>
          </div>
        )}
        {client.lastContact && (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Calendar className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span>Dernier contact : {new Date(client.lastContact).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
          </div>
        )}
      </div>

      {client.tags && client.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {client.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] bg-surface-3 text-text-muted border border-border-subtle">
              {tag}
            </span>
          ))}
        </div>
      )}

      {client.assignedAgent && (
        <div className="mt-3 pt-3 border-t border-border-subtle flex items-center gap-2">
          <span className="text-[10px] text-text-muted">Agent :</span>
          <span className="text-[11px] text-accent-glow font-medium">{client.assignedAgent}</span>
        </div>
      )}
    </div>
  );
}
