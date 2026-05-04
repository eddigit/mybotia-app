"use client";

// Bloc 6B — affichage propre quand l'utilisateur ouvre une page dont
// la feature est désactivée pour son cockpit.

import { Lock, ShieldAlert } from "lucide-react";
import Link from "next/link";

export function FeatureDisabled({
  featureKey,
  tenantSlug,
  title,
}: {
  featureKey: string;
  tenantSlug?: string;
  title?: string;
}) {
  return (
    <div className="p-8 min-h-screen flex items-center justify-center">
      <div className="card-sharp p-10 max-w-lg text-center space-y-5">
        <div className="inline-flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-amber-400/10 border border-amber-400/30">
          <Lock className="w-5 h-5 text-amber-300" />
        </div>
        <h1 className="text-lg font-headline font-extrabold text-text-primary">
          {title || "Module non activé pour ce cockpit"}
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed">
          La fonctionnalité <span className="font-mono text-accent-glow">{featureKey}</span>{" "}
          n&apos;est pas activée pour
          {tenantSlug ? (
            <>
              {" le cockpit "}<span className="font-mono">{tenantSlug}</span>.
            </>
          ) : (
            " ce cockpit."
          )}
        </p>
        <div className="text-[11px] text-text-muted flex items-start gap-1.5 justify-center">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Pour l&apos;activer, un superadmin peut le faire depuis{" "}
            <Link href="/admin/tenants" className="text-accent-glow hover:underline font-mono">
              /admin/tenants
            </Link>
            .
          </span>
        </div>
        <Link
          href="/"
          className="inline-block px-5 py-2 text-[11px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
        >
          Retour cockpit
        </Link>
      </div>
    </div>
  );
}
