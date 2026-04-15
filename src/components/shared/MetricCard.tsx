import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Metric } from "@/types";

export function MetricCard({ metric }: { metric: Metric }) {
  return (
    <div className="glass-card p-4 flex flex-col gap-2">
      <span className="text-xs text-text-muted font-medium">{metric.label}</span>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-semibold text-text-primary tracking-tight">
          {metric.value}
        </span>
        {metric.trend && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
            metric.trend === 'up' && "text-emerald-400 bg-emerald-400/10",
            metric.trend === 'down' && "text-red-400 bg-red-400/10",
            metric.trend === 'stable' && "text-text-muted bg-white/5",
          )}>
            {metric.trend === 'up' && <TrendingUp className="w-3 h-3" />}
            {metric.trend === 'down' && <TrendingDown className="w-3 h-3" />}
            {metric.trend === 'stable' && <Minus className="w-3 h-3" />}
            {metric.change !== undefined && (
              <span>{metric.change > 0 ? '+' : ''}{metric.change}%</span>
            )}
          </div>
        )}
      </div>
      {metric.changeLabel && (
        <span className="text-[11px] text-text-muted">{metric.changeLabel}</span>
      )}
    </div>
  );
}
