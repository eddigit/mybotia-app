"use client";

// V1.1.E — Console admin tenants (refonte du Bloc 6A).
//
// Table compacte : badge branding, displayName, slug, modules activés/total,
// dernière activité modules, status. CTA explicite "Gérer" → /admin/tenants/[slug].
// Superadmin only (ACL serveur).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Shield,
  Layers,
  ChevronRight,
  AlertCircle,
  Search,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Skeleton } from "@/components/shared/Skeleton";
import type { AdminTenantRow } from "@/lib/tenant-admin-config";
import { getTenantBranding } from "@/lib/tenant/branding";

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminTenantsPage() {
  const [data, setData] = useState<AdminTenantRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/tenants", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => {
        if (cancelled) return;
        setData(j.tenants || []);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    const list = data ? [...data].sort((a, b) => a.slug.localeCompare(b.slug)) : [];
    const f = filter.trim().toLowerCase();
    if (!f) return list;
    return list.filter(
      (t) =>
        t.slug.toLowerCase().includes(f) ||
        (t.displayName || "").toLowerCase().includes(f) ||
        (t.legalName || "").toLowerCase().includes(f),
    );
  }, [data, filter]);

  if (loading) {
    return (
      <div className="p-8 min-h-screen space-y-6">
        <ModuleHeader icon={Shield} title="Admin · Tenants" subtitle="Chargement…" />
        <Skeleton.Table rows={6} cols={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <ModuleHeader icon={Shield} title="Admin · Tenants" subtitle="Zone superadmin" />
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
        subtitle="Console superadmin · activation modules, configuration, audit"
      />

      <section className="card-sharp p-6">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
              Tenants enregistrés
            </h2>
            <span className="micro-label text-text-muted font-mono">
              {sorted.length}
              {data && filter ? ` / ${data.length}` : ""}
            </span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrer (slug, nom)…"
              className="pl-7 pr-2 py-1.5 bg-surface-2 border border-border-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/40 w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 px-2">Tenant</th>
                <th className="text-left py-2 px-2">Slug</th>
                <th className="text-left py-2 px-2">Statut</th>
                <th className="text-left py-2 px-2">Profile</th>
                <th className="text-right py-2 px-2">Modules</th>
                <th className="text-left py-2 px-2">Dernière activité</th>
                <th className="text-right py-2 px-2">Users</th>
                <th className="text-right py-2 px-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {sorted.map((t) => {
                const br = getTenantBranding(t.slug);
                const color = t.primaryColor || br.primaryColor || "#374151";
                const enabled = t.modulesEnabled ?? 0;
                const total = t.modulesTotal ?? 0;
                return (
                  <tr key={t.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="inline-flex items-center justify-center w-7 h-7 text-[11px] font-bold uppercase tracking-tight border"
                          style={{
                            background: `${color}1A`,
                            borderColor: `${color}55`,
                            color: color,
                          }}
                          aria-hidden
                        >
                          {(t.displayName || t.slug).slice(0, 2)}
                        </span>
                        <div className="flex flex-col leading-tight">
                          <span className="text-text-primary text-sm">
                            {t.displayName || t.slug}
                          </span>
                          {t.legalName && (
                            <span className="text-[10px] text-text-muted">
                              {t.legalName}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-text-secondary text-xs">{t.slug}</td>
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
                    <td className="py-2.5 px-2 text-right">
                      <span className="inline-flex items-center gap-1 text-text-secondary">
                        <Layers className="w-3 h-3 text-text-muted" />
                        <span className="font-mono text-xs">
                          {enabled}
                          <span className="text-text-muted">/{total}</span>
                        </span>
                      </span>
                    </td>
                    <td
                      className="py-2.5 px-2 text-text-muted text-xs"
                      title={t.lastModuleActivityAt || ""}
                    >
                      {formatRelative(t.lastModuleActivityAt)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-text-muted text-xs font-mono">
                      {t.userCount}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <Link
                        href={`/admin/tenants/${encodeURIComponent(t.slug)}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
                      >
                        Gérer
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-text-muted text-xs">
                    Aucun tenant ne correspond au filtre.
                  </td>
                </tr>
              )}
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
              Modules activés × total registry. Dernière activité = MAX(
              <span className="font-mono">activated_at</span>,{" "}
              <span className="font-mono">deactivated_at</span>,{" "}
              <span className="font-mono">updated_at</span>) sur{" "}
              <span className="font-mono">core.tenant_modules</span>. Aucune
              clé technique n&apos;est exposée ici. Pour le détail (toggles,
              config jsonb, branding, audit log) → bouton <em>Gérer</em>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
