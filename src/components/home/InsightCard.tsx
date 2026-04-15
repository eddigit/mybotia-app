import { Lightbulb, AlertTriangle, TrendingUp, Info, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Insight } from "@/types";

const typeConfig: Record<string, { icon: typeof Lightbulb; color: string }> = {
  recommendation: { icon: Lightbulb, color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  alert: { icon: AlertTriangle, color: "text-red-400 bg-red-400/10 border-red-400/20" },
  opportunity: { icon: TrendingUp, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  info: { icon: Info, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
};

export function InsightCard({ insight }: { insight: Insight }) {
  const config = typeConfig[insight.type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <div className="glass-card p-4 group cursor-pointer">
      <div className="flex items-start gap-3">
        <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg border shrink-0", config.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-xs font-semibold text-text-primary">{insight.title}</h4>
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed mb-2">
            {insight.description}
          </p>
          <div className="flex items-center justify-between">
            {insight.agentName && (
              <span className="text-[10px] text-text-muted">
                via <span className="text-accent-glow">{insight.agentName}</span>
              </span>
            )}
            {insight.actionLabel && (
              <span className="inline-flex items-center gap-1 text-[11px] text-accent-glow font-medium group-hover:underline">
                {insight.actionLabel}
                <ChevronRight className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
