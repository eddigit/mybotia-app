"use client";

// Bloc 7A — Section architecture du tenant.
// Édite : interfaceMode, primaryApp, standardModules, verticalModules, customModules.

import { useEffect, useState } from "react";
import {
  Layers,
  Globe,
  Workflow,
  AlertCircle,
  Save,
  Loader2,
} from "lucide-react";
import {
  type TenantArchitectureConfig,
  type InterfaceMode,
  type PrimaryAppType,
  INTERFACE_MODES,
  PRIMARY_APP_TYPES,
  STANDARD_MODULE_KEYS,
  VERTICAL_MODULE_KEYS,
  INTERFACE_MODE_LABEL,
  PRIMARY_APP_TYPE_LABEL,
  STANDARD_MODULE_LABEL,
  VERTICAL_MODULE_LABEL,
} from "@/lib/tenant-admin-config";

const DEFAULT_ARCH: TenantArchitectureConfig = {
  interfaceMode: "standard",
  primaryApp: { type: "mybotia_app", label: "Cockpit MyBotIA", url: null },
  standardModules: {},
  verticalModules: {},
  customModules: { enabled: false, key: null, label: null, billable: false, notes: null },
};

interface Props {
  slug: string;
  initial: TenantArchitectureConfig | null;
  onSaved?: (next: TenantArchitectureConfig | null) => void;
}

export function ArchitectureSection({ slug, initial, onSaved }: Props) {
  const [cfg, setCfg] = useState<TenantArchitectureConfig>(initial || DEFAULT_ARCH);
  const [initialJson, setInitialJson] = useState<string>(JSON.stringify(initial || DEFAULT_ARCH));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setCfg(initial || DEFAULT_ARCH);
    setInitialJson(JSON.stringify(initial || DEFAULT_ARCH));
  }, [initial]);

  const dirty = JSON.stringify(cfg) !== initialJson;

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ architecture_config: cfg }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      const next = (j.tenant?.architectureConfig as TenantArchitectureConfig) || cfg;
      setCfg(next);
      setInitialJson(JSON.stringify(next));
      setSuccess("Architecture enregistrée.");
      onSaved?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card-sharp p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-accent-glow" />
          <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
            Architecture du tenant
          </h2>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className={`inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border ${
            dirty && !saving
              ? "text-accent-glow bg-accent-primary/10 hover:bg-accent-primary/20 border-accent-primary/30"
              : "text-text-muted bg-surface-3/50 border-border-subtle cursor-not-allowed"
          }`}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {saving ? "..." : "Enregistrer"}
        </button>
      </div>

      {/* Bloc explicatif doctrine */}
      <div className="text-[11px] text-text-muted mb-5 grid grid-cols-1 md:grid-cols-2 gap-2">
        <Doctrine icon={Layers} title="Standard" desc="Cockpit MyBotIA générique : crm, finance, documents…" />
        <Doctrine icon={Workflow} title="Vertical" desc="Modules métier réutilisables : import-export, médical…" />
        <Doctrine icon={Globe} title="MVP externe" desc="Application dédiée client (URL ou embed). mybotia-app = supervision." />
        <Doctrine icon={AlertCircle} title="Custom facturable" desc="Spécifique client, workflow profond, PDF, règles propres." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Interface mode */}
        <Field label="Mode interface">
          <select
            value={cfg.interfaceMode}
            onChange={(e) =>
              setCfg((c) => ({ ...c, interfaceMode: e.target.value as InterfaceMode }))
            }
            className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-xs"
          >
            {INTERFACE_MODES.map((m) => (
              <option key={m} value={m}>
                {INTERFACE_MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </Field>

        {/* Primary app type */}
        <Field label="Application principale — type">
          <select
            value={cfg.primaryApp.type}
            onChange={(e) =>
              setCfg((c) => ({
                ...c,
                primaryApp: { ...c.primaryApp, type: e.target.value as PrimaryAppType },
              }))
            }
            className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-xs"
          >
            {PRIMARY_APP_TYPES.map((t) => (
              <option key={t} value={t}>
                {PRIMARY_APP_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Application principale — label">
          <input
            type="text"
            value={cfg.primaryApp.label || ""}
            onChange={(e) =>
              setCfg((c) => ({
                ...c,
                primaryApp: { ...c.primaryApp, label: e.target.value },
              }))
            }
            className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-xs"
          />
        </Field>

        <Field label="Application principale — URL (si externe)">
          <input
            type="url"
            value={cfg.primaryApp.url || ""}
            onChange={(e) =>
              setCfg((c) => ({
                ...c,
                primaryApp: { ...c.primaryApp, url: e.target.value || null },
              }))
            }
            placeholder="https://mvp-igh.example.com"
            className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-xs"
          />
        </Field>
      </div>

      {/* Standard modules */}
      <div className="mt-5">
        <h3 className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-2">
          Modules standards
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {STANDARD_MODULE_KEYS.map((k) => (
            <label
              key={k}
              className="flex items-center gap-2 p-2 bg-surface-2/50 border border-border-subtle text-xs cursor-pointer hover:bg-surface-2"
            >
              <input
                type="checkbox"
                checked={Boolean(cfg.standardModules?.[k])}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    standardModules: { ...c.standardModules, [k]: e.target.checked },
                  }))
                }
                className="accent-accent-primary"
              />
              <span className="text-text-secondary truncate">{STANDARD_MODULE_LABEL[k]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Vertical modules */}
      <div className="mt-5">
        <h3 className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-2">
          Extensions verticales
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {VERTICAL_MODULE_KEYS.map((k) => (
            <label
              key={k}
              className="flex items-center gap-2 p-2 bg-surface-2/50 border border-border-subtle text-xs cursor-pointer hover:bg-surface-2"
            >
              <input
                type="checkbox"
                checked={Boolean(cfg.verticalModules?.[k])}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    verticalModules: { ...c.verticalModules, [k]: e.target.checked },
                  }))
                }
                className="accent-accent-primary"
              />
              <span className="text-text-secondary truncate">{VERTICAL_MODULE_LABEL[k]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Custom modules */}
      <div className="mt-5 p-3 border border-amber-400/20 bg-amber-400/5">
        <h3 className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold mb-2">
          Custom client (facturable)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-xs text-text-secondary col-span-2">
            <input
              type="checkbox"
              checked={cfg.customModules?.enabled || false}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  customModules: { ...c.customModules, enabled: e.target.checked },
                }))
              }
              className="accent-accent-primary"
            />
            <span>Module custom activé</span>
          </label>
          <Field label="Clé custom">
            <input
              type="text"
              value={cfg.customModules?.key || ""}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  customModules: { ...c.customModules, key: e.target.value || null },
                }))
              }
              placeholder="vlmedical_custom"
              className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-xs"
            />
          </Field>
          <Field label="Label custom">
            <input
              type="text"
              value={cfg.customModules?.label || ""}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  customModules: { ...c.customModules, label: e.target.value || null },
                }))
              }
              placeholder="Module VL Medical"
              className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-xs"
            />
          </Field>
          <label className="flex items-center gap-2 text-xs text-text-secondary col-span-2">
            <input
              type="checkbox"
              checked={cfg.customModules?.billable || false}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  customModules: { ...c.customModules, billable: e.target.checked },
                }))
              }
              className="accent-accent-primary"
            />
            <span>Facturable au client (custom = setup ou abonnement séparé)</span>
          </label>
          <Field label="Notes custom" className="col-span-2">
            <textarea
              value={cfg.customModules?.notes || ""}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  customModules: { ...c.customModules, notes: e.target.value || null },
                }))
              }
              rows={2}
              placeholder="Workflows, PDF, règles métier spécifiques…"
              className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-xs"
            />
          </Field>
        </div>
      </div>

      {/* État */}
      {error && (
        <div className="flex items-start gap-1.5 text-[11px] text-status-danger mt-4">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && <div className="text-[11px] text-emerald-300 mt-4">{success}</div>}
    </section>
  );
}

function Doctrine({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Layers;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2 p-2 bg-surface-2/40 border border-border-subtle">
      <Icon className="w-3.5 h-3.5 text-accent-glow shrink-0 mt-0.5" />
      <div>
        <p className="text-[11px] font-bold text-text-primary">{title}</p>
        <p className="text-[10px] text-text-muted">{desc}</p>
      </div>
    </div>
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
