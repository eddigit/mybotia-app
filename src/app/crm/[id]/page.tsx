"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  User,
  FileText,
  FolderOpen,
  FolderPlus,
  Truck,
  Sparkles,
  Download,
  Loader2,
  FilePlus,
  AlertCircle,
  Activity as ActivityIcon,
} from "lucide-react";

// FSM pour chaque devis/facture : suit le cycle download / generate.
// Aucune transition automatique entre "missing" et "generating" — la generation
// PDF doit etre declenchee explicitement par l'utilisateur (regle Bloc 3).
type DocState =
  | "idle"        // bouton "Telecharger" disponible (etat initial)
  | "downloading" // fetch /download en cours
  | "missing"     // download a renvoye 404/502 -> PDF inexistant cote Dolibarr
  | "generating"  // POST /generate en cours (declenche manuellement)
  | "ready"       // generate OK -> bouton "Telecharger" reaffiche
  | "error";      // erreur autre que "missing"

type ModulePart = "propale" | "facture";
import { useClient, useCockpitFeatures } from "@/hooks/use-api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CreateProjectModal } from "@/components/shared/CreateProjectModal";
import { EditClientModal } from "@/components/shared/EditClientModal";
import { EditProjectModal } from "@/components/shared/EditProjectModal";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types";

type AccountActivityRow = {
  id: string;
  title: string;
  description?: string;
  typeLabel: string;
  dateLabel: string;
  statusLabel: string;
  statusTone: "done" | "active" | "pending";
  elementLabel: string;
  href?: string;
};

function activityTypeLabel(type: Activity["type"]): string {
  if (type === "meeting") return "Réunion";
  if (type === "message") return "Message";
  if (type === "task") return "Tâche";
  if (type === "deal") return "Affaire";
  if (type === "alert") return "Alerte";
  if (type === "agent") return "Agent";
  return "Activité";
}

function activityElementLabel(type: Activity["type"]): string {
  if (type === "task") return "Tâche";
  if (type === "deal") return "Affaire";
  if (type === "meeting") return "Compte rendu";
  if (type === "message") return "Conversation";
  if (type === "alert") return "Compte";
  if (type === "agent") return "IA";
  return "Compte";
}

function activityStatus(activity: Activity): {
  label: string;
  tone: AccountActivityRow["statusTone"];
} {
  if (activity.type === "alert" || activity.priority === "high") {
    return { label: "À reprendre", tone: "pending" };
  }
  if (activity.type === "deal" || activity.type === "task") {
    return { label: "En cours", tone: "active" };
  }
  return { label: "Fait", tone: "done" };
}

function buildAccountActivityRows(activities: Activity[]): AccountActivityRow[] {
  return activities.map((activity) => {
    const status = activityStatus(activity);
    return {
      id: activity.id,
      title: activity.title,
      description: activity.description,
      typeLabel: activityTypeLabel(activity.type),
      dateLabel: new Date(activity.timestamp).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      statusLabel: status.label,
      statusTone: status.tone,
      elementLabel: activityElementLabel(activity.type),
      href: activity.actionUrl,
    };
  });
}

function AccountActivitiesTable({ rows }: { rows: AccountActivityRow[] }) {
  const statusClass: Record<AccountActivityRow["statusTone"], string> = {
    done: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    active: "bg-accent-primary/15 text-accent-glow border-accent-primary/30",
    pending: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  };

  if (rows.length === 0) {
    return (
      <div className="border border-border-subtle bg-surface-1/50 px-4 py-6 text-sm text-text-muted">
        Aucune activité enregistrée pour ce compte.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-border-subtle">
      <table className="min-w-[820px] w-full border-collapse text-sm">
        <thead className="bg-surface-2 text-text-muted">
          <tr className="text-[10px] font-bold uppercase tracking-widest">
            <th className="w-[34%] border-b border-r border-border-subtle px-3 py-2 text-left">
              Activité
            </th>
            <th className="w-[16%] border-b border-r border-border-subtle px-3 py-2 text-left">
              Type
            </th>
            <th className="w-[14%] border-b border-r border-border-subtle px-3 py-2 text-left">
              Date
            </th>
            <th className="w-[14%] border-b border-r border-border-subtle px-3 py-2 text-left">
              Statut
            </th>
            <th className="w-[22%] border-b border-border-subtle px-3 py-2 text-left">
              Élément lié
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="bg-surface-1/40 hover:bg-surface-2/70">
              <td className="border-r border-t border-border-subtle px-3 py-3 align-top">
                {row.href ? (
                  <Link
                    href={row.href}
                    className="font-bold text-text-primary hover:text-accent-glow transition-colors"
                  >
                    {row.title}
                  </Link>
                ) : (
                  <span className="font-bold text-text-primary">{row.title}</span>
                )}
                {row.description && (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">
                    {row.description}
                  </p>
                )}
              </td>
              <td className="border-r border-t border-border-subtle px-3 py-3 align-top text-text-secondary">
                {row.typeLabel}
              </td>
              <td className="border-r border-t border-border-subtle px-3 py-3 align-top font-mono text-xs text-text-muted">
                {row.dateLabel}
              </td>
              <td className="border-r border-t border-border-subtle px-3 py-3 align-top">
                <span
                  className={cn(
                    "inline-flex min-w-20 justify-center border px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
                    statusClass[row.statusTone],
                  )}
                >
                  {row.statusLabel}
                </span>
              </td>
              <td className="border-t border-border-subtle px-3 py-3 align-top">
                <span className="inline-flex bg-surface-3 px-2 py-1 text-xs font-semibold text-text-secondary">
                  {row.elementLabel}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, loading, error, refetch } = useClient(id);
  const { data: cockpitFeatures } = useCockpitFeatures();
  const isBusiness = cockpitFeatures?.crmProvider === "mybotia_business";
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deletingClient, setDeletingClient] = useState(false);

  // Etat PDF par document : key = `${modulepart}-${docId}`
  const [docStates, setDocStates] = useState<Record<string, DocState>>({});
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});

  function docKey(modulepart: ModulePart, docId: string | number): string {
    return `${modulepart}-${docId}`;
  }

  function setDoc(key: string, state: DocState, errMsg?: string) {
    setDocStates((s) => ({ ...s, [key]: state }));
    if (errMsg !== undefined) {
      setDocErrors((e) => ({ ...e, [key]: errMsg }));
    } else if (state !== "error") {
      setDocErrors((e) => {
        if (!(key in e)) return e;
        const copy = { ...e };
        delete copy[key];
        return copy;
      });
    }
  }

  async function handleDownloadPdf(
    modulepart: ModulePart,
    ref: string,
    docId: string | number
  ) {
    const key = docKey(modulepart, docId);
    setDoc(key, "downloading");
    try {
      const url = `/api/documents/download?modulepart=${encodeURIComponent(
        modulepart
      )}&ref=${encodeURIComponent(ref)}`;
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const a = document.createElement("a");
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = `${ref}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
        setDoc(key, "idle");
        return;
      }
      // 404 = Dolibarr OK mais content vide ; 502 = builddoc absent / Dolibarr KO
      // Les deux => PDF absent du point de vue utilisateur
      if (res.status === 404 || res.status === 502) {
        setDoc(key, "missing");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setDoc(
        key,
        "error",
        data?.error || `Erreur telechargement (${res.status})`
      );
    } catch (e) {
      setDoc(key, "error", (e as Error).message);
    }
  }

  async function handleGeneratePdf(
    modulepart: ModulePart,
    ref: string,
    docId: string | number,
    template?: string
  ) {
    const key = docKey(modulepart, docId);
    setDoc(key, "generating");
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modulepart,
          ref,
          ...(template ? { doctemplate: template } : {}),
        }),
      });
      if (res.ok) {
        setDoc(key, "ready");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setDoc(
        key,
        "error",
        data?.error || `Erreur generation (${res.status})`
      );
    } catch (e) {
      setDoc(key, "error", (e as Error).message);
    }
  }

  // Bouton dédié "Générer PDF Premium" — invoque template Dolibarr custom
  // mybotia_premium (créé en /opt/mybotia/dolibarr-custom/mybotia/mybotia/core/modules/propale/doc/).
  // À utiliser d'abord sur un devis brouillon ((PROV...)) pour ne pas écraser
  // un PDF officiel validé.
  function renderPremiumPdfButton(
    modulepart: ModulePart,
    ref: string,
    docId: string | number
  ) {
    const key = docKey(modulepart, docId);
    const state: DocState = docStates[key] || "idle";
    const isDraft = ref.startsWith("(PROV");

    const baseBtn =
      "inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight transition-all";

    if (state === "generating") {
      return null; // déjà signalé par le bouton standard
    }

    return (
      <button
        type="button"
        onClick={() => handleGeneratePdf(modulepart, ref, docId, "mybotia_premium")}
        className={`${baseBtn} text-accent-primary bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/30`}
        title={
          isDraft
            ? "Régénérer le PDF avec le template MyBotIA Premium (devis brouillon)."
            : "À utiliser d'abord sur un devis brouillon/test — écrasera le PDF officiel."
        }
      >
        <FilePlus className="w-3 h-3" />
        Premium
      </button>
    );
  }

  function handleTalkToLea() {
    if (!data?.client) return;
    const params = new URLSearchParams({
      seedClient: String(data.client.id),
      seedName: data.client.company || data.client.name || `Client #${data.client.id}`,
      seedAgent: "lea",
    });
    router.push(`/conversations?${params.toString()}`);
  }

  // Rendu du bouton PDF (etat-aware) pour une ligne devis/facture.
  // FSM stricte : aucun appel /generate sans clic explicite (regle Bloc 3).
  function renderPdfActions(
    modulepart: ModulePart,
    ref: string,
    docId: string | number
  ) {
    const key = docKey(modulepart, docId);
    const state: DocState = docStates[key] || "idle";
    const err = docErrors[key];

    const baseBtn =
      "inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight transition-all";

    if (state === "downloading") {
      return (
        <button
          disabled
          className={`${baseBtn} text-text-muted bg-surface-3/50 cursor-wait`}
          title="Telechargement..."
        >
          <Loader2 className="w-3 h-3 animate-spin" />
        </button>
      );
    }
    if (state === "generating") {
      return (
        <button
          disabled
          className={`${baseBtn} text-amber-300 bg-amber-400/10 border border-amber-400/30 cursor-wait`}
          title="Generation du PDF en cours..."
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          Generation...
        </button>
      );
    }
    if (state === "missing") {
      return (
        <button
          onClick={() => handleGeneratePdf(modulepart, ref, docId)}
          className={`${baseBtn} text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30`}
          title="Le PDF n'existe pas encore. Cliquer pour le generer."
        >
          <FilePlus className="w-3 h-3" />
          PDF absent — Generer
        </button>
      );
    }
    if (state === "error") {
      return (
        <button
          onClick={() => handleDownloadPdf(modulepart, ref, docId)}
          className={`${baseBtn} text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/30`}
          title={err || "Erreur lors du telechargement. Cliquer pour reessayer."}
        >
          <AlertCircle className="w-3 h-3" />
          Reessayer
        </button>
      );
    }
    // idle ou ready -> bouton Telecharger
    return (
      <button
        onClick={() => handleDownloadPdf(modulepart, ref, docId)}
        className={`${baseBtn} text-accent-glow hover:text-text-primary bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/20`}
        title={
          state === "ready"
            ? "PDF genere — cliquer pour telecharger"
            : "Telecharger le PDF"
        }
      >
        <Download className="w-3 h-3" />
        {state === "ready" ? "Telecharger" : "PDF"}
      </button>
    );
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted micro-label">Chargement du client...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <Link
          href="/crm"
          className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary text-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au CRM
        </Link>
        <div className="card-sharp p-8 text-center">
          <p className="text-text-muted">Client introuvable</p>
        </div>
      </div>
    );
  }

  const { client, contacts, activities, invoices, proposals, projects } = data;
  const accountActivityRows = buildAccountActivityRows(activities);

  return (
    <div className="p-8 space-y-6">
      {/* Back link */}
      <Link
        href="/crm"
        className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au CRM
      </Link>

      {/* Header */}
      <div className="card-sharp p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 bg-accent-primary/10 border border-accent-primary/15">
              <Building2 className="w-7 h-7 text-accent-glow" />
            </div>
            <div>
              <h1 className="text-xl font-headline font-extrabold text-text-primary">
                {client.company}
              </h1>
              {client.name !== client.company && (
                <p className="text-sm text-text-secondary mt-0.5">
                  {client.name}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <StatusBadge status={client.status} size="sm" dot />
                {client.isSupplier && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-tight text-amber-400 bg-amber-400/10 px-1.5 py-0.5">
                    <Truck className="w-3 h-3" />
                    Fournisseur
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex flex-wrap items-center gap-2 max-w-[280px] justify-end">
              {client.tags?.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-surface-4 text-[10px] text-text-muted font-mono"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <button
              onClick={() => setShowEditClient(true)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-surface-2 hover:bg-surface-3 border border-border-subtle text-text-primary text-[11px] font-bold uppercase tracking-tight transition-all whitespace-nowrap"
              title="Modifier les informations du client"
            >
              Modifier
            </button>
            <button
              onClick={async () => {
                if (deletingClient) return;
                const projectsCount = projects.length;
                const cascadeWarn =
                  projectsCount > 0
                    ? `\n\nATTENTION : ce client a ${projectsCount} affaire(s) liée(s). La suppression supprimera AUSSI les affaires, leurs tâches, devis et factures (cascade). Cette action est irréversible.`
                    : "\n\nCette action est irréversible.";
                if (!confirm(`Supprimer définitivement "${client.company || client.name}" ?${cascadeWarn}`)) {
                  return;
                }
                setDeletingClient(true);
                try {
                  const res = await fetch(`/api/clients/${encodeURIComponent(client.id)}`, {
                    method: "DELETE",
                  });
                  if (!res.ok) {
                    const j = await res.json().catch(() => ({}));
                    alert(`Erreur suppression client : ${j?.error || res.status}`);
                    return;
                  }
                  router.push("/crm");
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Erreur réseau");
                } finally {
                  setDeletingClient(false);
                }
              }}
              disabled={deletingClient}
              className="inline-flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-400/40 text-red-300 hover:text-red-200 text-[11px] font-bold uppercase tracking-tight transition-all whitespace-nowrap disabled:opacity-50"
              title="Supprimer le client (cascade)"
            >
              {deletingClient ? "..." : "Supprimer"}
            </button>
            <button
              onClick={handleTalkToLea}
              className="inline-flex items-center gap-2 px-3 py-2 bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/30 text-accent-glow text-[11px] font-bold uppercase tracking-tight transition-all whitespace-nowrap"
              title="Ouvrir une conversation avec Léa contextualisée sur ce client"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Parler à Léa de ce client
            </button>
          </div>
        </div>

        {/* Contact info row */}
        <div className="flex flex-wrap gap-6 mt-5 pt-5 border-t border-border-subtle">
          {client.email && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Mail className="w-4 h-4 text-text-muted" />
              {client.email}
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Phone className="w-4 h-4 text-text-muted" />
              {client.phone}
            </div>
          )}
          {client.town && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <MapPin className="w-4 h-4 text-text-muted" />
              {client.town}
              {client.countryCode && ` (${client.countryCode})`}
            </div>
          )}
        </div>

        {/* Notes */}
        {(client.notePublic || client.notePrivate) && (
          <div className="mt-4 pt-4 border-t border-border-subtle space-y-2">
            {client.notePublic && (
              <p className="text-sm text-text-secondary leading-relaxed">
                {client.notePublic}
              </p>
            )}
            {client.notePrivate && (
              <p className="text-sm text-text-muted leading-relaxed italic">
                {client.notePrivate}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Grid: Contacts + Projects + Financials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contacts */}
        <div className="card-sharp p-6">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-4 h-4 text-accent-glow" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
              Contacts ({contacts.length})
            </h2>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-text-muted">Aucun contact</p>
          ) : (
            <div className="space-y-4">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-surface-1/50 border border-border-subtle"
                >
                  <p className="text-sm font-bold text-text-primary">
                    {c.name}
                  </p>
                  {c.role && (
                    <p className="text-[11px] text-accent-glow mt-0.5">
                      {c.role}
                    </p>
                  )}
                  {c.email && (
                    <p className="text-xs text-text-muted mt-1 flex items-center gap-1.5">
                      <Mail className="w-3 h-3" />
                      {c.email}
                    </p>
                  )}
                  {c.phone && (
                    <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                      <Phone className="w-3 h-3" />
                      {c.phone}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Projects */}
        <div className="card-sharp p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-accent-glow" />
              <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
                Affaires ({projects.length})
              </h2>
            </div>
            <button
              onClick={() => setShowCreateProject(true)}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-accent-glow hover:text-text-primary transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Nouveau
            </button>
          </div>
          {projects.length === 0 ? (
            <p className="text-sm text-text-muted">Aucune affaire</p>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="p-3 bg-surface-1/50 border border-border-subtle"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      {p.ref && (
                        <span className="text-[10px] font-mono text-text-muted">
                          {p.ref}
                        </span>
                      )}
                      <p className="text-sm font-bold text-text-primary">
                        {p.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={p.status} size="xs" />
                      <button
                        type="button"
                        onClick={() => setEditingProjectId(p.id)}
                        className="px-2 py-1 text-[10px] font-bold uppercase tracking-tight text-accent-glow hover:text-text-primary border border-border-subtle hover:border-accent-primary/40 transition-colors"
                        title="Modifier l'affaire"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            !confirm(
                              `Supprimer définitivement l'affaire "${p.name}" ?\n\nATTENTION : toutes les tâches liées à cette affaire seront aussi supprimées (cascade). Les devis et factures liés perdront leur référence affaire.\n\nCette action est irréversible.`,
                            )
                          )
                            return;
                          setDeletingProjectId(p.id);
                          try {
                            const res = await fetch(
                              `/api/projects/${encodeURIComponent(p.id)}`,
                              { method: "DELETE" },
                            );
                            if (!res.ok) {
                              const j = await res.json().catch(() => ({}));
                              alert(`Erreur suppression affaire : ${j?.error || res.status}`);
                              return;
                            }
                            refetch();
                          } finally {
                            setDeletingProjectId(null);
                          }
                        }}
                        disabled={deletingProjectId === p.id}
                        className="px-2 py-1 text-[10px] font-bold uppercase tracking-tight text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/60 transition-colors disabled:opacity-50"
                        title="Supprimer l'affaire"
                      >
                        {deletingProjectId === p.id ? "..." : "Suppr"}
                      </button>
                    </div>
                  </div>
                  {p.budget !== undefined && p.budget > 0 && (
                    <p className="text-lg font-headline font-extrabold text-accent-glow mt-2">
                      {formatCurrency(p.budget)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Financials: Invoices + Proposals */}
        <div className="card-sharp p-6">
          <div className="flex items-center gap-2 mb-5">
            <FileText className="w-4 h-4 text-accent-glow" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
              Documents
            </h2>
          </div>

          {/* Proposals */}
          {proposals.length > 0 && (
            <div className="mb-4">
              <h3 className="micro-label text-text-muted mb-2">
                Devis ({proposals.length})
              </h3>
              <div className="space-y-2">
                {proposals.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 p-2 bg-surface-1/50 border border-border-subtle"
                  >
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/documents/proposal/${p.id}`}
                        className="text-xs font-bold text-accent-glow hover:underline"
                      >
                        {p.ref}
                      </Link>
                      {p.date && (
                        <span className="text-[10px] text-text-muted ml-2">
                          {new Date(p.date).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-text-primary shrink-0">
                      {formatCurrency(p.total)}
                    </span>
                    {p.ref && renderPdfActions("propale", p.ref, p.id)}
                    {isBusiness ? (
                      <a
                        href={`/api/quotes/${encodeURIComponent(String(p.id))}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight bg-accent-primary/15 text-accent-glow hover:bg-accent-primary/30 border border-accent-primary/30 transition-all"
                        title="Télécharger le PDF Premium MyBotIA (rendu @react-pdf/renderer)"
                      >
                        <Sparkles className="w-3 h-3" />
                        Premium
                      </a>
                    ) : (
                      p.ref && renderPremiumPdfButton("propale", p.ref, p.id)
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoices */}
          {invoices.length > 0 && (
            <div>
              <h3 className="micro-label text-text-muted mb-2">
                Factures ({invoices.length})
              </h3>
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-2 p-2 bg-surface-1/50 border border-border-subtle"
                  >
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/documents/invoice/${inv.id}`}
                        className="text-xs font-bold text-accent-glow hover:underline"
                      >
                        {inv.ref}
                      </Link>
                      {inv.date && (
                        <span className="text-[10px] text-text-muted ml-2">
                          {new Date(inv.date).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={inv.status} size="xs" />
                      <span className="text-sm font-bold text-text-primary">
                        {formatCurrency(inv.total)}
                      </span>
                    </div>
                    {inv.ref && renderPdfActions("facture", inv.ref, inv.id)}
                    {isBusiness && (
                      <a
                        href={`/api/invoices/${encodeURIComponent(String(inv.id))}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight bg-accent-primary/15 text-accent-glow hover:bg-accent-primary/30 border border-accent-primary/30 transition-all"
                        title="Télécharger le PDF Premium MyBotIA (rendu @react-pdf/renderer)"
                      >
                        <Sparkles className="w-3 h-3" />
                        Premium
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {proposals.length === 0 && invoices.length === 0 && (
            <p className="text-sm text-text-muted">Aucun document</p>
          )}
        </div>
      </div>

      <div className="card-sharp p-6">
        <div className="flex flex-col gap-2 mb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <ActivityIcon className="w-4 h-4 text-accent-glow" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
              Activités du compte ({activities.length})
            </h2>
          </div>
          <p className="text-xs text-text-muted">
            Journal unique : tâches, projets, échanges et alertes du compte.
          </p>
        </div>
        <AccountActivitiesTable rows={accountActivityRows} />
      </div>

      <CreateProjectModal
        open={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onCreated={() => refetch()}
        defaultClientId={client.id}
        lockClient
      />

      <EditClientModal
        open={showEditClient}
        onClose={() => setShowEditClient(false)}
        onSaved={() => refetch()}
        client={client}
      />

      <EditProjectModal
        open={editingProjectId !== null}
        onClose={() => setEditingProjectId(null)}
        onSaved={() => refetch()}
        project={
          editingProjectId
            ? projects.find((p) => p.id === editingProjectId) ?? null
            : null
        }
      />
    </div>
  );
}
