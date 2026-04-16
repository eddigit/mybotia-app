import { cn } from "@/lib/utils";
import type { Metric } from "@/types";

export function MetricCard({ metric }: { metric: Metric }) {
  return (
    <div className="card-sharp-high p-5 flex flex-col">
      <div className="flex justify-between items-start mb-3">
        <span className="micro-label text-text-muted">{metric.label}</span>
        {metric.change !== undefined && (
          <span className={cn(
            "text-[10px] font-bold",
            metric.trend === 'up' ? "text-emerald-400" :
            metric.trend === 'down' ? "text-red-400" :
            "text-text-muted"
          )}>
            {metric.change > 0 ? '+' : ''}{metric.change}%
          </span>
        )}
      </div>

      <div className="text-3xl font-headline font-extrabold text-text-primary tracking-tight">
        {metric.value}
      </div>

      {metric.changeLabel && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <span className="text-[10px] text-text-secondary">{metric.changeLabel}</span>
        </div>
      )}

      {/* Mini bar visualization */}
      <div className="mt-auto pt-3 flex gap-1 h-6 items-end">
        {[2, 4, 3, 6, 8, 5].map((h, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-sm transition-all",
              i >= 4 ? "bg-accent-primary/60" : "bg-surface-3/30"
            )}
            style={{ height: `${h * 3}px` }}
          />
        ))}
      </div>
    </div>
  );
}
