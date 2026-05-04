"use client";

// UB-9 — Configuration plan/budget IA d'un tenant.
// Source : GET/PUT /api/admin/billing/configure/[tenant_slug] (superadmin only).

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Wallet,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Save,
  CheckCircle2,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";

type PlanCode = "solo" | "equipe" | "service" | "per_establishment" | "custom";
type BudgetMode = "fixed_budget" | "per_establishment" | "custom";
type ConfigStatus = "active" | "paused" | "cancelled";

interface ConfigData {
  id: string;
  tenant_slug: string;
  tenant_label: string;
  status: ConfigStatus;
  ai_budget_monthly_eur: number | null;
  ai_budget_mode: BudgetMode | null;
  ai_markup_rate: number | null;
  budget_per_establishment_eur: number | null;
  establishment_count: number | null;
  soft_limit_percent: number | null;
  hard_limit_percent: number | null;
  recharge_enabled: boolean | null;
  business_plan_code: PlanCode | null;
  business_plan_label: string | null;
}

interface ConfigResponse {
  status: "configured" | "not_configured" | "anomaly_multiple_active";
  tenant: { id: string; slug: string; display_name: string };
  config: ConfigData | null;
  active_count?: number;
  message?: string;
}

const PLAN_PRESETS: Record<PlanCode, { label: string; budget: number; mode: BudgetMode }> = {
  solo: { label: "MyBotIA Solo", budget: 500, mode: "fixed_budget" },
  equipe: { label: "MyBotIA Équipe", budget: 890, mode: "fixed_budget" },
  service: { label: "MyBotIA Service", budget: 1490, mode: "fixed_budget" },
  per_establishment: { label: "Par établissement", budget: 0, mode: "per_establishment" },
  custom: { label: "Plan personnalisé", budget: 0, mode: "custom" },
};

interface FormState {
  business_plan_code: PlanCode;
  business_plan_label: string;
  ai_budget_mode: BudgetMode;
  ai_budget_monthly_eur: string;
  budget_per_establishment_eur: string;
  establishment_count: string;
  ai_markup_rate: string;
  soft_limit_percent: string;
  hard_limit_percent: string;
  recharge_enabled: boolean;
  status: ConfigStatus;
}

const INPUT_CLASS =
  "w-full bg-surface-2 border border-border-subtle px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-primary/40";

function defaultForm(): FormState {
  return {
    business_plan_code: "custom",
    business_plan_label: "Plan personnalisé",
    ai_budget_mode: "fixed_budget",
    ai_budget_monthly_eur: "0",
    budget_per_establishment_eur: "",
    establishment_count: "",
    ai_markup_rate: "1.20",
    soft_limit_percent: "70",
    hard_limit_percent: "100",
    recharge_enabled: true,
    status: "active",
  };
}

function fromConfig(c: ConfigData): FormState {
  return {
    business_plan_code: (c.business_plan_code as PlanCode) ?? "custom",
    business_plan_label: c.business_plan_label ?? "Plan personnalisé",
    ai_budget_mode: (c.ai_budget_mode as BudgetMode) ?? "fixed_budget",
    ai_budget_monthly_eur: c.ai_budget_monthly_eur?.toString() ?? "0",
    budget_per_establishment_eur:
      c.budget_per_establishment_eur?.toString() ?? "",
    establishment_count: c.establishment_count?.toString() ?? "",
    ai_markup_rate: c.ai_markup_rate?.toString() ?? "1.20",
    soft_limit_percent: c.soft_limit_percent?.toString() ?? "70",
    hard_limit_percent: c.hard_limit_percent?.toString() ?? "100",
    recharge_enabled: c.recharge_enabled ?? true,
    status: (c.status as ConfigStatus) ?? "active",
  };
}

export default function AdminBillingConfigurePage({
  params,
}: {
  params: Promise<{ tenant_slug: string }>;
}) {
  const { tenant_slug } = use(params);

  const [resp, setResp] = useState<ConfigResponse | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/billing/configure/${tenant_slug}`, { credentials: "same-origin" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j as ConfigResponse;
      })
      .then((j) => {
        setResp(j);
        if (j.config) setForm(fromConfig(j.config));
        else setForm(defaultForm());
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [tenant_slug]);

  // Auto-calc per_establishment
  const computedTotal = useMemo(() => {
    if (form.ai_budget_mode !== "per_establishment") return null;
    const per = Number(form.budget_per_establishment_eur);
    const count = Number(form.establishment_count);
    if (!Number.isFinite(per) || !Number.isFinite(count)) return null;
    return per * count;
  }, [form.ai_budget_mode, form.budget_per_establishment_eur, form.establishment_count]);

  function handlePlanCode(code: PlanCode) {
    const preset = PLAN_PRESETS[code];
    setForm((f) => ({
      ...f,
      business_plan_code: code,
      business_plan_label: preset.label,
      ai_budget_mode: preset.mode,
      ai_budget_monthly_eur:
        preset.budget > 0 ? preset.budget.toString() : f.ai_budget_monthly_eur,
    }));
  }

  function applyEstablishmentTotal() {
    if (computedTotal !== null) {
      setForm((f) => ({ ...f, ai_budget_monthly_eur: computedTotal.toString() }));
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const payload = {
        business_plan_code: form.business_plan_code,
        business_plan_label: form.business_plan_label,
        ai_budget_mode: form.ai_budget_mode,
        ai_budget_monthly_eur: Number(form.ai_budget_monthly_eur),
        budget_per_establishment_eur:
          form.budget_per_establishment_eur === ""
            ? null
            : Number(form.budget_per_establishment_eur),
        establishment_count:
          form.establishment_count === "" ? null : Number(form.establishment_count),
        ai_markup_rate: Number(form.ai_markup_rate),
        soft_limit_percent: Number(form.soft_limit_percent),
        hard_limit_percent: Number(form.hard_limit_percent),
        recharge_enabled: form.recharge_enabled,
        status: form.status,
      };
      const r = await fetch(`/api/admin/billing/configure/${tenant_slug}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSavedAt(Date.now());
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
      </div>
    );
  }

  const tenantLabel = resp?.tenant.display_name || tenant_slug;

  return (
    <div className="p-8 min-h-screen space-y-6 max-w-3xl">
      <ModuleHeader
        icon={Wallet}
        title="Configurer le plan IA"
        subtitle={`${tenantLabel} · ${tenant_slug}`}
        actions={
          <Link
            href="/admin/billing"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary hover:border-accent-primary/30"
          >
            <ArrowLeft className="w-3 h-3" />
            Retour Billing
          </Link>
        }
      />

      {resp?.status === "anomaly_multiple_active" && (
        <div className="flex items-start gap-2 p-4 border border-status-danger/40 bg-status-danger/10 text-status-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold uppercase tracking-tight">Anomalie détectée</p>
            <p className="text-xs mt-1">
              Plusieurs subscriptions IA actives sur ce tenant ({resp.active_count}). Cleanup
              manuel requis avant configuration via cette interface.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 border border-status-danger/30 bg-status-danger/10 text-status-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {savedAt && !error && (
        <div className="flex items-start gap-2 p-3 border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Plan enregistré.</span>
        </div>
      )}

      <section className="card-sharp p-6 space-y-5">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
          Plan commercial
        </h2>

        <Field label="Code plan">
          <select
            value={form.business_plan_code}
            onChange={(e) => handlePlanCode(e.target.value as PlanCode)}
            className={INPUT_CLASS}
          >
            <option value="solo">Solo (500 € HT)</option>
            <option value="equipe">Équipe (890 € HT)</option>
            <option value="service">Service (1 490 € HT)</option>
            <option value="per_establishment">Par établissement</option>
            <option value="custom">Personnalisé</option>
          </select>
        </Field>

        <Field label="Label affiché côté client">
          <input
            type="text"
            value={form.business_plan_label}
            onChange={(e) => setForm((f) => ({ ...f, business_plan_label: e.target.value }))}
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Statut">
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ConfigStatus }))}
            className={INPUT_CLASS}
          >
            <option value="active">Actif</option>
            <option value="paused">En pause</option>
            <option value="cancelled">Annulé</option>
          </select>
        </Field>
      </section>

      <section className="card-sharp p-6 space-y-5">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
          Budget IA
        </h2>

        <Field label="Mode de calcul">
          <select
            value={form.ai_budget_mode}
            onChange={(e) =>
              setForm((f) => ({ ...f, ai_budget_mode: e.target.value as BudgetMode }))
            }
            className={INPUT_CLASS}
          >
            <option value="fixed_budget">Budget fixe mensuel</option>
            <option value="per_establishment">Par établissement</option>
            <option value="custom">Personnalisé</option>
          </select>
        </Field>

        {form.ai_budget_mode === "per_establishment" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Budget par établissement (€ HT)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.budget_per_establishment_eur}
                onChange={(e) =>
                  setForm((f) => ({ ...f, budget_per_establishment_eur: e.target.value }))
                }
                className={INPUT_CLASS}
                placeholder="ex: 250"
              />
            </Field>
            <Field label="Nombre d'établissements">
              <input
                type="number"
                min="0"
                step="1"
                value={form.establishment_count}
                onChange={(e) =>
                  setForm((f) => ({ ...f, establishment_count: e.target.value }))
                }
                className={INPUT_CLASS}
                placeholder="ex: 20"
              />
            </Field>
            {computedTotal !== null && computedTotal > 0 && (
              <div className="md:col-span-2 flex items-center justify-between p-3 border border-accent-primary/30 bg-accent-primary/5 text-xs">
                <span className="text-text-secondary">
                  Total calculé :{" "}
                  <span className="font-mono font-bold text-accent-glow">
                    {computedTotal.toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    € HT / mois
                  </span>
                </span>
                <button
                  type="button"
                  onClick={applyEstablishmentTotal}
                  className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/40 text-accent-glow hover:bg-accent-primary/10"
                >
                  Appliquer
                </button>
              </div>
            )}
          </div>
        )}

        <Field label="Budget IA mensuel total (€ HT)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.ai_budget_monthly_eur}
            onChange={(e) =>
              setForm((f) => ({ ...f, ai_budget_monthly_eur: e.target.value }))
            }
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Coefficient supervision (markup)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.ai_markup_rate}
            onChange={(e) => setForm((f) => ({ ...f, ai_markup_rate: e.target.value }))}
            className={INPUT_CLASS}
          />
          <p className="text-[10px] text-text-muted mt-1">
            Coût client = coût API × ce coefficient. Défaut : 1,20.
          </p>
        </Field>
      </section>

      <section className="card-sharp p-6 space-y-5">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
          Seuils & alertes
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Seuil d'alerte douce (%)">
            <input
              type="number"
              min="0"
              max="1000"
              step="1"
              value={form.soft_limit_percent}
              onChange={(e) => setForm((f) => ({ ...f, soft_limit_percent: e.target.value }))}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Seuil d'alerte dure (%)">
            <input
              type="number"
              min="0"
              max="1000"
              step="1"
              value={form.hard_limit_percent}
              onChange={(e) => setForm((f) => ({ ...f, hard_limit_percent: e.target.value }))}
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={form.recharge_enabled}
            onChange={(e) => setForm((f) => ({ ...f, recharge_enabled: e.target.checked }))}
          />
          <span>Recharge IA activable côté client</span>
        </label>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/admin/billing"
          className="px-4 py-2 text-[11px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary"
        >
          Annuler
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || resp?.status === "anomaly_multiple_active"}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold uppercase tracking-tight bg-accent-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
