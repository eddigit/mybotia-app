"use client";

// Bloc Settings V1.1.I-A — page /settings.
// Section "Mon profil" fonctionnelle (avatar, identité, téléphone, timezone, signature, préférences).
// Sections Société/Documents/IA/Intégrations : empty state honnête (V1.1.I-B+).
// Catalogue : CRUD complet (V1.1.I-A Builder 2).
//
// Doctrine : feedback_jamais_de_mock — tous les champs profil lus depuis /api/me/profile.

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { User, Building2, FileText, Bot, Plug, Package, Sparkles, Pencil, Trash2, Plus, Loader2, CheckCircle2, Save, RotateCcw, Shield, Lock, Layers, Wallet, Coins, MessageSquare } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { useAuth } from "@/contexts/auth-context";
import { UserAvatarV4 } from "@/components/conversations/UserAvatarV4";
import { CloudinaryUpload } from "@/components/shared/CloudinaryUpload";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/Toast";
import { apiFetch } from "@/lib/api-client";
import { FormModal, FormField, inputClass, selectClass, btnPrimary, btnSecondary } from "@/components/shared/FormModal";
import { useFormDraft } from "@/hooks/use-form-draft";
import { useCockpitFeatures } from "@/hooks/use-api";
import {
  CATALOG_ITEM_TYPES,
  CATALOG_ITEM_UNITS,
  TYPE_LABEL,
  UNIT_LABEL,
  type CatalogItem,
  type CatalogItemType,
  type CatalogItemUnit,
} from "@/lib/catalog-types";

type TabKey = "profile" | "company" | "documents" | "ai" | "integrations" | "catalogue" | "administration" | "vault";

// V1.2.E.1 — Doctrine `feedback_sidebar_un_seul_param` : la sidebar n'a QU'UN
// seul item bas (Paramètres → /settings). Toutes les consoles d'administration
// vivent ici en onglets conditionnels — Administration (super-admin) regroupe
// Modules / Tenants / Billing / Usage / Protocoles WhatsApp ; Vault est
// réservé à l'owner gilleskorzec@gmail.com.
const VAULT_OWNER_EMAIL = "gilleskorzec@gmail.com";

type Tab = { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> };

const BASE_TABS: Tab[] = [
  { key: "profile", label: "Mon profil", icon: User },
  { key: "company", label: "Société", icon: Building2 },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "ai", label: "IA", icon: Bot },
  { key: "integrations", label: "Intégrations", icon: Plug },
  { key: "catalogue", label: "Catalogue", icon: Package },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: cockpitFeatures } = useCockpitFeatures();
  const isSuperadmin = cockpitFeatures?.isSuperadmin ?? false;
  const adminToolsEnabled = cockpitFeatures?.features?.adminTools === true;
  const isVaultOwner = user?.email === VAULT_OWNER_EMAIL;

  const tabs = useMemo<Tab[]>(() => {
    const t: Tab[] = [...BASE_TABS];
    if (isSuperadmin && adminToolsEnabled) {
      t.push({ key: "administration", label: "Administration", icon: Shield });
    }
    if (isVaultOwner) {
      t.push({ key: "vault", label: "Vault", icon: Lock });
    }
    return t;
  }, [isSuperadmin, adminToolsEnabled, isVaultOwner]);

  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <ModuleHeader
        title="Paramètres"
        subtitle="Profil, société, documents, IA, intégrations"
      />

      <div className="flex gap-6">
        {/* Onglets verticaux */}
        <nav className="w-56 shrink-0 space-y-0.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-left border-l-2",
                  isActive
                    ? "text-accent-glow font-bold border-accent-primary bg-accent-primary/5"
                    : "text-text-muted hover:text-text-secondary hover:bg-surface-3/50 border-transparent"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          {activeTab === "profile" && <ProfileTab user={user} />}
          {activeTab === "company" && <CompanyTab />}
          {activeTab === "documents" && <DocumentsTab />}
          {activeTab === "ai" && <AiTab />}
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "catalogue" && <CatalogueTab />}
          {activeTab === "administration" && <AdministrationTab />}
          {activeTab === "vault" && <VaultTab />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timezones courantes (select profil)
// ---------------------------------------------------------------------------

const TIMEZONES = [
  "Europe/Paris",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Brussels",
  "Europe/Amsterdam",
  "Europe/Rome",
  "Europe/Zurich",
  "Europe/Luxembourg",
  "Atlantic/Reykjavik",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Montreal",
  "America/Sao_Paulo",
  "Africa/Tunis",
  "Africa/Casablanca",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Pacific/Auckland",
  "UTC",
];

// ---------------------------------------------------------------------------
// Type profil DB (retour /api/me/profile)
// ---------------------------------------------------------------------------

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  locale: string;
  phone: string | null;
  timezone: string;
  email_signature: string | null;
  preferences: {
    notifications_email: boolean;
    notifications_whatsapp: boolean;
    theme: "light" | "dark" | "auto";
    language: "fr" | "en";
  };
  is_superadmin: boolean;
  last_login_at: string | null;
}

interface ProfileFormValues {
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  phone: string;
  timezone: string;
  email_signature: string;
  notifications_email: boolean;
  notifications_whatsapp: boolean;
  theme: "light" | "dark" | "auto";
  language: "fr" | "en";
}

function profileToForm(p: UserProfile): ProfileFormValues {
  return {
    first_name: p.first_name ?? "",
    last_name: p.last_name ?? "",
    avatar_url: p.avatar_url,
    phone: p.phone ?? "",
    timezone: p.timezone || "Europe/Paris",
    email_signature: p.email_signature ?? "",
    notifications_email: p.preferences?.notifications_email ?? true,
    notifications_whatsapp: p.preferences?.notifications_whatsapp ?? true,
    theme: p.preferences?.theme ?? "auto",
    language: p.preferences?.language ?? "fr",
  };
}

// ---------------------------------------------------------------------------
// ProfileTab — form fonctionnel V1.1.I-A
// ---------------------------------------------------------------------------

function ProfileTab({
  user,
}: {
  user: ReturnType<typeof useAuth>["user"];
}) {
  const { refreshProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [values, setValues] = useState<ProfileFormValues>({
    first_name: "",
    last_name: "",
    avatar_url: null,
    phone: "",
    timezone: "Europe/Paris",
    email_signature: "",
    notifications_email: true,
    notifications_whatsapp: true,
    theme: "auto",
    language: "fr",
  });

  const { hasDraft, clearDraft } = useFormDraft("draft:settings-profile", values, setValues);

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const res = await apiFetch("/api/me/profile");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = (await res.json()) as UserProfile;
      setProfile(p);
      // Initialiser depuis DB seulement si pas de brouillon déjà restauré
      setValues((prev) => {
        const isEmpty =
          !prev.first_name && !prev.last_name && !prev.phone && !prev.email_signature;
        return isEmpty ? profileToForm(p) : prev;
      });
    } catch (e) {
      console.error("[ProfileTab] loadProfile error", e);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      setSubmitting(true);
      try {
        const res = await apiFetch("/api/me/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: values.first_name.trim() || null,
            last_name: values.last_name.trim() || null,
            avatar_url: values.avatar_url,
            phone: values.phone.trim() || null,
            timezone: values.timezone,
            email_signature: values.email_signature.trim() || null,
            preferences: {
              notifications_email: values.notifications_email,
              notifications_whatsapp: values.notifications_whatsapp,
              theme: values.theme,
              language: values.language,
            },
          }),
        });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string; details?: string[] };
          throw new Error(json.details?.join(", ") ?? json.error ?? `HTTP ${res.status}`);
        }
        const updated = (await res.json()) as UserProfile;
        setProfile(updated);
        setValues(profileToForm(updated));
        clearDraft();
        // V1.2.D-hotfix : propage avatar_url dans sidebar/chat sans relog
        refreshProfile().catch(() => {});
        toast.success("Profil mis à jour.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur lors de la sauvegarde";
        setSubmitError(msg);
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [values, clearDraft, refreshProfile]
  );

  if (!user) {
    return <SectionCard title="Mon profil" body="Non connecté." />;
  }

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Chargement du profil…</span>
      </div>
    );
  }

  const displayName = [values.first_name, values.last_name].filter(Boolean).join(" ") || null;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* En-tête identité */}
      <div className="card-sharp p-5 flex items-center gap-5">
        <UserAvatarV4
          email={user.email}
          name={displayName ?? undefined}
          avatarUrl={values.avatar_url}
          size={64}
        />
        <div>
          <h2 className="text-base font-bold text-text-primary font-headline">
            {displayName ?? user.email}
          </h2>
          <p className="text-sm text-text-muted">{user.email}</p>
          <p className="text-[11px] text-text-muted mt-1">
            <span className="font-mono">{user.tenant_slug}</span>
            <span className="mx-1.5">·</span>
            {user.role}
            {user.is_superadmin && (
              <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-amber-300/40 bg-amber-300/10 text-amber-300">
                superadmin
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Brouillon restauré */}
      {hasDraft && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-300/5 border border-amber-300/20 text-[11px] text-amber-300">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>Brouillon récupéré — modifications non sauvegardées restaurées.</span>
          <button
            type="button"
            onClick={() => {
              if (profile) setValues(profileToForm(profile));
              clearDraft();
            }}
            className="ml-auto underline underline-offset-2 hover:text-amber-200"
          >
            Ignorer
          </button>
        </div>
      )}

      {/* Avatar */}
      <div className="card-sharp p-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Photo de profil
        </h3>
        <CloudinaryUpload
          value={values.avatar_url}
          onChange={(url) => setValues({ ...values, avatar_url: url })}
          kind="avatar"
          placeholder="Photo de profil"
        />
      </div>

      {/* Identité */}
      <div className="card-sharp p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Identité
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">Prénom</label>
            <input
              type="text"
              value={values.first_name}
              onChange={(e) => setValues({ ...values, first_name: e.target.value })}
              placeholder="Prénom"
              maxLength={100}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Nom</label>
            <input
              type="text"
              value={values.last_name}
              onChange={(e) => setValues({ ...values, last_name: e.target.value })}
              placeholder="Nom de famille"
              maxLength={100}
              className={inputClass}
            />
          </div>
        </div>
        {/* Email lecture seule */}
        <div>
          <label className="block text-xs text-text-muted mb-1">
            Email
            <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-border-subtle bg-surface-3 text-text-muted">
              lecture seule
            </span>
          </label>
          <input
            type="email"
            value={user.email}
            readOnly
            className={cn(inputClass, "cursor-not-allowed opacity-60")}
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Téléphone</label>
          <input
            type="tel"
            value={values.phone}
            onChange={(e) => setValues({ ...values, phone: e.target.value })}
            placeholder="+33 6 00 00 00 00"
            maxLength={30}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Fuseau horaire</label>
          <select
            value={values.timezone}
            onChange={(e) => setValues({ ...values, timezone: e.target.value })}
            className={selectClass}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Signature email */}
      <div className="card-sharp p-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Signature email
        </h3>
        <textarea
          value={values.email_signature}
          onChange={(e) => setValues({ ...values, email_signature: e.target.value })}
          rows={4}
          maxLength={2000}
          placeholder={"Cordialement,\nPrénom Nom\nPoste — Société\n+33 6 …"}
          className={cn(inputClass, "resize-none font-mono")}
        />
        <p className="text-[11px] text-text-muted text-right">
          {values.email_signature.length}/2000
        </p>
      </div>

      {/* Préférences */}
      <div className="card-sharp p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Préférences
        </h3>
        <div className="space-y-3">
          <ToggleField
            label="Notifications par email"
            checked={values.notifications_email}
            onChange={(v) => setValues({ ...values, notifications_email: v })}
          />
          <ToggleField
            label="Notifications WhatsApp"
            checked={values.notifications_whatsapp}
            onChange={(v) => setValues({ ...values, notifications_whatsapp: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs text-text-muted mb-1">Thème</label>
            <select
              value={values.theme}
              onChange={(e) => setValues({ ...values, theme: e.target.value as "light" | "dark" | "auto" })}
              className={selectClass}
            >
              <option value="auto">Automatique (système)</option>
              <option value="dark">Sombre</option>
              <option value="light">Clair</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Langue</label>
            <select
              value={values.language}
              onChange={(e) => setValues({ ...values, language: e.target.value as "fr" | "en" })}
              className={selectClass}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      {/* Erreur submit */}
      {submitError && (
        <p className="text-xs text-red-400 px-1">{submitError}</p>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <span className="text-[11px] text-text-muted">
          {profile?.last_login_at
            ? `Dernière connexion : ${new Date(profile.last_login_at).toLocaleString("fr-FR")}`
            : null}
        </span>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary text-black text-xs font-bold uppercase tracking-widest hover:bg-accent-primary/90 transition-all disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Enregistrer
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// CompanyTab — V1.1.I-A : form fonctionnel Société + Branding
// Source de vérité : core.tenant_branding (UPSERT via PATCH /api/admin/tenants/[slug])
// ---------------------------------------------------------------------------

type BrandingValues = {
  legal_name: string; legal_form: string; siret: string; ape_code: string;
  tva_intra: string; capital_social: string; rcs_city: string;
  address_line1: string; address_line2: string; postal_code: string;
  city: string; country: string; phone: string; email: string; website: string;
  bank_name: string; iban: string; bic: string;
  logo_url: string; logo_small_url: string;
  primary_color: string; secondary_color: string; accent_color: string;
  footer_html: string; cgv_text: string;
  default_tva_rate: string; payment_terms_days: string; late_fees_rate: string;
  quote_prefix: string; invoice_prefix: string;
};

const EMPTY_BRANDING: BrandingValues = {
  legal_name: "", legal_form: "", siret: "", ape_code: "", tva_intra: "",
  capital_social: "", rcs_city: "",
  address_line1: "", address_line2: "", postal_code: "", city: "",
  country: "FR", phone: "", email: "", website: "",
  bank_name: "", iban: "", bic: "",
  logo_url: "", logo_small_url: "",
  primary_color: "#0EA5E9", secondary_color: "#6366F1", accent_color: "#F59E0B",
  footer_html: "", cgv_text: "",
  default_tva_rate: "20", payment_terms_days: "30", late_fees_rate: "10",
  quote_prefix: "D", invoice_prefix: "F",
};

function brandingFromApi(b: Record<string, unknown>): BrandingValues {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    legal_name: s(b.legal_name), legal_form: s(b.legal_form),
    siret: s(b.siret), ape_code: s(b.ape_code), tva_intra: s(b.tva_intra),
    capital_social: s(b.capital_social), rcs_city: s(b.rcs_city),
    address_line1: s(b.address_line1), address_line2: s(b.address_line2),
    postal_code: s(b.postal_code), city: s(b.city),
    country: s(b.country) || "FR", phone: s(b.phone),
    email: s(b.email), website: s(b.website),
    bank_name: s(b.bank_name), iban: s(b.iban), bic: s(b.bic),
    logo_url: s(b.logo_url), logo_small_url: s(b.logo_small_url),
    primary_color: s(b.primary_color) || "#0EA5E9",
    secondary_color: s(b.secondary_color) || "#6366F1",
    accent_color: s(b.accent_color) || "#F59E0B",
    footer_html: s(b.footer_html), cgv_text: s(b.cgv_text),
    default_tva_rate: b.default_tva_rate != null ? s(b.default_tva_rate) : "20",
    payment_terms_days: b.payment_terms_days != null ? s(b.payment_terms_days) : "30",
    late_fees_rate: b.late_fees_rate != null ? s(b.late_fees_rate) : "10",
    quote_prefix: s(b.quote_prefix) || "D",
    invoice_prefix: s(b.invoice_prefix) || "F",
  };
}

function BrandingCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-sharp p-6">
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">{title}</h3>
      {children}
    </div>
  );
}

function CompanyTab() {
  const { data: features } = useCockpitFeatures();
  const [values, setValues] = useState<BrandingValues>(EMPTY_BRANDING);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [saving, setSaving] = useState(false);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);

  const { hasDraft, clearDraft } = useFormDraft("draft:settings-tenant-branding", values, setValues);

  useEffect(() => {
    if (!features?.tenant) return;
    setTenantSlug(features.tenant);
    setLoadState((prev) => (prev === "idle" ? "loading" : prev));
  }, [features?.tenant]);

  const loadFromServer = useCallback(async (slug: string) => {
    setLoadState("loading");
    try {
      const res = await apiFetch(`/api/admin/tenants/${encodeURIComponent(slug)}`);
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { tenant?: { branding?: Record<string, unknown> } };
      if (data.tenant?.branding) setValues(brandingFromApi(data.tenant.branding));
      setLoadState("loaded");
    } catch (e) {
      console.error("[CompanyTab] load error", e);
      setLoadState("error");
      toast.error("Impossible de charger les données société");
    }
  }, []);

  useEffect(() => {
    if (loadState !== "loading" || !tenantSlug) return;
    if (hasDraft) { setLoadState("loaded"); return; }
    void loadFromServer(tenantSlug);
  }, [loadState, tenantSlug, hasDraft, loadFromServer]);

  const set = useCallback((key: keyof BrandingValues, val: string | null) => {
    setValues((prev) => ({ ...prev, [key]: val ?? "" }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantSlug) return;
    setSaving(true);
    try {
      const n = (v: string) => v.trim() || null;
      const num = (v: string) => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };
      const branding = {
        legal_name: n(values.legal_name), legal_form: n(values.legal_form),
        siret: n(values.siret), ape_code: n(values.ape_code), tva_intra: n(values.tva_intra),
        capital_social: n(values.capital_social), rcs_city: n(values.rcs_city),
        address_line1: n(values.address_line1), address_line2: n(values.address_line2),
        postal_code: n(values.postal_code), city: n(values.city), country: n(values.country),
        phone: n(values.phone), email: n(values.email), website: n(values.website),
        bank_name: n(values.bank_name), iban: n(values.iban), bic: n(values.bic),
        logo_url: n(values.logo_url), logo_small_url: n(values.logo_small_url),
        primary_color: n(values.primary_color), secondary_color: n(values.secondary_color),
        accent_color: n(values.accent_color),
        footer_html: n(values.footer_html), cgv_text: n(values.cgv_text),
        default_tva_rate: num(values.default_tva_rate),
        payment_terms_days: num(values.payment_terms_days),
        late_fees_rate: num(values.late_fees_rate),
        quote_prefix: n(values.quote_prefix), invoice_prefix: n(values.invoice_prefix),
      };
      const res = await apiFetch(`/api/admin/tenants/${encodeURIComponent(tenantSlug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branding }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      clearDraft();
      toast.success("Société & Branding sauvegardés");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  if (!features?.isSuperadmin) {
    return (
      <div className="card-sharp p-6">
        <p className="text-sm text-text-muted">La configuration société est réservée aux administrateurs.</p>
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <div className="flex items-center gap-3 p-8 text-text-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Chargement des données société…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
            Société &amp; Branding
          </h2>
          {tenantSlug && (
            <p className="text-xs text-text-muted mt-0.5 font-mono">{tenantSlug}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasDraft && (
            <span className="text-[10px] text-amber-300 font-mono uppercase tracking-wider px-1.5 py-0.5 border border-amber-300/30 bg-amber-300/5">
              brouillon
            </span>
          )}
          <button
            type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-accent-primary text-white hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Enregistrer
          </button>
        </div>
      </div>

      {/* Carte 1 — Identité légale */}
      <BrandingCard title="Identité légale">
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="Raison sociale">
            <input type="text" value={values.legal_name} onChange={(e) => set("legal_name", e.target.value)} placeholder="MyBotIA SAS" className={inputClass} />
          </FormField>
          <FormField label="Forme juridique">
            <input type="text" value={values.legal_form} onChange={(e) => set("legal_form", e.target.value)} placeholder="SAS, SARL, EURL…" className={inputClass} />
          </FormField>
          <FormField label="SIRET">
            <input type="text" value={values.siret} onChange={(e) => set("siret", e.target.value)} placeholder="123 456 789 00012" className={inputClass} />
          </FormField>
          <FormField label="Code APE / NAF">
            <input type="text" value={values.ape_code} onChange={(e) => set("ape_code", e.target.value)} placeholder="6201Z" className={inputClass} />
          </FormField>
          <FormField label="N° TVA intracommunautaire">
            <input type="text" value={values.tva_intra} onChange={(e) => set("tva_intra", e.target.value)} placeholder="FR12 123456789" className={inputClass} />
          </FormField>
          <FormField label="Capital social">
            <input type="text" value={values.capital_social} onChange={(e) => set("capital_social", e.target.value)} placeholder="10 000 €" className={inputClass} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Ville d'immatriculation (RCS)">
              <input type="text" value={values.rcs_city} onChange={(e) => set("rcs_city", e.target.value)} placeholder="Paris" className={inputClass} />
            </FormField>
          </div>
        </div>
      </BrandingCard>

      {/* Carte 2 — Coordonnées */}
      <BrandingCard title="Coordonnées">
        <div className="grid grid-cols-2 gap-x-4">
          <div className="col-span-2">
            <FormField label="Adresse ligne 1">
              <input type="text" value={values.address_line1} onChange={(e) => set("address_line1", e.target.value)} placeholder="123 rue de la Paix" className={inputClass} />
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Adresse ligne 2">
              <input type="text" value={values.address_line2} onChange={(e) => set("address_line2", e.target.value)} placeholder="Bâtiment A, Étage 3" className={inputClass} />
            </FormField>
          </div>
          <FormField label="Code postal">
            <input type="text" value={values.postal_code} onChange={(e) => set("postal_code", e.target.value)} placeholder="75001" className={inputClass} />
          </FormField>
          <FormField label="Ville">
            <input type="text" value={values.city} onChange={(e) => set("city", e.target.value)} placeholder="Paris" className={inputClass} />
          </FormField>
          <FormField label="Pays">
            <input type="text" value={values.country} onChange={(e) => set("country", e.target.value)} placeholder="FR" className={inputClass} />
          </FormField>
          <FormField label="Téléphone">
            <input type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+33 1 23 45 67 89" className={inputClass} />
          </FormField>
          <FormField label="Email société">
            <input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@monentreprise.fr" className={inputClass} />
          </FormField>
          <FormField label="Site web">
            <input type="url" value={values.website} onChange={(e) => set("website", e.target.value)} placeholder="https://monentreprise.fr" className={inputClass} />
          </FormField>
        </div>
      </BrandingCard>

      {/* Carte 3 — Bancaire */}
      <BrandingCard title="Coordonnées bancaires">
        <div className="grid grid-cols-2 gap-x-4">
          <div className="col-span-2">
            <FormField label="Banque">
              <input type="text" value={values.bank_name} onChange={(e) => set("bank_name", e.target.value)} placeholder="Crédit Agricole" className={inputClass} />
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="IBAN">
              <input type="text" value={values.iban} onChange={(e) => set("iban", e.target.value)} placeholder="FR76 1234 5678 9012 3456 7890 123" className={`${inputClass} font-mono`} />
            </FormField>
          </div>
          <FormField label="BIC / SWIFT">
            <input type="text" value={values.bic} onChange={(e) => set("bic", e.target.value)} placeholder="AGRIFRPPXXX" className={`${inputClass} font-mono`} />
          </FormField>
        </div>
      </BrandingCard>

      {/* Carte 4 — Branding visuel */}
      <BrandingCard title="Branding visuel">
        <div className="space-y-4">
          <FormField label="Logo principal">
            <CloudinaryUpload value={values.logo_url || null} onChange={(url) => set("logo_url", url)} kind="logo" />
          </FormField>
          <FormField label="Logo réduit / favicon">
            <CloudinaryUpload value={values.logo_small_url || null} onChange={(url) => set("logo_small_url", url)} kind="logo_small" />
          </FormField>
          <div className="grid grid-cols-3 gap-x-4">
            <FormField label="Couleur primaire">
              <div className="flex items-center gap-2">
                <input type="color" value={values.primary_color || "#0EA5E9"} onChange={(e) => set("primary_color", e.target.value)}
                  className="w-10 h-9 cursor-pointer border border-border-subtle bg-surface-2 p-0.5" />
                <input type="text" value={values.primary_color} onChange={(e) => set("primary_color", e.target.value)}
                  placeholder="#0EA5E9" className={`${inputClass} font-mono`} />
              </div>
            </FormField>
            <FormField label="Couleur secondaire">
              <div className="flex items-center gap-2">
                <input type="color" value={values.secondary_color || "#6366F1"} onChange={(e) => set("secondary_color", e.target.value)}
                  className="w-10 h-9 cursor-pointer border border-border-subtle bg-surface-2 p-0.5" />
                <input type="text" value={values.secondary_color} onChange={(e) => set("secondary_color", e.target.value)}
                  placeholder="#6366F1" className={`${inputClass} font-mono`} />
              </div>
            </FormField>
            <FormField label="Couleur accent">
              <div className="flex items-center gap-2">
                <input type="color" value={values.accent_color || "#F59E0B"} onChange={(e) => set("accent_color", e.target.value)}
                  className="w-10 h-9 cursor-pointer border border-border-subtle bg-surface-2 p-0.5" />
                <input type="text" value={values.accent_color} onChange={(e) => set("accent_color", e.target.value)}
                  placeholder="#F59E0B" className={`${inputClass} font-mono`} />
              </div>
            </FormField>
          </div>
        </div>
      </BrandingCard>

      {/* Carte 5 — Documents / numérotation */}
      <BrandingCard title="Documents & numérotation">
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="TVA par défaut (%)">
            <input type="number" step="0.01" min="0" max="100" value={values.default_tva_rate}
              onChange={(e) => set("default_tva_rate", e.target.value)} placeholder="20" className={inputClass} />
          </FormField>
          <FormField label="Délai de paiement (jours)">
            <input type="number" step="1" min="0" value={values.payment_terms_days}
              onChange={(e) => set("payment_terms_days", e.target.value)} placeholder="30" className={inputClass} />
          </FormField>
          <FormField label="Pénalités de retard (% annuel)">
            <input type="number" step="0.01" min="0" value={values.late_fees_rate}
              onChange={(e) => set("late_fees_rate", e.target.value)} placeholder="10" className={inputClass} />
          </FormField>
          <div className="col-span-2 grid grid-cols-2 gap-x-4">
            <FormField label="Préfixe devis">
              <input type="text" value={values.quote_prefix} onChange={(e) => set("quote_prefix", e.target.value)}
                placeholder="D" className={`${inputClass} font-mono`} />
            </FormField>
            <FormField label="Préfixe facture">
              <input type="text" value={values.invoice_prefix} onChange={(e) => set("invoice_prefix", e.target.value)}
                placeholder="F" className={`${inputClass} font-mono`} />
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Pied de page PDF (HTML autorisé)">
              <textarea value={values.footer_html} onChange={(e) => set("footer_html", e.target.value)}
                rows={3} placeholder="<p>MyBotIA SAS — SIRET : … — TVA : …</p>"
                className={`${inputClass} resize-y`} />
            </FormField>
          </div>
          <div className="col-span-2">
            <FormField label="Conditions Générales de Vente (CGV)">
              <textarea value={values.cgv_text} onChange={(e) => set("cgv_text", e.target.value)}
                rows={5} placeholder="Article 1 — Objet…"
                className={`${inputClass} resize-y`} />
            </FormField>
          </div>
        </div>
      </BrandingCard>

      {/* Bouton bas */}
      <div className="flex items-center justify-between py-2">
        {hasDraft && (
          <button
            type="button"
            onClick={() => { clearDraft(); if (tenantSlug) void loadFromServer(tenantSlug); }}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Annuler le brouillon
          </button>
        )}
        <div className="ml-auto">
          <button
            type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-accent-primary text-white hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Enregistrer
          </button>
        </div>
      </div>
    </form>
  );
}

function DocumentsTab() {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Documents (PDF devis / factures)"
        body="Les paramètres documents (logo PDF, mentions, IBAN, TVA par défaut, conditions de paiement) seront éditables en V1.1. Source DB cible : JSONB sous core.tenant_settings.config.documents."
      />
      <PreparingCard
        title="Champs prévus V1.1"
        items={[
          "Logo PDF + footer textuel",
          "TVA par défaut, conditions de paiement",
          "Pénalités de retard, mentions légales",
          "IBAN / BIC / banque",
          "Préfixe devis / facture, prochaine numérotation",
          "Validité devis (jours)",
        ]}
      />
    </div>
  );
}

function AiTab() {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Identité & garde-fous IA"
        body="Le mode collaborateur IA (draft_only / supervised_write) et les garde-fous (envoi externe, écriture CRM, périmètre mémoire) seront pilotables ici en V1.2. Source : core.tenant_settings.config.ai."
      />
      <PreparingCard
        title="Champs prévus V1.2"
        items={[
          "Mode assistant : disabled / draft_only / supervised_write",
          "Écriture CRM autorisée (oui / non)",
          "Envoi externe autorisé (toujours non par défaut)",
          "Périmètre mémoire : tenant / client / affaire",
          "Ton par défaut, règles d'escalade, GO humain requis",
        ]}
      />
    </div>
  );
}

function IntegrationsTab() {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Intégrations"
        body="Les connecteurs (GitHub, Vercel, WhatsApp gateway, email transactionnel, stockage fichiers) seront listés et configurables ici en V1.3. État courant des intégrations consultable côté infra (Damien)."
      />
      <PreparingCard
        title="Connecteurs prévus V1.3"
        items={[
          "GitHub (déploiements + repo lié)",
          "Vercel (déploiements front)",
          "WhatsApp gateway (Baileys, mybotia-gateway)",
          "Email transactionnel (Migadu / msmtp)",
          "Stockage fichiers (FS local /var/lib/mybotia-app)",
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catalogue tab — V1.1.I-A services & produits CRUD
// ---------------------------------------------------------------------------

const TYPE_FILTER_OPTIONS: Array<{ value: "" | CatalogItemType; label: string }> = [
  { value: "", label: "Tous les types" },
  { value: "product", label: "Produit" },
  { value: "service", label: "Service" },
  { value: "subscription", label: "Abonnement" },
  { value: "token_package", label: "Package tokens" },
  { value: "setup", label: "Setup" },
  { value: "maintenance", label: "Maintenance" },
  { value: "custom", label: "Custom" },
];

const CURRENCY_OPTIONS = ["EUR", "USD"];

interface CatalogFormValues {
  type: CatalogItemType;
  sku: string;
  name: string;
  description: string;
  category: string;
  unit: CatalogItemUnit;
  priceHt: string;
  vatRate: string;
  currency: string;
  active: boolean;
  visibleInQuotes: boolean;
  visibleToAi: boolean;
  notes: string;
}

const DEFAULT_FORM: CatalogFormValues = {
  type: "service",
  sku: "",
  name: "",
  description: "",
  category: "",
  unit: "unit",
  priceHt: "",
  vatRate: "20",
  currency: "EUR",
  active: true,
  visibleInQuotes: true,
  visibleToAi: true,
  notes: "",
};

function CatalogueTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"" | CatalogItemType>("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<CatalogItem | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        user?.tenant_slug
          ? `/api/admin/catalog?tenant=${encodeURIComponent(user.tenant_slug)}`
          : "/api/admin/catalog",
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { items: CatalogItem[] };
      setItems(json.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur chargement catalogue");
    } finally {
      setLoading(false);
    }
  }, [user?.tenant_slug]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filtered = items.filter((it) => {
    if (filterType && it.type !== filterType) return false;
    if (filterActive === "active" && !it.active) return false;
    if (filterActive === "inactive" && it.active) return false;
    return true;
  });

  if (!user?.is_superadmin) {
    return (
      <SectionCard
        title="Catalogue (services & produits)"
        body="Accès réservé aux superadmins."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
          Catalogue (services & produits)
        </h2>
        <button
          onClick={() => setCreateOpen(true)}
          className={btnPrimary}
        >
          <Plus className="w-3.5 h-3.5" />
          Nouveau
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as "" | CatalogItemType)}
          className={cn(selectClass, "w-48")}
        >
          {TYPE_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as "all" | "active" | "inactive")}
          className={cn(selectClass, "w-36")}
        >
          <option value="all">Tous statuts</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
        </select>
        <span className="text-xs text-text-muted ml-auto">
          {filtered.length} élément{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-sharp p-8 text-center text-text-muted text-sm">
          Aucun élément dans le catalogue.
        </div>
      ) : (
        <div className="card-sharp overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Type</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Catégorie</th>
                <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Prix HT</th>
                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Unité</th>
                <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Actif</th>
                <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-border-subtle/40 hover:bg-surface-2/50 transition-colors">
                  <td className="px-4 py-3">
                    <TypeBadge type={item.type} />
                  </td>
                  <td className="px-4 py-3 text-text-muted font-mono text-xs">
                    {item.sku ?? <span className="italic">—</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary max-w-[200px] truncate">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">
                    {item.category ?? <span className="italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-text-primary tabular-nums">
                    {item.priceHt.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {item.currency}
                    <span className="text-text-muted text-xs ml-1">+{item.vatRate}%</span>
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">
                    {UNIT_LABEL[item.unit] ?? item.unit}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.active ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400 inline" />
                    ) : (
                      <span className="w-4 h-4 inline-block rounded-full bg-surface-3 border border-border-subtle" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditItem(item)}
                        className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteItem(item)}
                        className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
                        title="Désactiver"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal create */}
      <CatalogCreateModal
        open={createOpen}
        tenantSlug={user.tenant_slug}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => { setCreateOpen(false); loadItems(); }}
      />

      {/* Modal edit */}
      {editItem && (
        <CatalogEditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => { setEditItem(null); loadItems(); }}
        />
      )}

      {/* Modal delete */}
      {deleteItem && (
        <CatalogDeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => { setDeleteItem(null); loadItems(); }}
        />
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: CatalogItemType }) {
  const COLOR: Record<CatalogItemType, string> = {
    product: "bg-blue-400/10 text-blue-400 border-blue-400/20",
    service: "bg-accent-primary/10 text-accent-glow border-accent-primary/20",
    subscription: "bg-purple-400/10 text-purple-400 border-purple-400/20",
    token_package: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    setup: "bg-teal-400/10 text-teal-400 border-teal-400/20",
    maintenance: "bg-orange-400/10 text-orange-400 border-orange-400/20",
    custom: "bg-surface-3 text-text-muted border-border-subtle",
  };
  return (
    <span className={cn("px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border", COLOR[type])}>
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modal create
// ---------------------------------------------------------------------------

function CatalogCreateModal({
  open,
  tenantSlug,
  onClose,
  onSuccess,
}: {
  open: boolean;
  tenantSlug: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [values, setValues] = useState<CatalogFormValues>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { clearDraft } = useFormDraft("draft:catalog-create", values, setValues);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!values.name.trim()) { setError("Nom requis"); return; }
    if (!values.priceHt || isNaN(parseFloat(values.priceHt))) { setError("Prix HT requis et numérique"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          type: values.type,
          sku: values.sku.trim() || null,
          name: values.name.trim(),
          description: values.description.trim() || null,
          category: values.category.trim() || null,
          unit: values.unit,
          priceHt: parseFloat(values.priceHt),
          vatRate: parseFloat(values.vatRate) || 20,
          currency: values.currency,
          active: values.active,
          visibleInQuotes: values.visibleInQuotes,
          visibleToAi: values.visibleToAi,
          notes: values.notes.trim() || null,
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      clearDraft();
      toast.success("Service créé");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <FormModal open={open} onClose={onClose} title="Nouveau service / produit">
      <form onSubmit={handleSubmit} className="space-y-0">
        <CatalogFormFields values={values} setValues={setValues} />
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        <div className="flex gap-3 mt-6 justify-end">
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button type="submit" disabled={submitting} className={btnPrimary}>
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Créer
          </button>
        </div>
      </form>
    </FormModal>
  );
}

// ---------------------------------------------------------------------------
// Modal edit
// ---------------------------------------------------------------------------

function CatalogEditModal({
  item,
  onClose,
  onSuccess,
}: {
  item: CatalogItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [values, setValues] = useState<CatalogFormValues>({
    type: item.type,
    sku: item.sku ?? "",
    name: item.name,
    description: item.description ?? "",
    category: item.category ?? "",
    unit: item.unit,
    priceHt: String(item.priceHt),
    vatRate: String(item.vatRate),
    currency: item.currency,
    active: item.active,
    visibleInQuotes: item.visibleInQuotes,
    visibleToAi: item.visibleToAi,
    notes: item.notes ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { clearDraft } = useFormDraft(`draft:catalog-edit-${item.id}`, values, setValues);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!values.name.trim()) { setError("Nom requis"); return; }
    if (!values.priceHt || isNaN(parseFloat(values.priceHt))) { setError("Prix HT requis et numérique"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/catalog/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: values.type,
          sku: values.sku.trim() || null,
          name: values.name.trim(),
          description: values.description.trim() || null,
          category: values.category.trim() || null,
          unit: values.unit,
          priceHt: parseFloat(values.priceHt),
          vatRate: parseFloat(values.vatRate) || 20,
          currency: values.currency,
          active: values.active,
          visibleInQuotes: values.visibleInQuotes,
          visibleToAi: values.visibleToAi,
          notes: values.notes.trim() || null,
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      clearDraft();
      toast.success("Service mis à jour");
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal open onClose={onClose} title={`Modifier — ${item.name}`}>
      <form onSubmit={handleSubmit} className="space-y-0">
        <CatalogFormFields values={values} setValues={setValues} />
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        <div className="flex gap-3 mt-6 justify-end">
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button type="submit" disabled={submitting} className={btnPrimary}>
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Enregistrer
          </button>
        </div>
      </form>
    </FormModal>
  );
}

// ---------------------------------------------------------------------------
// Modal delete
// ---------------------------------------------------------------------------

function CatalogDeleteModal({
  item,
  onClose,
  onSuccess,
}: {
  item: CatalogItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/catalog/${item.id}`, { method: "DELETE" });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      toast.success(`"${item.name}" désactivé`);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur suppression");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal open onClose={onClose} title="Désactiver ce service ?">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          Le service <span className="font-bold text-text-primary">{item.name}</span> sera désactivé
          (soft delete). Il restera dans les devis déjà émis mais ne sera plus proposable dans de
          nouveaux devis.
        </p>
        <p className="text-xs text-text-muted">
          Il sera toujours visible dans le catalogue avec le filtre &ldquo;Inactifs&rdquo;.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button
            onClick={handleDelete}
            disabled={submitting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-500/80 text-white text-xs font-bold uppercase tracking-widest hover:bg-red-500 transition-all disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Désactiver
          </button>
        </div>
      </div>
    </FormModal>
  );
}

// ---------------------------------------------------------------------------
// Formulaire commun create/edit
// ---------------------------------------------------------------------------

function CatalogFormFields({
  values,
  setValues,
}: {
  values: CatalogFormValues;
  setValues: (v: CatalogFormValues) => void;
}) {
  function set<K extends keyof CatalogFormValues>(k: K, v: CatalogFormValues[K]) {
    setValues({ ...values, [k]: v });
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Type *">
          <select
            value={values.type}
            onChange={(e) => set("type", e.target.value as CatalogItemType)}
            className={selectClass}
            required
          >
            {CATALOG_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Unité *">
          <select
            value={values.unit}
            onChange={(e) => set("unit", e.target.value as CatalogItemUnit)}
            className={selectClass}
            required
          >
            {CATALOG_ITEM_UNITS.map((u) => (
              <option key={u} value={u}>{UNIT_LABEL[u]}</option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Nom *">
        <input
          type="text"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Ex : Maintenance mensuelle site"
          className={inputClass}
          required
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="SKU">
          <input
            type="text"
            value={values.sku}
            onChange={(e) => set("sku", e.target.value)}
            placeholder="Ex : SVC-MAINT-01"
            className={inputClass}
          />
        </FormField>
        <FormField label="Catégorie">
          <input
            type="text"
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
            placeholder="Ex : Maintenance"
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Prix HT *">
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.priceHt}
            onChange={(e) => set("priceHt", e.target.value)}
            placeholder="0.00"
            className={inputClass}
            required
          />
        </FormField>
        <FormField label="TVA %">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={values.vatRate}
            onChange={(e) => set("vatRate", e.target.value)}
            placeholder="20"
            className={inputClass}
          />
        </FormField>
        <FormField label="Devise">
          <select
            value={values.currency}
            onChange={(e) => set("currency", e.target.value)}
            className={selectClass}
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Description">
        <textarea
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          placeholder="Description courte du service…"
          className={cn(inputClass, "resize-none")}
        />
      </FormField>

      {/* Toggles */}
      <div className="flex flex-wrap gap-6 py-2">
        <ToggleField
          label="Actif"
          checked={values.active}
          onChange={(v) => set("active", v)}
        />
        <ToggleField
          label="Visible devis"
          checked={values.visibleInQuotes}
          onChange={(v) => set("visibleInQuotes", v)}
        />
        <ToggleField
          label="Visible IA"
          checked={values.visibleToAi}
          onChange={(v) => set("visibleToAi", v)}
        />
      </div>

      <FormField label="Notes internes">
        <textarea
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          placeholder="Notes…"
          className={cn(inputClass, "resize-none")}
        />
      </FormField>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors border",
          checked
            ? "bg-accent-primary border-accent-primary"
            : "bg-surface-3 border-border-subtle"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
      <span className="text-xs text-text-muted">{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Helpers UI
// ---------------------------------------------------------------------------

function SectionCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card-sharp p-6">
      <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline mb-2">
        {title}
      </h2>
      <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
    </div>
  );
}

function PreparingCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card-sharp p-6 border-l-2 border-amber-300/40">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
          {title}
        </h3>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it} className="text-sm text-text-secondary flex items-start gap-2">
            <span className="text-text-muted mt-1">·</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V1.2.E.1 — Administration (super-admin) : regroupe les 5 consoles admin
// précédemment dans BOTTOM_ADMIN_ITEMS de la sidebar. Liens vers /admin/*
// pour préserver les routes existantes et les bookmarks.
// ---------------------------------------------------------------------------

const ADMIN_CARDS: Array<{
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}> = [
  { label: "Modules", href: "/admin/modules", icon: Layers, desc: "Activer / désactiver les features par tenant" },
  { label: "Tenants", href: "/admin/tenants", icon: Shield, desc: "Configuration des tenants, branding, scopes" },
  { label: "Billing IA", href: "/admin/billing", icon: Wallet, desc: "Politiques tarifaires, markup, offres" },
  { label: "Usage tokens", href: "/admin/usage/tokens", icon: Coins, desc: "Consommation tokens par agent / tenant" },
  { label: "Protocoles WhatsApp", href: "/admin/whatsapp-protocols", icon: MessageSquare, desc: "Skip-list JIDs, fast-paths, A3 routing" },
];

function AdministrationTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Consoles d&apos;administration de la plateforme. Réservé aux super-admins.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {ADMIN_CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-lg border border-border bg-surface-2 hover:bg-surface-3 hover:border-accent-primary/40 p-4 transition-colors"
            >
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-accent-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-medium text-sm text-text-primary">{c.label}</div>
                  <div className="text-xs text-text-muted mt-0.5 leading-relaxed">
                    {c.desc}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V1.2.E.1 — Vault (owner gilleskorzec@gmail.com) : pointe vers /admin/vault
// (page dédiée avec PIN 6 chiffres + cookie session 10 min).
// ---------------------------------------------------------------------------

function VaultTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Coffre-fort des secrets infrastructure. Lecture seule, déverrouillage par PIN.
      </p>
      <Link
        href="/admin/vault"
        className="block rounded-lg border border-border bg-surface-2 hover:bg-surface-3 hover:border-accent-primary/40 p-4 transition-colors"
      >
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-accent-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-sm text-text-primary">Ouvrir le coffre</div>
            <div className="text-xs text-text-muted mt-0.5 leading-relaxed">
              PIN 6 chiffres requis. Session 10 min, auto-lock. Audit log dédié.
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
