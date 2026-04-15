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
import { formatRelativeTime } from "@/lib/utils";
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

const typeColors: Record<string, string> = {
  message: "text-blue-400 bg-blue-400/10",
  task: "text-emerald-400 bg-emerald-400/10",
  deal: "text-amber-400 bg-amber-400/10",
  meeting: "text-violet-400 bg-violet-400/10",
  alert: "text-red-400 bg-red-400/10",
  agent: "text-cyan-400 bg-cyan-400/10",
  system: "text-zinc-400 bg-zinc-400/10",
};

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Activite recente</h3>
        <button className="text-[10px] text-accent-glow hover:underline">Tout voir</button>
      </div>
      <div className="space-y-1">
        {activities.map((activity, i) => {
          const Icon = typeIcons[activity.type] || Settings2;
          const color = typeColors[activity.type] || typeColors.system;

          return (
            <div
              key={activity.id}
              className={cn(
                "flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-white/[0.02] transition-colors cursor-pointer",
                i === 0 && "animate-fade-in"
              )}
            >
              <div className={cn("flex items-center justify-center w-7 h-7 rounded-lg shrink-0 mt-0.5", color)}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary leading-snug">{activity.title}</p>
                {activity.description && (
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">{activity.description}</p>
                )}
              </div>
              <span className="text-[10px] text-text-muted shrink-0 mt-0.5">
                {formatRelativeTime(activity.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
