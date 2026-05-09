"use client";

/**
 * EmptyState — composant partagé pour les listes vides.
 *
 * Doctrine produit : une page vide doit dire :
 *   1. Ce qu'il manque ("Aucune affaire en cours")
 *   2. L'action à faire ("Crée ta première affaire" + CTA)
 *
 * `<FeatureDisabled />` reste pour le cas "module non activé pour ce cockpit".
 */

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "card-sharp p-10 text-center space-y-4 max-w-xl mx-auto",
        className,
      )}
    >
      <div className="inline-flex items-center justify-center w-12 h-12 mx-auto bg-accent-primary/10 border border-accent-primary/30">
        <Icon className="w-5 h-5 text-accent-glow" />
      </div>
      <h3 className="text-sm font-bold text-text-primary">{title}</h3>
      {description ? (
        <p className="text-[12px] text-text-muted leading-relaxed max-w-md mx-auto">
          {description}
        </p>
      ) : null}
      {action ? <div className="flex justify-center pt-2">{action}</div> : null}
    </div>
  );
}
