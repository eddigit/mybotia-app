import { cn } from "@/lib/utils";
import { getStatusColor, getStatusBgColor } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  online: 'En ligne',
  busy: 'Occupe',
  offline: 'Hors ligne',
  listening: 'Ecoute',
  speaking: 'Parle',
  active: 'Actif',
  pending: 'En attente',
  resolved: 'Resolu',
  archived: 'Archive',
  todo: 'A faire',
  in_progress: 'En cours',
  review: 'En revue',
  done: 'Termine',
  blocked: 'Bloque',
  critical: 'Critique',
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
  prospect: 'Prospect',
  onboarding: 'Onboarding',
  churned: 'Perdu',
  discovery: 'Decouverte',
  proposal: 'Proposition',
  negotiation: 'Negociation',
  closing: 'Closing',
  won: 'Gagne',
  lost: 'Perdu',
};

export function StatusBadge({
  status,
  size = 'sm',
  dot = false,
}: {
  status: string;
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
}) {
  const label = statusLabels[status] || status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        getStatusBgColor(status),
        getStatusColor(status),
        size === 'xs' && "text-[10px] px-1.5 py-0",
        size === 'sm' && "text-[11px] px-2 py-0.5",
        size === 'md' && "text-xs px-2.5 py-1",
      )}
    >
      {dot && (
        <span className={cn(
          "w-1.5 h-1.5 rounded-full",
          status === 'online' || status === 'active' || status === 'done' ? "bg-emerald-400" :
          status === 'busy' || status === 'pending' || status === 'in_progress' ? "bg-amber-400" :
          status === 'offline' || status === 'archived' ? "bg-zinc-500" :
          status === 'blocked' || status === 'critical' || status === 'churned' ? "bg-red-400" :
          "bg-blue-400"
        )} />
      )}
      {label}
    </span>
  );
}
