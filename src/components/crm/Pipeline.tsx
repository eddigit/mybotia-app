import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { Deal } from "@/types";

const stageConfig: Record<string, { label: string; color: string }> = {
  discovery: { label: 'Decouverte', color: 'bg-blue-400' },
  proposal: { label: 'Proposition', color: 'bg-violet-400' },
  negotiation: { label: 'Negociation', color: 'bg-amber-400' },
  closing: { label: 'Closing', color: 'bg-emerald-400' },
};

export function Pipeline({ deals }: { deals: Deal[] }) {
  const stages = ['discovery', 'proposal', 'negotiation', 'closing'] as const;

  return (
    <div className="card-sharp p-6">
      <h3 className="section-header text-sm font-bold tracking-tight uppercase text-text-primary font-headline mb-6">
        Pipeline commercial
      </h3>
      <div className="grid grid-cols-4 gap-4">
        {stages.map((stage) => {
          const config = stageConfig[stage];
          const stageDeals = deals.filter((d) => d.stage === stage);
          const totalValue = stageDeals.reduce((sum, d) => sum + d.value, 0);

          return (
            <div key={stage}>
              {/* Stage header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-sm", config.color)} />
                  <span className="text-xs font-bold text-text-primary">{config.label}</span>
                </div>
                <span className="micro-label text-text-muted">{stageDeals.length}</span>
              </div>

              {/* Total */}
              <div className="text-lg font-headline font-extrabold text-text-primary mb-3">
                {formatCurrency(totalValue)}
              </div>

              {/* Deal cards */}
              <div className="space-y-2">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="p-3 bg-surface-3/50 border-l-2 hover:bg-surface-3 transition-all cursor-pointer"
                    style={{ borderLeftColor: `var(--tw-${config.color.replace('bg-', '')}, #6366f1)` }}
                  >
                    <p className="text-xs font-bold text-text-primary mb-1 truncate">{deal.title}</p>
                    <p className="text-sm font-headline font-extrabold text-text-primary">{formatCurrency(deal.value)}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-text-muted font-mono">{deal.assignee}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 h-1 bg-white/[0.04]">
                          <div
                            className={cn("h-full", config.color)}
                            style={{ width: `${deal.probability}%`, opacity: 0.7 }}
                          />
                        </div>
                        <span className="text-[9px] text-text-muted font-mono">{deal.probability}%</span>
                      </div>
                    </div>
                  </div>
                ))}
                {stageDeals.length === 0 && (
                  <div className="p-4 border border-dashed border-white/[0.06] text-center">
                    <span className="micro-label text-text-muted">Vide</span>
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
