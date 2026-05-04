"use client";

// Bloc 6D — section Abonnements récurrents dans /admin/tenants/[slug].
// CRUD light (POST + PATCH) sur core.subscriptions.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  type Subscription,
  type SubscriptionCategory,
  type SubscriptionStatus,
  type BillingPeriod,
  type TokenBillingMode,
  SUBSCRIPTION_CATEGORIES,
  SUBSCRIPTION_STATUSES,
  BILLING_PERIODS,
  TOKEN_BILLING_MODES,
  CATEGORY_LABEL,
  STATUS_LABEL,
  TOKEN_BILLING_MODE_LABEL,
} from "@/lib/subscription-types";

const STATUS_CHIP: Record<SubscriptionStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  setup: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  to_configure: "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

interface Props {
  tenantSlug: string;
  currency: string;
}

export function SubscriptionsSection({ tenantSlug, currency }: Props) {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/subscriptions?tenant=${encodeURIComponent(tenantSlug)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => setSubs(j.subscriptions || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [tenantSlug]);

  const totals = useMemo(() => {
    let mrr = 0;
    let active = 0;
    let setup = 0;
    let paused = 0;
    let tokensIncludedTotal = 0; // Bloc 6E
    for (const s of subs) {
      if (s.status === "active") {
        mrr += s.monthlyAmount;
        active += 1;
        if (s.category === "tokens_package" && s.includedMonthlyTokens) {
          tokensIncludedTotal += s.includedMonthlyTokens;
        }
      } else if (s.status === "setup") setup += 1;
      else if (s.status === "paused") paused += 1;
    }
    return { mrr, arr: mrr * 12, active, setup, paused, tokensIncludedTotal };
  }, [subs]);

  return (
    <section className="card-sharp p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
          Abonnements récurrents
        </h2>
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            setError(null);
            setSuccess(null);
          }}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20"
        >
          <Plus className="w-3 h-3" />
          Nouvel abonnement
        </button>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
        <Total label="MRR configuré" value={`${Math.round(totals.mrr).toLocaleString("fr-FR")} ${currency}`} accent />
        <Total label="ARR configuré" value={`${Math.round(totals.arr).toLocaleString("fr-FR")} ${currency}`} />
        <Total label="Actifs" value={String(totals.active)} />
        <Total label="Setup" value={String(totals.setup)} />
        <Total label="Pausés" value={String(totals.paused)} />
        <Total
          label="Tokens inclus / mois"
          value={
            totals.tokensIncludedTotal > 0
              ? `${totals.tokensIncludedTotal.toLocaleString("fr-FR")} tk`
              : "—"
          }
        />
      </div>

      {/* Etat */}
      {error && (
        <div className="flex items-start gap-1.5 text-[11px] text-status-danger mb-3">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && <div className="text-[11px] text-emerald-300 mb-3">{success}</div>}

      {/* Modal create */}
      {showCreate && (
        <CreateForm
          tenantSlug={tenantSlug}
          onCancel={() => setShowCreate(false)}
          onCreated={(s) => {
            setSubs((prev) => [s, ...prev]);
            setShowCreate(false);
            setSuccess(`Abonnement "${s.label}" créé.`);
          }}
        />
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-accent-glow" />
        </div>
      ) : subs.length === 0 ? (
        <p className="text-xs text-text-muted italic text-center py-6">
          Aucun abonnement configuré pour ce tenant.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 px-2">Client</th>
                <th className="text-left py-2 px-2">Label</th>
                <th className="text-left py-2 px-2">Catégorie</th>
                <th className="text-left py-2 px-2">Statut</th>
                <th className="text-right py-2 px-2">Montant</th>
                <th className="text-right py-2 px-2">Tokens</th>
                <th className="text-left py-2 px-2">Période</th>
                <th className="text-right py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {subs.map((s) => (
                <SubRow
                  key={s.id}
                  sub={s}
                  onUpdated={(updated) => {
                    setSubs((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                    setSuccess(`Abonnement "${updated.label}" mis à jour.`);
                  }}
                  onError={(msg) => setError(msg)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Total({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`p-3 border ${accent ? "border-accent-primary/30 bg-accent-primary/5" : "border-border-subtle bg-surface-2/50"}`}>
      <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`text-sm font-bold mt-1 ${accent ? "text-accent-glow" : "text-text-primary"}`}>{value}</p>
    </div>
  );
}

function SubRow({
  sub,
  onUpdated,
  onError,
}: {
  sub: Subscription;
  onUpdated: (s: Subscription) => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    monthlyAmount: sub.monthlyAmount,
    status: sub.status,
    label: sub.label,
    clientName: sub.clientName,
  });

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      onUpdated(j.subscription);
      setEditing(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="hover:bg-surface-2/40">
      <td className="py-2 px-2 text-text-primary">
        {editing ? (
          <input
            type="text"
            value={draft.clientName}
            onChange={(e) => setDraft((d) => ({ ...d, clientName: e.target.value }))}
            className="w-full bg-surface-2 border border-border-subtle px-2 py-1"
          />
        ) : (
          sub.clientName
        )}
      </td>
      <td className="py-2 px-2 text-text-secondary">
        {editing ? (
          <input
            type="text"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            className="w-full bg-surface-2 border border-border-subtle px-2 py-1"
          />
        ) : (
          sub.label
        )}
      </td>
      <td className="py-2 px-2 text-text-muted">
        <span className="font-mono text-[10px]">{CATEGORY_LABEL[sub.category]}</span>
      </td>
      <td className="py-2 px-2">
        {editing ? (
          <select
            value={draft.status}
            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as SubscriptionStatus }))}
            className="bg-surface-2 border border-border-subtle px-2 py-1 text-xs"
          >
            {SUBSCRIPTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight border ${STATUS_CHIP[sub.status]}`}
          >
            {STATUS_LABEL[sub.status]}
          </span>
        )}
      </td>
      <td className="py-2 px-2 text-right text-text-primary font-mono">
        {editing ? (
          <input
            type="number"
            step="0.01"
            min="0"
            value={draft.monthlyAmount}
            onChange={(e) =>
              setDraft((d) => ({ ...d, monthlyAmount: parseFloat(e.target.value) || 0 }))
            }
            className="w-24 text-right bg-surface-2 border border-border-subtle px-2 py-1"
          />
        ) : (
          `${Math.round(sub.monthlyAmount).toLocaleString("fr-FR")} ${sub.currency}`
        )}
      </td>
      <td className="py-2 px-2 text-right text-text-muted font-mono text-[10px]">
        {sub.includedMonthlyTokens != null ? (
          <span title={`Mode: ${sub.tokenBillingMode || "—"} · Surcoût/1k: ${sub.overagePricePer1000Tokens != null ? sub.overagePricePer1000Tokens : "—"}`}>
            {sub.includedMonthlyTokens.toLocaleString("fr-FR")} tk
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="py-2 px-2 text-text-muted text-[10px]">{sub.billingPeriod}</td>
      <td className="py-2 px-2 text-right">
        {editing ? (
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 text-accent-glow text-[10px] hover:underline"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {saving ? "..." : "Enregistrer"}
          </button>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-accent-glow text-[10px] hover:underline"
          >
            Modifier
          </button>
        )}
      </td>
    </tr>
  );
}

function CreateForm({
  tenantSlug,
  onCancel,
  onCreated,
}: {
  tenantSlug: string;
  onCancel: () => void;
  onCreated: (s: Subscription) => void;
}) {
  const [form, setForm] = useState({
    clientName: "",
    label: "",
    category: "ai_collaborator" as SubscriptionCategory,
    status: "active" as SubscriptionStatus,
    monthlyAmount: 0,
    billingPeriod: "monthly" as BillingPeriod,
    notes: "",
    // Bloc 6E
    includedMonthlyTokens: "" as string | number,
    overagePricePer1000Tokens: "" as string | number,
    tokenBillingMode: "" as "" | TokenBillingMode,
  });
  const isTokenPackage = form.category === "tokens_package";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...form, tenantSlug };
      // Bloc 6E — n'envoyer les champs tokens que si tokens_package + valeur fournie
      if (!isTokenPackage) {
        delete payload.includedMonthlyTokens;
        delete payload.overagePricePer1000Tokens;
        delete payload.tokenBillingMode;
      } else {
        payload.includedMonthlyTokens =
          form.includedMonthlyTokens === "" ? null : Number(form.includedMonthlyTokens);
        payload.overagePricePer1000Tokens =
          form.overagePricePer1000Tokens === "" ? null : Number(form.overagePricePer1000Tokens);
        payload.tokenBillingMode = form.tokenBillingMode === "" ? null : form.tokenBillingMode;
      }
      const res = await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      onCreated(j.subscription);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border border-accent-primary/30 bg-accent-primary/5 p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs"
    >
      <Field label="Client *">
        <input
          type="text"
          required
          value={form.clientName}
          onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
          placeholder="Cabinet Delpiano"
        />
      </Field>
      <Field label="Label *">
        <input
          type="text"
          required
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
          placeholder="Léa — collaboratrice IA"
        />
      </Field>
      <Field label="Catégorie">
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as SubscriptionCategory }))}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
        >
          {SUBSCRIPTION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Statut">
        <select
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as SubscriptionStatus }))}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
        >
          {SUBSCRIPTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Montant mensuel (EUR)">
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.monthlyAmount}
          onChange={(e) => setForm((f) => ({ ...f, monthlyAmount: parseFloat(e.target.value) || 0 }))}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
        />
      </Field>
      <Field label="Période de facturation">
        <select
          value={form.billingPeriod}
          onChange={(e) => setForm((f) => ({ ...f, billingPeriod: e.target.value as BillingPeriod }))}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
        >
          {BILLING_PERIODS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>
      {isTokenPackage && (
        <>
          <Field label="Tokens inclus / mois">
            <input
              type="number"
              min="0"
              step="1000"
              value={form.includedMonthlyTokens}
              onChange={(e) =>
                setForm((f) => ({ ...f, includedMonthlyTokens: e.target.value }))
              }
              placeholder="ex: 1000000"
              className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
            />
          </Field>
          <Field label="Prix dépassement / 1 000 tokens (EUR)">
            <input
              type="number"
              min="0"
              step="0.0001"
              value={form.overagePricePer1000Tokens}
              onChange={(e) =>
                setForm((f) => ({ ...f, overagePricePer1000Tokens: e.target.value }))
              }
              placeholder="ex: 0.02"
              className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
            />
          </Field>
          <Field label="Mode facturation tokens" className="md:col-span-2">
            <select
              value={form.tokenBillingMode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tokenBillingMode: e.target.value as "" | TokenBillingMode,
                }))
              }
              className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
            >
              <option value="">— non défini —</option>
              {TOKEN_BILLING_MODES.map((m) => (
                <option key={m} value={m}>
                  {TOKEN_BILLING_MODE_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}
      <Field label="Notes" className="md:col-span-2">
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5"
        />
      </Field>
      {error && (
        <div className="md:col-span-2 text-[11px] text-status-danger flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <div className="md:col-span-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight text-text-muted hover:text-text-primary"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/30 bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Créer
        </button>
      </div>
    </form>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className || ""}`}>
      <span className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">{label}</span>
      {children}
    </label>
  );
}
