import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin}min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    online: 'text-emerald-400',
    active: 'text-emerald-400',
    busy: 'text-amber-400',
    pending: 'text-amber-400',
    in_progress: 'text-blue-400',
    offline: 'text-zinc-500',
    resolved: 'text-zinc-400',
    blocked: 'text-red-400',
    critical: 'text-red-400',
    high: 'text-orange-400',
    medium: 'text-amber-400',
    low: 'text-zinc-400',
    listening: 'text-cyan-400',
    speaking: 'text-violet-400',
    prospect: 'text-blue-400',
    onboarding: 'text-cyan-400',
    churned: 'text-red-400',
  };
  return colors[status] || 'text-zinc-400';
}

export function getStatusBgColor(status: string): string {
  const colors: Record<string, string> = {
    online: 'bg-emerald-400/10 border-emerald-400/20',
    active: 'bg-emerald-400/10 border-emerald-400/20',
    busy: 'bg-amber-400/10 border-amber-400/20',
    pending: 'bg-amber-400/10 border-amber-400/20',
    in_progress: 'bg-blue-400/10 border-blue-400/20',
    offline: 'bg-zinc-500/10 border-zinc-500/20',
    blocked: 'bg-red-400/10 border-red-400/20',
    critical: 'bg-red-400/10 border-red-400/20',
    high: 'bg-orange-400/10 border-orange-400/20',
    medium: 'bg-amber-400/10 border-amber-400/20',
    low: 'bg-zinc-400/10 border-zinc-400/20',
    prospect: 'bg-blue-400/10 border-blue-400/20',
    onboarding: 'bg-cyan-400/10 border-cyan-400/20',
    churned: 'bg-red-400/10 border-red-400/20',
  };
  return colors[status] || 'bg-zinc-400/10 border-zinc-400/20';
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
