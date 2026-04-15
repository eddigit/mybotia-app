import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { Deal } from "@/types";

const stageConfig: Record<string, { label: string; color: string }> = {
  discovery: { label: 'Decouverte', color: 'bg-blue-400' },
  proposal: { label: 'Proposition', color: 'bg-violet-400' },
  negotiation: { label: 'Negociation', color: 'bg-amber-400' },
  closing: { label: 'Closing', color: 'bg-emerald-400' },
  won: { label: 'Gagne', color: 'bg-green-500' },
  lost: { label: 'Perdu', color: 'bg-red-400' },
};

export function Pipeline({ deals }: { deals: Deal[] }) {
  const stages = ['discovery', 'proposal', 'negotiation', 'closing'] as const;

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-4">Pipeline commercial</h3>
      <div className="grid grid-cols-4 gap-3">
        {stages.map((stage) => {
          const config = stageConfig[stage];
          const stageDeals = deals.filter((d) => d.stage === stage);
          const totalValue = stageDeals.reduce((sum, d) => sum + d.value, 0);

          return (
            <div key={stage} className="space-y-2">
              {/* Stage header */}
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", config.color)} />
                  <span className="text-xs font-medium text-text-primary">{config.label}</span>
                </div>
                <span className="text-[10px] text-text-muted">{stageDeals.length}</span>
              </div>

              {/* Total */}
              <div className="text-xs text-text-secondary font-medium">
                {formatCurrency(totalValue)}
              </div>

              {/* Deal cards */}
              <div className="space-y-2">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="p-2.5 rounded-lg bg-surface-2/50 border border-border-subtle hover:border-border-default transition-all cursor-pointer"
                  >
                    <p className="text-xs font-medium text-text-primary mb-1 truncate">{deal.title}</p>
                    <p className="text-[11px] text-text-muted">{formatCurrency(deal.value)}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-text-muted">{deal.assignee}</span>
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1 rounded-full bg-surface-3 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", config.color)}
                            style={{ width: `${deal.probability}%`, opacity: 0.7 }}
                          />
                        </div>
                        <span className="text-[9px] text-text-muted">{deal.probability}%</span>
                      </div>
                    </div>
                  </div>
                ))}
                {stageDeals.length === 0 && (
                  <div className="p-3 rounded-lg border border-dashed border-border-subtle text-center">
                    <span className="text-[10px] text-text-muted">Aucun deal</span>
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
