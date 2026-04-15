import Link from "next/link";
import {
  MessagesSquare,
  BarChart3,
  CheckSquare,
  FileText,
  Bot,
  ChevronRight,
} from "lucide-react";

const actions = [
  { id: 'conv', label: 'Conversations', icon: MessagesSquare, href: '/conversations' },
  { id: 'crm', label: 'CRM / Clients', icon: BarChart3, href: '/crm' },
  { id: 'tasks', label: 'Taches & Projets', icon: CheckSquare, href: '/tasks' },
  { id: 'agents', label: 'Agents IA', icon: Bot, href: '/agents' },
  { id: 'docs', label: 'Documents', icon: FileText, href: '/documents' },
];

export function QuickActions() {
  return (
    <div className="card-sharp-high p-5">
      <h3 className="section-title mb-4">Acces rapide</h3>
      <div className="space-y-1">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.id}
              href={action.href}
              className="w-full text-left px-4 py-3 bg-surface-1 hover:bg-surface-3/50 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-text-muted group-hover:text-accent-glow transition-colors" />
                <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                  {action.label}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent-glow transition-colors" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
