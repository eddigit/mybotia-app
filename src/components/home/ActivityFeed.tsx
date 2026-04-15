import {
  MessageSquare,
  CheckSquare,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Bot,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types";

const typeIcons: Record<string, typeof MessageSquare> = {
  message: MessageSquare,
  task: CheckSquare,
  deal: TrendingUp,
  meeting: Calendar,
  alert: AlertTriangle,
  agent: Bot,
  system: Settings2,
};

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <div className="card-sharp p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="section-header text-sm font-bold tracking-tight uppercase text-text-primary font-headline">
          Flux d&apos;intelligence
        </h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-primary animate-ping" />
          <span className="micro-label text-text-muted">En direct</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="timeline space-y-6">
        {activities.map((activity, i) => {
          const Icon = typeIcons[activity.type] || Settings2;
          const isFirst = i === 0;

          return (
            <div key={activity.id} className="relative pl-8 flex gap-4 group animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              {/* Timeline dot */}
              <div className={cn("timeline-dot", !isFirst && "timeline-dot-muted")}>
                <div className="timeline-dot-inner" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-1 gap-3">
                  <span className="text-sm font-bold text-text-primary">{activity.title}</span>
                  <span className="text-[10px] text-text-muted font-mono shrink-0">
                    {new Date(activity.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {activity.description && (
                  <p className="text-sm text-text-secondary leading-relaxed">{activity.description}</p>
                )}
                {activity.priority === 'high' && (
                  <div className="mt-2 flex gap-2">
                    <span className="px-2 py-0.5 bg-surface-4 text-[10px] text-text-muted font-mono">#{activity.type}</span>
                    <span className="px-2 py-0.5 bg-surface-4 text-[10px] text-text-muted font-mono">#priorite</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
