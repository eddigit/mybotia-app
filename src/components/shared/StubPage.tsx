"use client";

// Bloc 5A — composant stub réutilisable pour les pages en cours de construction.
// Affiche un titre, une phrase d'objectif clair, des cartes de préfiguration
// (intitulés des futures briques métier) et un badge "En préparation".
//
// Règle stricte : aucun chiffre fictif. Aucune donnée mockée déguisée en réelle.
// Les cartes affichent uniquement le NOM de la future brique + une description
// courte de ce qu'elle contiendra une fois activée.

import { Sparkles } from "lucide-react";
import { ModuleHeader } from "./ModuleHeader";
import { cn } from "@/lib/utils";

export interface StubCardItem {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Note optionnelle (ex: "arrive au Bloc 5B"). */
  note?: string;
}

export function StubPage({
  title,
  subtitle,
  objective,
  cards,
  nextBlockNote,
}: {
  title: string;
  subtitle?: string;
  /** Phrase d'objectif unique : à quoi sert cette page une fois active. */
  objective: string;
  cards: StubCardItem[];
  /** Note de bas de page sur la prochaine étape de développement (optionnelle). */
  nextBlockNote?: string;
}) {
  return (
    <div className="p-8 space-y-6">
      <ModuleHeader title={title} subtitle={subtitle} />

      {/* Objectif + badge En préparation */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">
          {objective}
        </p>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight border border-amber-400/30 bg-amber-400/10 text-amber-300 shrink-0">
          <Sparkles className="w-3 h-3" />
          En préparation
        </span>
      </div>

      {/* Cartes de préfiguration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.title}
              className={cn(
                "card-sharp p-5 flex items-start gap-4 transition-all",
                "border border-border-subtle hover:border-accent-primary/30"
              )}
            >
              <div className="flex items-center justify-center w-10 h-10 shrink-0 bg-accent-primary/10 border border-accent-primary/20">
                <Icon className="w-5 h-5 text-accent-glow" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
                  {c.title}
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  {c.description}
                </p>
                {c.note && (
                  <p className="text-[10px] text-text-muted italic mt-2">{c.note}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {nextBlockNote && (
        <div className="p-4 bg-surface-2/50 border-l-2 border-accent-primary/40">
          <p className="text-[11px] text-text-muted leading-relaxed">
            <span className="font-bold text-accent-glow uppercase tracking-wider mr-2">
              Prochain bloc
            </span>
            {nextBlockNote}
          </p>
        </div>
      )}
    </div>
  );
}
