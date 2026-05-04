"use client";

// Bloc 6A — Détail tenant + édition légère features/business_model.

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Save,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import {
  FEATURE_KEYS,
  type AdminTenantRow,
  type FeatureKey,
  type TenantFeatures,
  type TenantBusinessModel,
} from "@/lib/tenant-admin-config";
import { SubscriptionsSection } from "@/components/admin/SubscriptionsSection";
import { ArchitectureSection } from "@/components/admin/ArchitectureSection";
import { CatalogSection } from "@/components/admin/CatalogSection";
import { StockSection } from "@/components/admin/StockSection";
import { DeliveriesSection } from "@/components/admin/DeliveriesSection";
import { TransportSection } from "@/components/admin/TransportSection";

const FEATURE_LABELS: Record<FeatureKey, string> = {
  crm: "CRM",
  pipeline: "Pipeline",
  tasks: "Tâches",
  documents: "Documents",
  finance: "Finances",
  agenda: "Agenda",
  voice: "Voice",
  whatsapp: "WhatsApp",
  delivery: "Livraison",
  transport: "Transport",
  stock: "Stock",
  penylane: "Pennylane",
  pipedrive: "Pipedrive",
  advancedGed: "GED avancée",
  adminTools: "Admin tools",
  pdf: "PDF",
  memory: "Mémoire IA",
};

export default function AdminTenantDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug ? decodeURIComponent(params.slug) : "";

  const [tenant, setTenant] = useState<AdminTenantRow | null>(null);
  const [features, setFeatures] = useState<TenantFeatures>({});
  const [bmText, setBmText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function loadTenant() {
    setLoading(true);
    fetch(`/api/admin/tenants/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => {
        const t = j.tenant as AdminTenantRow;
        setTenant(t);
        setFeatures(t.features || {});
        setBmText(t.businessModel ? JSON.stringify(t.businessModel, null, 2) : "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadTenant, [slug]);

  const dirty = useMemo(() => {
    if (!tenant) return false;
    const origFeatures = tenant.features || {};
    const featDirty = FEATURE_KEYS.some(
      (k) => Boolean(features[k]) !== Boolean(origFeatures[k])
    );
    const origBmText = tenant.businessModel ? JSON.stringify(tenant.businessModel, null, 2) : "";
    const bmDirty = bmText.trim() !== origBmText.trim();
    return featDirty || bmDirty;
  }, [tenant, features, bmText]);

  async function handleSave() {
    if (!tenant) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: { features?: TenantFeatures; business_model?: TenantBusinessModel | null } = {};

    // features (envoyer le diff)
    const origFeatures = tenant.features || {};
    const featDiff: TenantFeatures = {};
    for (const k of FEATURE_KEYS) {
      if (Boolean(features[k]) !== Boolean(origFeatures[k])) {
        featDiff[k] = Boolean(features[k]);
      }
    }
    if (Object.keys(featDiff).length > 0) payload.features = featDiff;

    // business_model
    const trimmed = bmText.trim();
    const origBmText = tenant.businessModel ? JSON.stringify(tenant.businessModel, null, 2) : "";
    if (trimmed !== origBmText.trim()) {
      if (trimmed === "") {
        payload.business_model = null;
      } else {
        try {
          payload.business_model = JSON.parse(trimmed);
        } catch {
          setError("business_model : JSON invalide");
          setSaving(false);
          return;
        }
      }
    }

    try {
      const res = await fetch(`/api/admin/tenants/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setTenant(j.tenant);
      setFeatures(j.tenant?.features || {});
      setBmText(j.tenant?.businessModel ? JSON.stringify(j.tenant.businessModel, null, 2) : "");
      setSuccess("Modifications enregistrées.");
    } catch (e) {
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

  if (error && !tenant) {
    return (
      <div className="p-8">
        <button
          onClick={() => router.push("/admin/tenants")}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary mb-4"
        >
          <ArrowLeft className="w-3 h-3" />
          retour
        </button>
        <div className="flex items-start gap-2 p-4 border border-status-danger/30 bg-status-danger/10 text-status-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <div className="p-8 min-h-screen space-y-6">
      <Link
        href="/admin/tenants"
        className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="w-3 h-3" />
        Tous les tenants
      </Link>

      <ModuleHeader
        icon={Shield}
        title={`Admin · ${tenant.displayName}`}
        subtitle={`slug=${tenant.slug} · profile=${tenant.profile} · status=${tenant.status}`}
      />

      {/* Infos générales */}
      <section className="card-sharp p-6">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline mb-4">
          Informations générales
        </h2>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <Field label="UUID" value={tenant.id} mono />
          <Field label="Slug" value={tenant.slug} mono />
          <Field label="Display name" value={tenant.displayName} />
          <Field label="Legal name" value={tenant.legalName || "—"} />
          <Field label="Profile" value={tenant.profile} />
          <Field label="Status" value={tenant.status} />
          <Field label="Locale" value={tenant.locale || "—"} />
          <Field label="Timezone" value={tenant.timezone || "—"} />
          <Field
            label="Quota users"
            value={tenant.quotaUsers !== null ? String(tenant.quotaUsers) : "—"}
          />
          <Field
            label="Quota tokens / jour"
            value={
              tenant.quotaLlmTokensDaily !== null
                ? Number(tenant.quotaLlmTokensDaily).toLocaleString("fr-FR")
                : "—"
            }
          />
          <Field
            label="Users associés"
            value={String(tenant.userCount)}
          />
          <Field label="Mis à jour" value={tenant.updatedAt || "—"} mono />
        </div>
      </section>

      {/* Features */}
      <section className="card-sharp p-6">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline mb-4">
          Modules / features
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {FEATURE_KEYS.map((k) => (
            <label
              key={k}
              className="flex items-center gap-2 p-2 bg-surface-2/50 border border-border-subtle hover:bg-surface-2 cursor-pointer text-xs"
            >
              <input
                type="checkbox"
                checked={Boolean(features[k])}
                onChange={(e) =>
                  setFeatures((s) => ({ ...s, [k]: e.target.checked }))
                }
                className="accent-accent-primary"
              />
              <span className="font-mono text-text-muted text-[10px]">{k}</span>
              <span className="text-text-secondary ml-auto">
                {FEATURE_LABELS[k]}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Business model */}
      <section className="card-sharp p-6">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline mb-4">
          Modèle économique
        </h2>
        <textarea
          value={bmText}
          onChange={(e) => setBmText(e.target.value)}
          rows={12}
          placeholder='{"hasOneShot": true, "hasRecurring": true, ...}'
          className="w-full bg-surface-2 border border-border-subtle text-xs font-mono text-text-primary px-3 py-2 focus:outline-none focus:border-accent-primary/40 resize-vertical"
        />
        <p className="text-[10px] text-text-muted mt-2">
          JSON libre. Vide = NULL côté DB. Schema indicatif :
          hasOneShot, hasRecurring, hasTokenBilling, hasMaintenance,
          setupDailyRate, monthlyMaintenance, tokenBillingMode, currency, kpiStatus.
        </p>
      </section>

      {/* Connexions / outils (lecture masquée) */}
      <section className="card-sharp p-6 text-xs">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline mb-4">
          Connexions / outils (lecture masquée)
        </h2>
        <p className="text-text-muted mb-3">
          Les clés techniques ne sont jamais exposées par cette page. État
          dérivé du nom de feature uniquement.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(["crm", "voice", "whatsapp", "penylane", "pipedrive", "advancedGed"] as const).map(
            (k) => (
              <div
                key={k}
                className="flex items-center justify-between p-2 bg-surface-2/50 border border-border-subtle"
              >
                <span className="font-mono text-text-muted">{k}</span>
                {features[k] ? (
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" /> configuré
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-text-muted">
                    <XCircle className="w-3 h-3" /> manquant
                  </span>
                )}
              </div>
            )
          )}
        </div>
      </section>

      {/* Bloc 7A — section architecture du tenant */}
      <ArchitectureSection
        slug={tenant.slug}
        initial={tenant.architectureConfig}
        onSaved={(next) => setTenant((t) => (t ? { ...t, architectureConfig: next } : t))}
      />

      {/* Bloc 7B — section catalogue produits/services */}
      <CatalogSection
        tenantSlug={tenant.slug}
        catalogEnabled={
          tenant.architectureConfig?.standardModules?.catalog === true
        }
      />

      {/* Bloc 6D — section abonnements (lecture/édition DB core.subscriptions) */}
      <SubscriptionsSection
        tenantSlug={tenant.slug}
        currency={(tenant.businessModel?.currency as string) || "EUR"}
      />

      {/* Bloc 7C — Stock / inventaire */}
      <StockSection
        tenantSlug={tenant.slug}
        enabled={tenant.architectureConfig?.standardModules?.stock === true}
      />

      {/* Bloc 7C — Livraisons */}
      <DeliveriesSection
        tenantSlug={tenant.slug}
        enabled={tenant.architectureConfig?.standardModules?.delivery === true}
        currency={(tenant.businessModel?.currency as string) || "EUR"}
      />

      {/* Bloc 7C — Transport (étapes) */}
      <TransportSection
        tenantSlug={tenant.slug}
        enabled={tenant.architectureConfig?.standardModules?.transport === true}
        currency={(tenant.businessModel?.currency as string) || "EUR"}
      />

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 text-[11px]">
          {error && (
            <div className="flex items-start gap-1.5 text-status-danger">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && <div className="text-emerald-300">{success}</div>}
        </div>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold uppercase tracking-tight border transition-all ${
            dirty && !saving
              ? "text-accent-glow bg-accent-primary/10 hover:bg-accent-primary/20 border-accent-primary/30"
              : "text-text-muted bg-surface-3/50 border-border-subtle cursor-not-allowed"
          }`}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`mt-0.5 text-text-primary ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </div>
    </div>
  );
}
