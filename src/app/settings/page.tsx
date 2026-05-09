"use client";

// Bloc Settings V1 — page /settings honnête.
// État : empty state structuré par onglet. Aucun input fonctionnel V1.
// Prochaines itérations :
//   V1.1 : profil user + société (UPDATE JSONB core.tenant_settings.config)
//   V1.2 : IA (assistant_mode, crm_write_enabled)
//   V1.3 : Intégrations (GitHub/Vercel/WhatsApp/Email) + upload avatar/logo
//
// Doctrine : feedback_jamais_de_mock — pas de champ pré-rempli avec une
// valeur fake. On affiche "Non configuré" honnêtement.

import { useState, useEffect, useCallback } from "react";
import { User, Building2, FileText, Bot, Plug, Package, Sparkles, Pencil, Trash2, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { useAuth } from "@/contexts/auth-context";
import { UserAvatarV4 } from "@/components/conversations/UserAvatarV4";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/Toast";
import { FormModal, FormField, inputClass, selectClass, btnPrimary, btnSecondary } from "@/components/shared/FormModal";
import { useFormDraft } from "@/hooks/use-form-draft";
import {
  CATALOG_ITEM_TYPES,
  CATALOG_ITEM_UNITS,
  TYPE_LABEL,
  UNIT_LABEL,
  type CatalogItem,
  type CatalogItemType,
  type CatalogItemUnit,
} from "@/lib/catalog-types";

type TabKey = "profile" | "company" | "documents" | "ai" | "integrations" | "catalogue";

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "profile", label: "Mon profil", icon: User },
  { key: "company", label: "Société", icon: Building2 },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "ai", label: "IA", icon: Bot },
  { key: "integrations", label: "Intégrations", icon: Plug },
  { key: "catalogue", label: "Catalogue", icon: Package },
];

export default function SettingsPage() {
  const { user } = useAuth();
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
          {TABS.map((t) => {
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
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs : empty state honnête. Affiche les données déjà disponibles côté JWT
// (read-only V1) et liste les champs qui arriveront en V1.1+.
// ---------------------------------------------------------------------------

function ProfileTab({
  user,
}: {
  user: ReturnType<typeof useAuth>["user"];
}) {
  if (!user) {
    return <SectionCard title="Mon profil" body="Non connecté." />;
  }
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || null;
  return (
    <div className="space-y-4">
      <div className="card-sharp p-6 flex items-center gap-5">
        <UserAvatarV4
          email={user.email}
          name={displayName ?? undefined}
          size={64}
        />
        <div>
          <h2 className="text-lg font-bold text-text-primary font-headline">
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

      <FieldList
        title="Données actuelles"
        fields={[
          { label: "Email", value: user.email, source: "JWT" },
          { label: "Prénom", value: user.first_name, source: "JWT" },
          { label: "Nom", value: user.last_name, source: "JWT" },
          { label: "Rôle tenant", value: user.role, source: "JWT" },
        ]}
      />

      <PreparingCard
        title="À configurer en V1.1"
        items={[
          "Avatar personnalisé (initiales propres en attendant)",
          "Téléphone / fuseau horaire / locale",
          "Signature email",
          "Préférences notifications (email, WhatsApp)",
        ]}
      />
    </div>
  );
}

function CompanyTab() {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Société"
        body="Les coordonnées société (nom légal, logo, SIRET, TVA, adresse, IBAN) ne sont pas encore éditables ici. Côté serveur, le modèle existe (table core.tenant_branding + JSONB core.tenant_settings) — l'éditeur arrive en V1.1."
      />
      <PreparingCard
        title="Champs prévus V1.1"
        items={[
          "Nom légal / nom commercial",
          "Logo (URL HTTPS, upload V1.3)",
          "Adresse complète, téléphone, site",
          "SIRET, TVA intracommunautaire",
          "Devise par défaut, fuseau horaire",
        ]}
      />
    </div>
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

function FieldList({
  title,
  fields,
}: {
  title: string;
  fields: { label: string; value: string | null | undefined; source: string }[];
}) {
  return (
    <div className="card-sharp p-6">
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">
        {title}
      </h3>
      <dl className="space-y-2.5">
        {fields.map((f) => (
          <div key={f.label} className="flex items-baseline justify-between gap-4 text-sm">
            <dt className="text-text-muted shrink-0">{f.label}</dt>
            <dd className="font-medium text-text-primary text-right truncate">
              {f.value ? (
                <span>{f.value}</span>
              ) : (
                <span className="text-text-muted italic">non renseigné</span>
              )}
              <span className="ml-2 text-[10px] text-text-muted font-mono uppercase">
                {f.source}
              </span>
            </dd>
          </div>
        ))}
      </dl>
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
