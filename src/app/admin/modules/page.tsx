"use client";

// V1.1.D Phase 1 — Matrice modules × tenants (superadmin only).
//
// - Liste les tenants (GET /api/admin/tenants).
// - Pour chaque tenant : GET /api/admin/tenants/[slug]/modules (proxy → business).
// - Toggle inline : PATCH /api/admin/tenants/[slug]/modules { module_key, enabled }.
//
// ACL : superadmin (gating client + serveur). En cas d'utilisateur non-super,
// la fetch retournera 403 — on affiche un message explicite.

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Layers, Loader2, AlertCircle, Check, X } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { useAuth } from "@/contexts/auth-context";
import type { AdminTenantRow } from "@/lib/tenant-admin-config";
import type { AdminTenantModule } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

type TenantModulesState = {
  loading: boolean;
  error: string | null;
  modules: AdminTenantModule[];
};

export default function AdminModulesPage() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<AdminTenantRow[] | null>(null);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  const [byTenant, setByTenant] = useState<Record<string, TenantModulesState>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const isSuperadmin = user?.is_superadmin === true;

  // Liste tenants
  useEffect(() => {
    if (!isSuperadmin) return;
    let cancelled = false;
    fetch("/api/admin/tenants")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => {
        if (cancelled) return;
        const list: AdminTenantRow[] = j.tenants || [];
        setTenants(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setTenantsError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isSuperadmin]);

  const loadTenantModules = useCallback(async (slug: string) => {
    setByTenant((prev) => ({
      ...prev,
      [slug]: { loading: true, error: null, modules: prev[slug]?.modules ?? [] },
    }));
    try {
      const r = await fetch(
        `/api/admin/tenants/${encodeURIComponent(slug)}/modules`,
        { cache: "no-store" },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const modules: AdminTenantModule[] = j?.data?.modules ?? [];
      setByTenant((prev) => ({
        ...prev,
        [slug]: { loading: false, error: null, modules },
      }));
    } catch (e: unknown) {
      setByTenant((prev) => ({
        ...prev,
        [slug]: {
          loading: false,
          error: e instanceof Error ? e.message : String(e),
          modules: prev[slug]?.modules ?? [],
        },
      }));
    }
  }, []);

  // Charger modules par tenant
  useEffect(() => {
    if (!tenants) return;
    for (const t of tenants) {
      if (!byTenant[t.slug]) loadTenantModules(t.slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenants]);

  // Liste des module_keys distincts (union)
  const allModuleKeys = useMemo(() => {
    const set = new Set<string>();
    for (const slug of Object.keys(byTenant)) {
      for (const m of byTenant[slug].modules) set.add(m.module_key);
    }
    return Array.from(set).sort();
  }, [byTenant]);

  const moduleMeta = useMemo(() => {
    const meta = new Map<string, { name: string; category: string }>();
    for (const slug of Object.keys(byTenant)) {
      for (const m of byTenant[slug].modules) {
        if (!meta.has(m.module_key)) {
          meta.set(m.module_key, { name: m.name, category: m.category });
        }
      }
    }
    return meta;
  }, [byTenant]);

  async function toggleModule(slug: string, moduleKey: string, enabled: boolean) {
    const cellKey = `${slug}:${moduleKey}`;
    setPending((p) => ({ ...p, [cellKey]: true }));
    try {
      const r = await fetch(
        `/api/admin/tenants/${encodeURIComponent(slug)}/modules`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module_key: moduleKey, enabled }),
        },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      await loadTenantModules(slug);
    } catch (e: unknown) {
      setByTenant((prev) => ({
        ...prev,
        [slug]: {
          loading: false,
          error: e instanceof Error ? e.message : String(e),
          modules: prev[slug]?.modules ?? [],
        },
      }));
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[cellKey];
        return next;
      });
    }
  }

  if (!isSuperadmin) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="card-sharp p-10 max-w-lg text-center space-y-4">
          <AlertCircle className="w-6 h-6 mx-auto text-amber-300" />
          <h1 className="text-lg font-headline font-extrabold text-text-primary">
            Accès superadmin requis
          </h1>
          <p className="text-sm text-text-secondary">
            Cette page liste l&apos;activation des modules par tenant. Réservée
            au superadmin.
          </p>
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

  return (
    <div className="p-8 min-h-screen space-y-6">
      <ModuleHeader
        icon={Layers}
        title="Modules"
        subtitle={
          tenants
            ? `${tenants.length} tenant${tenants.length > 1 ? "s" : ""} · ${allModuleKeys.length} module${allModuleKeys.length > 1 ? "s" : ""} (registry)`
            : "Chargement…"
        }
      />

      {tenantsError && (
        <div className="card-sharp p-5 flex items-start gap-3 text-sm border-amber-400/30 bg-amber-400/5 text-amber-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{tenantsError}</span>
        </div>
      )}

      {!tenants && !tenantsError && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
        </div>
      )}

      {tenants && allModuleKeys.length === 0 && (
        <div className="card-sharp p-8 text-center">
          <p className="text-sm text-text-muted">
            Aucun module exposé par le registry business pour ces tenants.
          </p>
        </div>
      )}

      {tenants && allModuleKeys.length > 0 && (
        <div className="card-sharp overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-tight text-text-muted">
              <tr className="border-b border-border-subtle">
                <th className="text-left p-3 font-bold sticky left-0 bg-surface-1/90 backdrop-blur z-10">
                  Module
                </th>
                {tenants.map((t) => (
                  <th
                    key={t.slug}
                    className="text-center p-3 font-bold whitespace-nowrap"
                    title={t.displayName || t.slug}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-text-primary">{t.slug}</span>
                      <span className="text-[9px] text-text-muted font-normal normal-case">
                        {t.profile}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {allModuleKeys.map((modKey) => {
                const meta = moduleMeta.get(modKey);
                return (
                  <tr key={modKey}>
                    <td className="p-3 sticky left-0 bg-surface-1/90 backdrop-blur z-10">
                      <div className="flex flex-col">
                        <span className="font-mono text-text-primary text-[12px]">
                          {modKey}
                        </span>
                        {meta && (
                          <span className="text-[10px] text-text-muted">
                            {meta.name} · {meta.category}
                          </span>
                        )}
                      </div>
                    </td>
                    {tenants.map((t) => {
                      const state = byTenant[t.slug];
                      const cellKey = `${t.slug}:${modKey}`;
                      const isPending = !!pending[cellKey];
                      if (!state || state.loading) {
                        return (
                          <td key={t.slug} className="p-3 text-center">
                            <Loader2 className="w-3 h-3 animate-spin text-text-muted mx-auto" />
                          </td>
                        );
                      }
                      if (state.error) {
                        return (
                          <td
                            key={t.slug}
                            className="p-3 text-center text-[10px] text-amber-300"
                            title={state.error}
                          >
                            err
                          </td>
                        );
                      }
                      const found = state.modules.find(
                        (m) => m.module_key === modKey,
                      );
                      const enabled = found?.enabled === true;
                      const inRegistry = !!found;
                      return (
                        <td key={t.slug} className="p-3 text-center">
                          <button
                            disabled={!inRegistry || isPending}
                            onClick={() =>
                              toggleModule(t.slug, modKey, !enabled)
                            }
                            title={
                              inRegistry
                                ? enabled
                                  ? "Désactiver"
                                  : "Activer"
                                : "Module non disponible pour ce tenant"
                            }
                            className={cn(
                              "inline-flex items-center justify-center w-7 h-7 border transition-colors",
                              !inRegistry &&
                                "border-border-subtle text-text-muted/40 cursor-not-allowed",
                              inRegistry &&
                                enabled &&
                                "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
                              inRegistry &&
                                !enabled &&
                                "border-zinc-500/40 text-zinc-400 hover:border-accent-primary/40 hover:text-accent-glow",
                              isPending && "opacity-50",
                            )}
                          >
                            {isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : enabled ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-text-muted italic text-center">
        Source : <span className="font-mono">core.module_registry</span> ×{" "}
        <span className="font-mono">core.tenant_modules</span> via business.
        Toggle = PATCH audité côté business.
      </p>
    </div>
  );
}
