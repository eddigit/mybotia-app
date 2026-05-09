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

import { useState } from "react";
import { User, Building2, FileText, Bot, Plug, Sparkles } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { useAuth } from "@/contexts/auth-context";
import { UserAvatarV4 } from "@/components/conversations/UserAvatarV4";
import { cn } from "@/lib/utils";

type TabKey = "profile" | "company" | "documents" | "ai" | "integrations";

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "profile", label: "Mon profil", icon: User },
  { key: "company", label: "Société", icon: Building2 },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "ai", label: "IA", icon: Bot },
  { key: "integrations", label: "Intégrations", icon: Plug },
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
