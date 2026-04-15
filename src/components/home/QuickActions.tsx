import {
  MessageSquare,
  UserPlus,
  Plus,
  FileUp,
  Calendar,
  BarChart3,
  ChevronRight,
} from "lucide-react";

const actions = [
  { id: 'new-conv', label: 'Nouvelle conversation', icon: MessageSquare },
  { id: 'new-contact', label: 'Ajouter un contact', icon: UserPlus },
  { id: 'new-task', label: 'Creer une tache', icon: Plus },
  { id: 'upload', label: 'Importer un document', icon: FileUp },
  { id: 'meeting', label: 'Planifier un rendez-vous', icon: Calendar },
  { id: 'report', label: 'Generer un rapport', icon: BarChart3 },
];

export function QuickActions() {
  return (
    <div className="card-sharp-high p-5">
      <h3 className="section-title mb-4">Commandes rapides</h3>
      <div className="space-y-1">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              className="w-full text-left px-4 py-3 bg-surface-1 hover:bg-surface-3/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-text-muted group-hover:text-accent-glow transition-colors" />
                <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                  {action.label}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent-glow transition-colors" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
