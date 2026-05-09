"use client";

// V1.1.E — Audit log d'un tenant.
//
// 20 dernières rows mybotia_business.audit_logs filtrées par tenant_id.
// Source : GET /api/admin/tenants/[slug]/audit-log

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, AlertCircle, RefreshCcw, ChevronDown, ChevronRight } from "lucide-react";
import type { AdminAuditLogEntry } from "@/types/admin-audit";
import { cn } from "@/lib/utils";

interface Props {
  tenantSlug: string;
  /** Permet à la page parent de déclencher un rafraîchissement (incrémenter pour reload). */
  refreshKey?: number;
}

const ACTION_BADGE: Record<string, { label: string; cls: string }> = {
  module_toggled: { label: "module", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  module_config_updated: { label: "config", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  INSERT: { label: "insert", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  UPDATE: { label: "update", cls: "bg-amber-400/15 text-amber-200 border-amber-400/30" },
  DELETE: { label: "delete", cls: "bg-status-danger/15 text-status-danger border-status-danger/30" },
};

export function TenantAuditLogSection({ tenantSlug, refreshKey = 0 }: Props) {
  const [entries, setEntries] = useState<AdminAuditLogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/admin/tenants/${encodeURIComponent(tenantSlug)}/audit-log?limit=20`,
        { cache: "no-store" },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setEntries(j.entries || []);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <section className="card-sharp p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline flex items-center gap-2">
          <History className="w-4 h-4 text-accent-glow" />
          Audit log
          <span className="text-[10px] text-text-muted font-mono normal-case font-normal">
            (20 dernières)
          </span>
        </h2>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase border border-border-subtle text-text-muted hover:text-text-primary disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
          ) : (
            <RefreshCcw className="w-2.5 h-2.5" />
          )}
          rafraîchir
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2.5 border border-status-danger/30 bg-status-danger/10 text-status-danger text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!error && loading && !entries && (
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      )}

      {!error && entries && entries.length === 0 && (
        <p className="text-xs text-text-muted italic">
          Aucune entrée d&apos;audit pour ce tenant.
        </p>
      )}

      {!error && entries && entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border-subtle">
              <tr>
                <th className="text-left py-2 px-2 w-6"></th>
                <th className="text-left py-2 px-2">Quand</th>
                <th className="text-left py-2 px-2">Action</th>
                <th className="text-left py-2 px-2">Table / Row</th>
                <th className="text-left py-2 px-2">Acteur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {entries.map((e) => {
                const isOpen = expanded[e.id] === true;
                const badge = ACTION_BADGE[e.action] || {
                  label: e.action,
                  cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
                };
                return (
                  <FragmentRow
                    key={e.id}
                    entry={e}
                    badge={badge}
                    isOpen={isOpen}
                    onToggle={() =>
                      setExpanded((s) => ({ ...s, [e.id]: !s[e.id] }))
                    }
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FragmentRow({
  entry,
  badge,
  isOpen,
  onToggle,
}: {
  entry: AdminAuditLogEntry;
  badge: { label: string; cls: string };
  isOpen: boolean;
  onToggle: () => void;
}) {
  const date = new Date(entry.createdAt);
  const formatted = Number.isFinite(date.getTime())
    ? date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : entry.createdAt;
  return (
    <>
      <tr className="hover:bg-surface-2/40">
        <td className="py-2 px-1">
          <button
            onClick={onToggle}
            aria-label={isOpen ? "Replier" : "Déplier"}
            className="text-text-muted hover:text-text-primary"
          >
            {isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </td>
        <td className="py-2 px-2 text-text-muted text-[11px] font-mono whitespace-nowrap">
          {formatted}
        </td>
        <td className="py-2 px-2">
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-bold border",
              badge.cls,
            )}
            title={entry.action}
          >
            {badge.label}
          </span>
        </td>
        <td className="py-2 px-2 text-[11px] font-mono text-text-secondary">
          <div className="leading-tight">
            <div>{entry.tableName}</div>
            <div className="text-[10px] text-text-muted truncate max-w-[280px]">
              {entry.rowId}
            </div>
          </div>
        </td>
        <td className="py-2 px-2 text-[11px] text-text-muted">
          {entry.userEmail || (entry.userId ? entry.userId.slice(0, 8) : "—")}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-surface-2/30">
          <td colSpan={5} className="px-3 pb-3 pt-1">
            <div className="ml-6">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                diff
              </div>
              <pre className="bg-surface-2 border border-border-subtle text-[11px] font-mono text-text-primary px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-words">
                {entry.diff
                  ? JSON.stringify(entry.diff, null, 2)
                  : "(aucun diff)"}
              </pre>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
