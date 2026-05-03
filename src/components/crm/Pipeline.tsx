"use client";

// Cockpit principal — Pipeline VERROUILLÉ MyBotIA. Plus de pills tenant,
// plus de badge tenant sur les cartes. Toute carte affichée provient déjà
// de l'API filtrée serveur (useScopedDashboard). Pas de drag-and-drop.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { Deal } from "@/types";
import { DealDetailPanel } from "./DealDetailPanel";

const stageConfig: Record<string, { label: string; color: string }> = {
  discovery: { label: "Decouverte", color: "bg-blue-400" },
  proposal: { label: "Proposition", color: "bg-violet-400" },
  negotiation: { label: "Negociation", color: "bg-amber-400" },
  closing: { label: "Closing", color: "bg-emerald-400" },
};

export function Pipeline({
  deals,
  onUpdated,
}: {
  deals: Deal[];
  onUpdated?: () => void;
}) {
  const stages = ["discovery", "proposal", "negotiation", "closing"] as const;
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  return (
    <>
      <div className="card-sharp p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-header text-sm font-bold tracking-tight uppercase text-text-primary font-headline">
            Pipeline commercial
          </h3>
          <span className="micro-label text-text-muted font-mono">{deals.length}</span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {stages.map((stage) => {
            const config = stageConfig[stage];
            const stageDeals = deals.filter((d) => d.stage === stage);
            const totalValue = stageDeals.reduce((sum, d) => sum + d.value, 0);

            return (
              <div key={stage}>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-sm", config.color)} />
                    <span className="text-xs font-bold text-text-primary">{config.label}</span>
                  </div>
                  <span className="micro-label text-text-muted">{stageDeals.length}</span>
                </div>

                <div className="text-lg font-headline font-extrabold text-text-primary mb-3">
                  {formatCurrency(totalValue)}
                </div>

                <div className="space-y-2">
                  {stageDeals.map((deal) => (
                    <button
                      key={deal.id}
                      type="button"
                      onClick={() => setSelectedDeal(deal)}
                      className="w-full text-left block p-3 bg-surface-3/50 border-l-2 hover:bg-surface-3 transition-all cursor-pointer"
                      style={{
                        borderLeftColor: `var(--tw-${config.color.replace("bg-", "")}, #6366f1)`,
                      }}
                      title="Cliquer pour modifier (étape, montant, probabilité, titre)"
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <p className="text-xs font-bold text-text-primary truncate flex-1 min-w-0">
                          {deal.title}
                        </p>
                      </div>
                      <p className="text-[10px] text-text-muted truncate">
                        {deal.clientName || "(client inconnu)"}
                      </p>
                      <p className="text-sm font-headline font-extrabold text-text-primary mt-1">
                        {formatCurrency(deal.value)}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-text-muted font-mono">{deal.assignee}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1 bg-surface-3/30">
                            <div
                              className={cn("h-full", config.color)}
                              style={{ width: `${deal.probability}%`, opacity: 0.7 }}
                            />
                          </div>
                          <span className="text-[9px] text-text-muted font-mono">
                            {deal.probability}%
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                  {stageDeals.length === 0 && (
                    <div className="p-4 border border-dashed border-border-subtle text-center">
                      <span className="micro-label text-text-muted">Vide</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDeal && (
        <DealDetailPanel
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onSaved={() => {
            setSelectedDeal(null);
            if (onUpdated) onUpdated();
          }}
        />
      )}
    </>
  );
}
