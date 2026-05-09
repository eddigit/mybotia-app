"use client";

// V1.1.E — Section "Modules" pour /admin/tenants/[slug].
//
// Fonctionnalités :
//   - matrice des 9 modules registry × statut tenant (toggle ON/OFF)
//   - update optimiste + rollback en cas d'erreur API (status code != 2xx)
//   - banner inline pour erreur/succès (pas de lib toast → cohérent stack app)
//   - éditeur JSON `config` par module (textarea) avec PATCH dédié
//   - confirmation explicite si désactivation d'un module dont d'autres
//     modules activés dépendent ("Ce module est requis par X. Voulez-vous
//     quand même le désactiver ?")
//
// Source : GET /api/admin/tenants/[slug]/modules (proxy biz)
// Mutation : PATCH /api/admin/tenants/[slug]/modules { module_key, enabled?, config? }

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Layers,
  Loader2,
  AlertCircle,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
} from "lucide-react";
import type { AdminTenantModule } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

type Banner =
  | { kind: "ok"; message: string }
  | { kind: "err"; message: string }
  | null;

type ConfirmState = {
  moduleKey: string;
  dependents: string[];
} | null;

interface Props {
  tenantSlug: string;
  onActivityRefresh?: () => void;
}

export function TenantModulesSection({ tenantSlug, onActivityRefresh }: Props) {
  const [modules, setModules] = useState<AdminTenantModule[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [configErr, setConfigErr] = useState<Record<string, string | null>>({});
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/admin/tenants/${encodeURIComponent(tenantSlug)}/modules`,
        { cache: "no-store" },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const list: AdminTenantModule[] = j?.data?.modules ?? [];
      setModules(list);
      setError(null);
      // Initialiser drafts à partir du serveur
      const drafts: Record<string, string> = {};
      for (const m of list) {
        drafts[m.module_key] = JSON.stringify(m.config ?? {}, null, 2);
      }
      setConfigDraft(drafts);
      setConfigErr({});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    load();
  }, [load]);

  // Map des modules activés (set rapide) basée sur l'état courant
  const enabledKeys = useMemo(() => {
    const set = new Set<string>();
    if (!modules) return set;
    for (const m of modules) if (m.enabled) set.add(m.module_key);
    return set;
  }, [modules]);

  // Pour un module donné : qui le dépend (parmi les modules ACTUELLEMENT activés)
  function findDependentsActive(moduleKey: string): string[] {
    if (!modules) return [];
    return modules
      .filter(
        (m) =>
          m.enabled &&
          (m.depends_on || []).includes(moduleKey) &&
          m.module_key !== moduleKey,
      )
      .map((m) => m.module_key);
  }

  async function patchModule(
    moduleKey: string,
    payload: { enabled?: boolean; config?: Record<string, unknown> },
    optimistic: { previous: AdminTenantModule[] | null; next: AdminTenantModule[] | null } | null,
  ): Promise<boolean> {
    setPending((p) => ({ ...p, [moduleKey]: true }));
    setBanner(null);
    if (optimistic?.next) setModules(optimistic.next);
    try {
      const r = await fetch(
        `/api/admin/tenants/${encodeURIComponent(tenantSlug)}/modules`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ module_key: moduleKey, ...payload }),
        },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      // Resync depuis serveur (pour activated_at, deactivated_at)
      await load();
      onActivityRefresh?.();
      setBanner({
        kind: "ok",
        message:
          payload.enabled !== undefined
            ? `Module ${moduleKey} ${payload.enabled ? "activé" : "désactivé"}.`
            : `Config de ${moduleKey} enregistrée.`,
      });
      return true;
    } catch (e: unknown) {
      // Rollback optimiste
      if (optimistic?.previous) setModules(optimistic.previous);
      setBanner({
        kind: "err",
        message: e instanceof Error ? e.message : String(e),
      });
      return false;
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[moduleKey];
        return next;
      });
    }
  }

  function handleToggleClick(m: AdminTenantModule) {
    const wantDisable = m.enabled === true;
    if (wantDisable) {
      const dependents = findDependentsActive(m.module_key);
      if (dependents.length > 0) {
        setConfirm({ moduleKey: m.module_key, dependents });
        return;
      }
    }
    doToggle(m.module_key, !m.enabled);
  }

  function doToggle(moduleKey: string, enabled: boolean) {
    if (!modules) return;
    const previous = modules;
    const next = modules.map((m) =>
      m.module_key === moduleKey
        ? { ...m, enabled, status: enabled ? "enabled" : "disabled" }
        : m,
    );
    patchModule(moduleKey, { enabled }, { previous, next });
  }

  async function handleSaveConfig(moduleKey: string) {
    const raw = configDraft[moduleKey] ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      const v = JSON.parse(raw);
      if (!v || typeof v !== "object" || Array.isArray(v)) {
        throw new Error("config doit etre un objet JSON");
      }
      parsed = v as Record<string, unknown>;
    } catch (e) {
      setConfigErr((s) => ({
        ...s,
        [moduleKey]: e instanceof Error ? e.message : "JSON invalide",
      }));
      return;
    }
    setConfigErr((s) => ({ ...s, [moduleKey]: null }));
    await patchModule(moduleKey, { config: parsed }, null);
  }

  function handleResetConfig(moduleKey: string) {
    if (!modules) return;
    const m = modules.find((x) => x.module_key === moduleKey);
    if (!m) return;
    setConfigDraft((s) => ({
      ...s,
      [moduleKey]: JSON.stringify(m.config ?? {}, null, 2),
    }));
    setConfigErr((s) => ({ ...s, [moduleKey]: null }));
  }

  if (loading) {
    return (
      <section className="card-sharp p-6">
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement modules…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card-sharp p-6">
        <div className="flex items-start gap-2 text-amber-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold mb-1">Modules indisponibles</p>
            <p className="text-xs text-text-muted">{error}</p>
          </div>
          <button
            onClick={load}
            className="px-2 py-1 text-[11px] uppercase border border-border-subtle text-text-muted hover:text-text-primary"
          >
            Réessayer
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card-sharp p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent-glow" />
          Modules
        </h2>
        <span className="text-[11px] text-text-muted font-mono">
          {enabledKeys.size}/{modules?.length ?? 0} activés
        </span>
      </div>

      {banner && (
        <div
          className={cn(
            "flex items-start gap-2 p-2.5 text-xs border",
            banner.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-status-danger/30 bg-status-danger/10 text-status-danger",
          )}
        >
          {banner.kind === "ok" ? (
            <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{banner.message}</span>
          <button
            onClick={() => setBanner(null)}
            className="text-text-muted hover:text-text-primary text-[10px] uppercase"
          >
            fermer
          </button>
        </div>
      )}

      {confirm && (
        <div className="p-3 border border-amber-400/40 bg-amber-400/10 text-amber-200 text-xs space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold mb-1">
                Module{" "}
                <span className="font-mono">{confirm.moduleKey}</span> requis
                par d&apos;autres modules actifs
              </p>
              <p>
                {confirm.dependents.map((d, i) => (
                  <span key={d} className="font-mono">
                    {d}
                    {i < confirm.dependents.length - 1 ? ", " : ""}
                  </span>
                ))}{" "}
                {confirm.dependents.length > 1 ? "dépendent" : "dépend"} de{" "}
                <span className="font-mono">{confirm.moduleKey}</span>. La
                désactivation peut casser ces modules. Voulez-vous quand même
                le désactiver ?
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setConfirm(null)}
              className="px-3 py-1 text-[11px] uppercase border border-border-subtle text-text-muted hover:text-text-primary"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                const k = confirm.moduleKey;
                setConfirm(null);
                doToggle(k, false);
              }}
              className="px-3 py-1 text-[11px] uppercase border border-status-danger/40 bg-status-danger/15 text-status-danger hover:bg-status-danger/25"
            >
              Désactiver quand même
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border-subtle">
            <tr>
              <th className="text-left py-2 px-2 w-8"></th>
              <th className="text-left py-2 px-2">Module</th>
              <th className="text-left py-2 px-2">Catégorie</th>
              <th className="text-left py-2 px-2">Dépend de</th>
              <th className="text-center py-2 px-2">Statut</th>
              <th className="text-right py-2 px-2">Activé le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {(modules || []).map((m) => {
              const isPending = !!pending[m.module_key];
              const isOpen = expanded[m.module_key] === true;
              const draft = configDraft[m.module_key] ?? "{}";
              const cfgErr = configErr[m.module_key] ?? null;
              const cleanDraft = draft.trim();
              const orig = JSON.stringify(m.config ?? {}, null, 2).trim();
              const dirty = cleanDraft !== orig;
              return (
                <Fragment key={m.module_key}>
                  <tr className="hover:bg-surface-2/50 transition-colors">
                    <td className="py-2 px-1 align-top">
                      <button
                        onClick={() =>
                          setExpanded((s) => ({
                            ...s,
                            [m.module_key]: !s[m.module_key],
                          }))
                        }
                        className="text-text-muted hover:text-text-primary"
                        aria-label={isOpen ? "Replier" : "Déplier"}
                      >
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="py-2 px-2 align-top">
                      <div className="flex flex-col leading-tight">
                        <span className="font-mono text-text-primary text-[12px]">
                          {m.module_key}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {m.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2 align-top text-text-muted text-xs">
                      {m.category}
                    </td>
                    <td className="py-2 px-2 align-top text-text-muted text-[10px] font-mono">
                      {m.depends_on && m.depends_on.length > 0
                        ? m.depends_on.join(", ")
                        : "—"}
                    </td>
                    <td className="py-2 px-2 align-top text-center">
                      <button
                        disabled={isPending}
                        onClick={() => handleToggleClick(m)}
                        title={m.enabled ? "Désactiver" : "Activer"}
                        className={cn(
                          "inline-flex items-center justify-center w-9 h-6 border transition-colors text-[10px] uppercase tracking-tight font-bold",
                          m.enabled
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                            : "border-zinc-500/40 text-zinc-400 hover:border-accent-primary/40 hover:text-accent-glow",
                          isPending && "opacity-50",
                        )}
                      >
                        {isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : m.enabled ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                      </button>
                    </td>
                    <td className="py-2 px-2 align-top text-right text-[10px] text-text-muted font-mono">
                      {m.activated_at
                        ? new Date(m.activated_at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-surface-2/30">
                      <td colSpan={6} className="px-3 pt-1 pb-4">
                        <div className="ml-6 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] uppercase tracking-wider text-text-muted">
                              Config jsonb · <span className="font-mono">{m.module_key}</span>
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleResetConfig(m.module_key)}
                                disabled={!dirty || isPending}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase border border-border-subtle text-text-muted hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                reset
                              </button>
                              <button
                                onClick={() => handleSaveConfig(m.module_key)}
                                disabled={!dirty || isPending || !m.enabled}
                                title={
                                  !m.enabled
                                    ? "Activer le module avant d'éditer sa config"
                                    : ""
                                }
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {isPending ? (
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                ) : (
                                  <Save className="w-2.5 h-2.5" />
                                )}
                                enregistrer
                              </button>
                            </div>
                          </div>
                          <textarea
                            value={draft}
                            onChange={(e) =>
                              setConfigDraft((s) => ({
                                ...s,
                                [m.module_key]: e.target.value,
                              }))
                            }
                            rows={Math.max(4, draft.split("\n").length)}
                            spellCheck={false}
                            className="w-full bg-surface-2 border border-border-subtle text-[11px] font-mono text-text-primary px-2 py-1.5 focus:outline-none focus:border-accent-primary/40 resize-vertical"
                          />
                          {cfgErr && (
                            <div className="flex items-start gap-1.5 text-status-danger text-[11px]">
                              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>{cfgErr}</span>
                            </div>
                          )}
                          {!m.enabled && !cfgErr && (
                            <p className="text-[10px] text-text-muted italic">
                              Module désactivé · l&apos;édition de la config
                              est bloquée tant qu&apos;il n&apos;est pas
                              activé.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-text-muted italic">
        Source : <span className="font-mono">core.module_registry</span> ×{" "}
        <span className="font-mono">core.tenant_modules</span>. Chaque action
        écrit une row dans <span className="font-mono">audit_logs</span>.
      </p>
    </section>
  );
}
