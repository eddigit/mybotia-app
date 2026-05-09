"use client";

/**
 * EmptyState — composant partagé pour les listes vides.
 *
 * Doctrine produit : une page vide doit dire :
 *   1. Ce qu'il manque ("Aucune affaire en cours")
 *   2. L'action à faire ("Crée ta première affaire" + CTA)
 *
 * `<FeatureDisabled />` reste pour le cas "module non activé pour ce cockpit".
 *
 * Quick win 5 — variant `inline` pour les sections cockpit (ex: Today).
 * Plus compact qu'une carte pleine page, garde la cohérence visuelle (italique
 * text-muted) sans alourdir un cockpit composé de 6 sections empilées.
 */

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /**
   * `default` (par défaut) : carte pleine, icône, CTA — cas "page vide".
   * `inline` : ligne courte italique pour les sections cockpit (Today).
   */
  variant?: "default" | "inline";
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = "default",
}: EmptyStateProps) {
  if (variant === "inline") {
    // Migration EmptyHint → EmptyState. Conserve le rendu compact original.
    return (
      <div className={cn("py-1", className)}>
        <p className="text-xs text-text-muted italic">{title}</p>
        {description ? (
          <p className="text-[11px] text-text-muted/80 mt-0.5">{description}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "card-sharp p-10 text-center space-y-4 max-w-xl mx-auto",
        className,
      )}
    >
      {Icon ? (
        <div className="inline-flex items-center justify-center w-12 h-12 mx-auto bg-accent-primary/10 border border-accent-primary/30">
          <Icon className="w-5 h-5 text-accent-glow" />
        </div>
      ) : null}
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
