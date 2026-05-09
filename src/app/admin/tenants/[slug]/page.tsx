"use client";

// V1.1.E — Console détail tenant (refonte).
//
// Sections (de haut en bas) :
//   - Header branding : badge tenant coloré + displayName + slug + status
//   - Informations générales (légères, lecture seule sauf édition tech ci-dessous)
//   - Modules (matrice toggle + config jsonb + dépendances) — TenantModulesSection
//   - Branding (lecture seule V1.1.E)
//   - Features cockpit (whitelist) + Modèle économique (édition existante)
//   - Architecture / Catalogue / Stock / Livraisons / Transport / VLM (panels existants)
//   - Audit log (20 dernières) — TenantAuditLogSection
//
// Source : GET /api/admin/tenants/[slug]. Édition features/business_model :
// PATCH /api/admin/tenants/[slug]. Modules : routes dédiées.

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
  Palette,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import {
  FEATURE_KEYS,
  type AdminTenantRow,
  type FeatureKey,
  type TenantFeatures,
  type TenantBusinessModel,
} from "@/lib/tenant-admin-config";
import { getTenantBranding } from "@/lib/tenant/branding";
import { SubscriptionsSection } from "@/components/admin/SubscriptionsSection";
import { ArchitectureSection } from "@/components/admin/ArchitectureSection";
import { CatalogSection } from "@/components/admin/CatalogSection";
import { StockSection } from "@/components/admin/StockSection";
import { DeliveriesSection } from "@/components/admin/DeliveriesSection";
import { TransportSection } from "@/components/admin/TransportSection";
import { VlmPanel } from "@/components/admin/VlmPanel";
import { TenantModulesSection } from "@/components/admin/TenantModulesSection";
import { TenantAuditLogSection } from "@/components/admin/TenantAuditLogSection";

const FEATURE_LABELS: Record<FeatureKey, string> = {
  crm: "CRM",
  pipeline: "Pipeline",
  productions: "Productions",
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
  const [auditTick, setAuditTick] = useState(0);

  function loadTenant() {
    setLoading(true);
    fetch(`/api/admin/tenants/${encodeURIComponent(slug)}`, { cache: "no-store" })
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
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(loadTenant, [slug]);

  const dirty = useMemo(() => {
    if (!tenant) return false;
    const origFeatures = tenant.features || {};
    const featDirty = FEATURE_KEYS.some(
      (k) => Boolean(features[k]) !== Boolean(origFeatures[k]),
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

    const origFeatures = tenant.features || {};
    const featDiff: TenantFeatures = {};
    for (const k of FEATURE_KEYS) {
      if (Boolean(features[k]) !== Boolean(origFeatures[k])) {
        featDiff[k] = Boolean(features[k]);
      }
    }
    if (Object.keys(featDiff).length > 0) payload.features = featDiff;

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
      setAuditTick((t) => t + 1);
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

  // Branding pour le header — la table tenant_branding peut renseigner
  // primary_color / logo_url. On retombe sur la map V1 sinon.
  const fallbackBranding = getTenantBranding(tenant.slug);
  const primaryColor = tenant.primaryColor || fallbackBranding.primaryColor || "#374151";
  const subLabel = fallbackBranding.subLabel;
  const displayName = tenant.displayName || fallbackBranding.displayName;
  const logoUrl = tenant.logoUrl || fallbackBranding.logoUrl;

  const enabledModules = tenant.modulesEnabled ?? 0;
  const totalModules = tenant.modulesTotal ?? 0;

  return (
    <div className="p-8 min-h-screen space-y-6">
      <Link
        href="/admin/tenants"
        className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="w-3 h-3" />
        Tous les tenants
      </Link>

      {/* Header branding ----------------------------------------------------- */}
      <section
        className="card-sharp p-5 border-l-4"
        style={{ borderLeftColor: primaryColor }}
      >
        <div className="flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${displayName} logo`}
              className="w-12 h-12 object-contain"
            />
          ) : (
            <span
              className="inline-flex items-center justify-center w-12 h-12 text-base font-bold uppercase tracking-tight border"
              style={{
                background: `${primaryColor}1A`,
                borderColor: `${primaryColor}55`,
                color: primaryColor,
              }}
              aria-hidden
            >
              {displayName.slice(0, 2)}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-headline text-xl font-extrabold text-text-primary leading-tight">
              {displayName}
            </h1>
            <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5 flex-wrap">
              <span className="font-mono">slug={tenant.slug}</span>
              <span>·</span>
              <span>{subLabel}</span>
              <span>·</span>
              <span>profile={tenant.profile}</span>
              <span>·</span>
              <span
                className={
                  tenant.status === "active" ? "text-emerald-300" : ""
                }
              >
                {tenant.status}
              </span>
            </div>
          </div>
          <div className="text-right text-xs text-text-muted leading-tight">
            <div className="font-mono text-text-primary">
              {enabledModules}
              <span className="text-text-muted">/{totalModules}</span> modules
            </div>
            <div>{tenant.userCount} utilisateurs</div>
          </div>
        </div>
      </section>

      <ModuleHeader
        icon={Shield}
        title="Configuration"
        subtitle="Modules, branding, features cockpit, audit"
      />

      {/* Infos générales ----------------------------------------------------- */}
      <section className="card-sharp p-6">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline mb-4">
          Informations générales
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
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
          <Field label="Users associés" value={String(tenant.userCount)} />
          <Field label="Mis à jour" value={tenant.updatedAt || "—"} mono />
        </div>
      </section>

      {/* Modules ------------------------------------------------------------- */}
      <TenantModulesSection
        tenantSlug={tenant.slug}
        onActivityRefresh={() => {
          loadTenant();
          setAuditTick((t) => t + 1);
        }}
      />

      {/* Branding (lecture seule V1.1.E) ------------------------------------- */}
      <section className="card-sharp p-6">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4 text-accent-glow" />
          Branding
          <span className="text-[10px] text-text-muted font-mono normal-case font-normal">
            (lecture seule V1.1.E)
          </span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <Field label="Display name" value={displayName} />
          <Field label="Sous-libellé" value={subLabel} />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Couleur primaire
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-text-primary font-mono text-[11px]">
              <span
                className="inline-block w-4 h-4 border border-border-subtle"
                style={{ background: primaryColor }}
                aria-hidden
              />
              {primaryColor}
            </div>
          </div>
          <Field label="Logo URL" value={logoUrl || "—"} mono />
        </div>
        <p className="text-[10px] text-text-muted mt-3 italic">
          Source : <span className="font-mono">core.tenant_branding</span> +
          fallback <span className="font-mono">lib/tenant/branding.ts</span>.
          L&apos;édition arrive en V1.1.F.
        </p>
      </section>

      {/* Features cockpit (édition existante) -------------------------------- */}
      <section className="card-sharp p-6">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline mb-4">
          Features cockpit
          <span className="ml-2 text-[10px] text-text-muted font-mono normal-case font-normal">
            (whitelist côté app)
          </span>
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
        <p className="text-[10px] text-text-muted mt-3 italic">
          Différent des modules : la whitelist features pilote les écrans
          cockpit (sidebar, routes UI). Les{" "}
          <span className="font-mono">core.tenant_modules</span> ci-dessus
          pilotent le backend (capabilities business).
        </p>
      </section>

      {/* Modèle économique --------------------------------------------------- */}
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

      {/* Connexions / outils (lecture masquée) ------------------------------- */}
      <section className="card-sharp p-6 text-xs">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline mb-4">
          Connexions / outils (lecture masquée)
        </h2>
        <p className="text-text-muted mb-3">
          Les clés techniques ne sont jamais exposées par cette page. État
          dérivé du nom de feature uniquement.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
            ),
          )}
        </div>
      </section>

      {/* Architecture -------------------------------------------------------- */}
      <ArchitectureSection
        slug={tenant.slug}
        initial={tenant.architectureConfig}
        onSaved={(next) => setTenant((t) => (t ? { ...t, architectureConfig: next } : t))}
      />

      <CatalogSection
        tenantSlug={tenant.slug}
        catalogEnabled={
          tenant.architectureConfig?.standardModules?.catalog === true
        }
      />

      <SubscriptionsSection
        tenantSlug={tenant.slug}
        currency={(tenant.businessModel?.currency as string) || "EUR"}
      />

      <StockSection
        tenantSlug={tenant.slug}
        enabled={tenant.architectureConfig?.standardModules?.stock === true}
      />

      <DeliveriesSection
        tenantSlug={tenant.slug}
        enabled={tenant.architectureConfig?.standardModules?.delivery === true}
        currency={(tenant.businessModel?.currency as string) || "EUR"}
      />

      <TransportSection
        tenantSlug={tenant.slug}
        enabled={tenant.architectureConfig?.standardModules?.transport === true}
        currency={(tenant.businessModel?.currency as string) || "EUR"}
      />

      <VlmPanel
        tenantSlug={tenant.slug}
        enabled={tenant.architectureConfig?.verticalModules?.medicalDistribution === true}
        currency={(tenant.businessModel?.currency as string) || "EUR"}
      />

      {/* Audit log ----------------------------------------------------------- */}
      <TenantAuditLogSection tenantSlug={tenant.slug} refreshKey={auditTick} />

      {/* Footer -------------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-2 sticky bottom-2 z-10">
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
          {saving ? "Enregistrement…" : "Enregistrer features / business model"}
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
