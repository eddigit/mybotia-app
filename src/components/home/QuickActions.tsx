import {
  Plus,
  MessageSquare,
  UserPlus,
  FileUp,
  Calendar,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  { id: 'new-conv', label: 'Nouvelle conversation', icon: MessageSquare, color: 'text-blue-400 bg-blue-400/10' },
  { id: 'new-contact', label: 'Ajouter un contact', icon: UserPlus, color: 'text-emerald-400 bg-emerald-400/10' },
  { id: 'new-task', label: 'Creer une tache', icon: Plus, color: 'text-amber-400 bg-amber-400/10' },
  { id: 'upload', label: 'Importer un document', icon: FileUp, color: 'text-violet-400 bg-violet-400/10' },
  { id: 'meeting', label: 'Planifier un RDV', icon: Calendar, color: 'text-cyan-400 bg-cyan-400/10' },
  { id: 'report', label: 'Generer un rapport', icon: BarChart3, color: 'text-rose-400 bg-rose-400/10' },
];

export function QuickActions() {
  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Acces rapides</h3>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-surface-2/50 border border-border-subtle hover:border-border-default hover:bg-surface-2 transition-all text-left group"
            >
              <div className={cn("flex items-center justify-center w-7 h-7 rounded-lg shrink-0", action.color)}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
