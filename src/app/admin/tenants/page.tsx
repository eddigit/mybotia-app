"use client";

// Bloc 6A — Liste admin tenants. Superadmin only (ACL serveur).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Shield, Layers, ExternalLink, AlertCircle, Loader2 } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { FEATURE_KEYS, type AdminTenantRow } from "@/lib/tenant-admin-config";

export default function AdminTenantsPage() {
  const [data, setData] = useState<AdminTenantRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/tenants")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => {
        if (cancelled) return;
        setData(j.tenants || []);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => (data ? [...data].sort((a, b) => a.slug.localeCompare(b.slug)) : []), [data]);

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <ModuleHeader icon={Shield} title="Admin Tenants" subtitle="Zone superadmin" />
        <div className="mt-6 flex items-start gap-2 p-4 border border-status-danger/30 bg-status-danger/10 text-status-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Shield}
        title="Admin · Tenants"
        subtitle="Configuration des collaborateurs IA et clients (zone superadmin)"
      />

      <section className="card-sharp p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
            Tenants enregistrés
          </h2>
          <span className="micro-label text-text-muted font-mono">{sorted.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 px-2">Slug</th>
                <th className="text-left py-2 px-2">Nom affiché</th>
                <th className="text-left py-2 px-2">Legal name</th>
                <th className="text-left py-2 px-2">Statut</th>
                <th className="text-left py-2 px-2">Profile</th>
                <th className="text-right py-2 px-2">Modules actifs</th>
                <th className="text-left py-2 px-2">Business model</th>
                <th className="text-right py-2 px-2">Users</th>
                <th className="text-right py-2 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {sorted.map((t) => {
                const activeFeatures = FEATURE_KEYS.filter((k) => t.features[k]);
                const bm = t.businessModel;
                const bmSummary = bm
                  ? bm.kpiStatus === "to_configure"
                    ? "à configurer"
                    : [
                        bm.hasOneShot && "one-shot",
                        bm.hasRecurring && "récurrent",
                        bm.hasTokenBilling && "tokens",
                        bm.hasMaintenance && "maintenance",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "configuré"
                  : "—";
                return (
                  <tr key={t.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="py-2.5 px-2 font-mono text-text-primary">{t.slug}</td>
                    <td className="py-2.5 px-2 text-text-secondary">{t.displayName}</td>
                    <td className="py-2.5 px-2 text-text-muted text-xs">{t.legalName || "—"}</td>
                    <td className="py-2.5 px-2 text-xs">
                      <span
                        className={
                          t.status === "active"
                            ? "text-emerald-300"
                            : "text-text-muted"
                        }
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-text-muted text-xs">{t.profile}</td>
                    <td className="py-2.5 px-2 text-right text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <Layers className="w-3 h-3 text-text-muted" />
                        {activeFeatures.length}
                        <span className="text-text-muted">/{FEATURE_KEYS.length}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-text-muted text-xs">{bmSummary}</td>
                    <td className="py-2.5 px-2 text-right text-text-muted text-xs font-mono">
                      {t.userCount}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <Link
                        href={`/admin/tenants/${encodeURIComponent(t.slug)}`}
                        className="inline-flex items-center gap-1 text-accent-glow hover:underline text-xs"
                      >
                        Détail
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-sharp p-6 text-[11px] text-text-muted">
        <div className="flex items-start gap-2">
          <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-300" />
          <div>
            <p className="font-bold text-amber-300 uppercase tracking-wider mb-1">
              Zone superadmin
            </p>
            <p>
              Cette page lit/édite la configuration tenant côté{" "}
              <span className="font-mono">mybotia_core</span> ({" "}
              <span className="font-mono">core.tenant</span>,{" "}
              <span className="font-mono">core.tenant_settings</span>,{" "}
              <span className="font-mono">core.tenant_branding</span>). Aucune
              clé technique (Dolibarr, JWT, bridge) n&apos;est exposée ici.
              Les changements de features et business_model prennent effet
              immédiatement côté API serveur.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
