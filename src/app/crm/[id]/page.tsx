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
  Clock,
  MessageSquare,
  Calendar,
  Settings2,
  Truck,
  Sparkles,
  Download,
  Loader2,
  FilePlus,
  AlertCircle,
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
import { useClient } from "@/hooks/use-api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CreateProjectModal } from "@/components/shared/CreateProjectModal";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types";

const typeIcons: Record<string, typeof MessageSquare> = {
  message: MessageSquare,
  meeting: Calendar,
  system: Settings2,
};

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, loading, error, refetch } = useClient(id);
  const [showCreateProject, setShowCreateProject] = useState(false);

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
    docId: string | number
  ) {
    const key = docKey(modulepart, docId);
    setDoc(key, "generating");
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulepart, ref }),
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
          title="Generation du PDF cote Dolibarr..."
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
          title="Le PDF n'existe pas encore cote Dolibarr. Cliquer pour le generer."
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
                Projets ({projects.length})
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
            <p className="text-sm text-text-muted">Aucun projet</p>
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
                    <StatusBadge status={p.status} size="xs" />
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
                      <span className="text-xs font-bold text-text-primary">
                        {p.ref}
                      </span>
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
                      <span className="text-xs font-bold text-text-primary">
                        {inv.ref}
                      </span>
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

      {/* Activity timeline */}
      {activities.length > 0 && (
        <div className="card-sharp p-6">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="w-4 h-4 text-accent-glow" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
              Historique ({activities.length})
            </h2>
          </div>
          <div className="space-y-4">
            {activities.map((activity: Activity, i: number) => {
              const Icon = typeIcons[activity.type] || Settings2;
              return (
                <div
                  key={activity.id}
                  className={cn(
                    "relative pl-8 flex gap-3",
                    i < activities.length - 1 &&
                      "pb-4 border-l border-border-subtle ml-[7px]"
                  )}
                >
                  <div className="absolute left-0 top-0 w-4 h-4 rounded-full bg-surface-3 border border-border-default flex items-center justify-center">
                    <Icon className="w-2.5 h-2.5 text-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-text-primary">
                        {activity.title}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono shrink-0">
                        {new Date(activity.timestamp).toLocaleDateString(
                          "fr-FR",
                          { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
                        )}
                      </span>
                    </div>
                    {activity.description && (
                      <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                        {activity.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CreateProjectModal
        open={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onCreated={() => refetch()}
        defaultClientId={client.id}
        lockClient
      />
    </div>
  );
}
