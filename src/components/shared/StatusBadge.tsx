import { cn } from "@/lib/utils";

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
};

const statusColors: Record<string, string> = {
  online: 'text-emerald-400 bg-emerald-400/10',
  active: 'text-emerald-400 bg-emerald-400/10',
  done: 'text-emerald-400 bg-emerald-400/10',
  busy: 'text-amber-400 bg-amber-400/10',
  pending: 'text-amber-400 bg-amber-400/10',
  in_progress: 'text-blue-400 bg-blue-400/10',
  review: 'text-violet-400 bg-violet-400/10',
  offline: 'text-zinc-400 bg-zinc-400/10',
  archived: 'text-zinc-400 bg-zinc-400/10',
  blocked: 'text-red-400 bg-red-400/10',
  critical: 'text-red-400 bg-red-400/10',
  high: 'text-orange-400 bg-orange-400/10',
  medium: 'text-amber-400 bg-amber-400/10',
  low: 'text-zinc-400 bg-zinc-400/10',
  prospect: 'text-blue-400 bg-blue-400/10',
  onboarding: 'text-cyan-400 bg-cyan-400/10',
  churned: 'text-red-400 bg-red-400/10',
  listening: 'text-cyan-400 bg-cyan-400/10',
  speaking: 'text-violet-400 bg-violet-400/10',
};

const dotColors: Record<string, string> = {
  online: 'bg-emerald-400',
  active: 'bg-emerald-400',
  done: 'bg-emerald-400',
  busy: 'bg-amber-400',
  pending: 'bg-amber-400',
  in_progress: 'bg-blue-400',
  review: 'bg-violet-400',
  blocked: 'bg-red-400',
  critical: 'bg-red-400',
  prospect: 'bg-blue-400',
  onboarding: 'bg-cyan-400',
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
  const color = statusColors[status] || 'text-zinc-400 bg-zinc-400/10';

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 font-bold uppercase tracking-tight",
      color,
      size === 'xs' && "text-[9px] px-1.5 py-0.5",
      size === 'sm' && "text-[10px] px-2 py-0.5",
      size === 'md' && "text-[10px] px-2.5 py-1",
    )}>
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full", dotColors[status] || "bg-zinc-500")} />
      )}
      {label}
    </span>
  );
}
