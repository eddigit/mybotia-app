import { Lightbulb, AlertTriangle, TrendingUp, Info, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Insight } from "@/types";

const typeConfig: Record<string, { icon: typeof Lightbulb; label: string }> = {
  recommendation: { icon: Lightbulb, label: 'Suggestion' },
  alert: { icon: AlertTriangle, label: 'Alerte' },
  opportunity: { icon: TrendingUp, label: 'Opportunite' },
  info: { icon: Info, label: 'Info' },
};

export function InsightCard({ insight }: { insight: Insight }) {
  const config = typeConfig[insight.type] || typeConfig.info;
  const Icon = config.icon;
  const isHigh = insight.priority === 'high';

  return (
    <div className={cn(
      "p-5 group transition-all",
      isHigh
        ? "bg-surface-1 border-l-4 border-l-accent-primary border-t border-r border-b border-white/[0.04]"
        : "bg-surface-1 border-l-4 border-l-white/[0.08] border-t border-r border-b border-white/[0.04]"
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("w-3.5 h-3.5", isHigh ? "text-accent-glow" : "text-text-muted")} />
        <span className={cn("micro-label", isHigh ? "text-accent-glow" : "text-text-muted")}>
          {config.label}
        </span>
      </div>

      <p className="text-sm font-medium leading-relaxed text-text-primary mb-3">
        {insight.description}
      </p>

      <div className="flex items-center justify-between">
        {insight.agentName && (
          <span className="text-[10px] text-text-muted">
            via <span className="text-accent-glow font-semibold">{insight.agentName}</span>
          </span>
        )}
        {insight.actionLabel && (
          <span className="micro-label text-text-muted flex items-center gap-1">
            {insight.actionLabel}
          </span>
        )}
      </div>
    </div>
  );
}
