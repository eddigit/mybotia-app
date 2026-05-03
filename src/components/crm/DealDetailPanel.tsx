"use client";

// Bloc 5E — Drawer détail projet/affaire enrichi.
// Au clic sur une carte Pipeline : ouvre le drawer, charge GET /api/projects/[id]
// pour obtenir description, devis liés, factures liées, et flag deleteAllowed.
// Modifications via PATCH (whitelist serveur étendue : description ajoutée).
// Suppression : bouton désactivé si serveur bloque (proposals/invoices/won).
//
// Règles :
//   - aucune sauvegarde silencieuse — clic explicite "Enregistrer"
//   - rollback UI en cas d'erreur API
//   - refetch parent (Pipeline) via onSaved

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  X,
  Loader2,
  Sparkles,
  ExternalLink,
  Save,
  AlertCircle,
  Archive,
  Trash2,
  ShieldAlert,
  FileText,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { Deal, DealStage } from "@/types";
import { STAGE_TO_OPP_STATUS } from "@/lib/mappers";

const STAGE_LABELS: Record<DealStage, string> = {
  discovery: "Découverte",
  proposal: "Proposition",
  negotiation: "Négociation",
  closing: "Closing",
  won: "Gagné",
  lost: "Perdu",
};

const ACTIVE_STAGES: DealStage[] = ["discovery", "proposal", "negotiation", "closing"];

interface ProjectDetail {
  description: string;
  proposals: Array<{ id: string; ref: string; total: number; status: string; date: number | string | null }>;
  invoices: Array<{ id: string; ref: string; total: number; status: string; paye: string; date: number | string | null }>;
  deleteAllowed: boolean;
  deleteBlockedReason: string | null;
  isTestProject: boolean;
}

export function DealDetailPanel({
  deal,
  onClose,
  onSaved,
}: {
  deal: Deal;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [stage, setStage] = useState<DealStage>(deal.stage);
  const [amount, setAmount] = useState<string>(String(deal.value || 0));
  const [percent, setPercent] = useState<string>(String(deal.probability || 0));
  const [title, setTitle] = useState<string>(deal.title || "");
  const [description, setDescription] = useState<string>("");
  const [initialDescription, setInitialDescription] = useState<string>("");

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState("");
  const refMatch = deal.title?.match(/^[A-Z0-9-]+/)?.[0] || deal.projectId || "PROJET";
  const expectedConfirm = `SUPPRIMER ${refMatch}`;

  // Charger détail projet (description + devis + factures + flag deleteAllowed)
  useEffect(() => {
    let cancelled = false;
    if (!deal.projectId) {
      setLoadingDetail(false);
      return;
    }
    const qs = buildTenantQs(deal.tenantSlug);
    setLoadingDetail(true);
    fetch(`/api/projects/${encodeURIComponent(deal.projectId)}${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        const d: ProjectDetail = {
          description: data.description || "",
          proposals: data.proposals || [],
          invoices: data.invoices || [],
          deleteAllowed: !!data.deleteAllowed,
          deleteBlockedReason: data.deleteBlockedReason || null,
          isTestProject: !!data.isTestProject,
        };
        setDetail(d);
        setDescription(d.description);
        setInitialDescription(d.description);
      })
      .catch(() => {
        if (!cancelled) {
          setDetail({
            description: "",
            proposals: [],
            invoices: [],
            deleteAllowed: false,
            deleteBlockedReason: "Détail projet indisponible — actions sensibles bloquées par sécurité.",
            isTestProject: false,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deal.projectId, deal.tenantSlug]);

  const dirty =
    stage !== deal.stage ||
    Number(amount) !== Number(deal.value) ||
    Number(percent) !== Number(deal.probability) ||
    title.trim() !== deal.title.trim() ||
    description !== initialDescription;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, string | number> = {};
    if (stage !== deal.stage) payload.opp_status = STAGE_TO_OPP_STATUS[stage];
    const amountNum = Number(amount);
    if (!Number.isNaN(amountNum) && amountNum !== Number(deal.value)) payload.opp_amount = amountNum;
    const percentNum = Number(percent);
    if (
      !Number.isNaN(percentNum) &&
      percentNum >= 0 &&
      percentNum <= 100 &&
      percentNum !== Number(deal.probability)
    ) {
      payload.opp_percent = percentNum;
    }
    if (title.trim() && title.trim() !== deal.title.trim()) payload.title = title.trim();
    if (description !== initialDescription) payload.description = description;

    if (Object.keys(payload).length === 0) {
      setSaving(false);
      setError("Aucun changement à enregistrer.");
      return;
    }
    if (!deal.projectId) {
      setSaving(false);
      setError("Cette opportunité n'a pas d'identifiant projet — modification impossible.");
      return;
    }

    const qs = buildTenantQs(deal.tenantSlug);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(deal.projectId)}${qs}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStage(deal.stage);
        setAmount(String(deal.value || 0));
        setPercent(String(deal.probability || 0));
        setTitle(deal.title || "");
        setDescription(initialDescription);
        setError(data?.error || `Erreur ${res.status}`);
        return;
      }
      setSuccess("Modifications enregistrées.");
      setInitialDescription(description);
      if (onSaved) onSaved();
    } catch (e) {
      setStage(deal.stage);
      setAmount(String(deal.value || 0));
      setPercent(String(deal.probability || 0));
      setTitle(deal.title || "");
      setDescription(initialDescription);
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!deal.projectId) return;
    if (!confirm(`Archiver le projet "${deal.title}" ?\n\nLe projet sera marqué clôturé côté Dolibarr (status=2). Action réversible.`)) return;
    setArchiving(true);
    setError(null);
    setSuccess(null);
    try {
      const qs = buildTenantQs(deal.tenantSlug);
      const res = await fetch(`/api/projects/${encodeURIComponent(deal.projectId)}${qs}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "2" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `Erreur archivage (${res.status})`);
        return;
      }
      setSuccess("Projet archivé.");
      if (onSaved) onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    if (!deal.projectId) return;
    if (deleteTyped.trim() !== expectedConfirm) {
      setError(`Pour confirmer, tape exactement : ${expectedConfirm}`);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const qs = buildTenantQs(deal.tenantSlug);
      const res = await fetch(`/api/projects/${encodeURIComponent(deal.projectId)}${qs}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: deleteTyped }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 409 = garde-fous serveur ont bloqué
        const msg = data?.reason
          ? `Suppression refusée : ${data.reason}`
          : data?.error || `Erreur suppression (${res.status})`;
        setError(msg);
        return;
      }
      setSuccess("Projet supprimé.");
      if (onSaved) onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setDeleting(false);
    }
  }

  const deleteAllowed = !!detail?.deleteAllowed;
  const deleteReason = detail?.deleteBlockedReason || null;

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <aside className="fixed top-0 right-0 z-[81] w-full max-w-md h-full bg-surface-1 border-l border-border-default shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-border-subtle shrink-0">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
              Affaire / Projet
            </span>
            <h2 className="text-base font-bold text-text-primary truncate mt-0.5">{deal.title}</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              {deal.clientName}
              {deal.projectId && ` · projet #${deal.projectId}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 bg-surface-3 hover:bg-surface-2 text-text-muted hover:text-text-primary transition-all"
            title="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Liens rapides */}
          <div className="flex flex-wrap gap-2">
            {deal.clientId && (
              <Link
                href={`/crm/${encodeURIComponent(deal.clientId)}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-tight bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/30 text-accent-glow"
              >
                <ExternalLink className="w-3 h-3" />
                Voir fiche client
              </Link>
            )}
            <Link
              href={`/conversations?seedClient=${encodeURIComponent(deal.clientId)}&seedName=${encodeURIComponent(deal.clientName)}&seedAgent=lea`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-tight bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/30 text-accent-glow"
            >
              <Sparkles className="w-3 h-3" />
              Parler à Léa
            </Link>
          </div>

          {/* Étape */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-muted font-semibold block mb-1.5">
              Étape
            </label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as DealStage)}
              className="w-full bg-surface-2 border border-border-subtle text-sm text-text-primary px-3 py-2 focus:outline-none focus:border-accent-primary/40"
            >
              {ACTIVE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted font-semibold block mb-1.5">
                Montant (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-surface-2 border border-border-subtle text-sm text-text-primary px-3 py-2 focus:outline-none focus:border-accent-primary/40"
              />
              <p className="text-[10px] text-text-muted mt-1">Actuel : {formatCurrency(deal.value)}</p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-text-muted font-semibold block mb-1.5">
                Probabilité (%)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="w-full bg-surface-2 border border-border-subtle text-sm text-text-primary px-3 py-2 focus:outline-none focus:border-accent-primary/40"
              />
            </div>
          </div>

          {/* Titre */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-muted font-semibold block mb-1.5">
              Titre
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surface-2 border border-border-subtle text-sm text-text-primary px-3 py-2 focus:outline-none focus:border-accent-primary/40"
            />
          </div>

          {/* Description (Bloc 5E) */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-muted font-semibold block mb-1.5">
              Description / note
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={loadingDetail ? "Chargement…" : "Notes internes, contexte, prochaines étapes…"}
              disabled={loadingDetail}
              className="w-full bg-surface-2 border border-border-subtle text-sm text-text-primary px-3 py-2 focus:outline-none focus:border-accent-primary/40 resize-none disabled:opacity-60"
            />
          </div>

          {/* Documents liés (Bloc 5E — lecture seule) */}
          {detail && (detail.proposals.length > 0 || detail.invoices.length > 0) && (
            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                Documents liés
              </div>
              {detail.proposals.length > 0 && (
                <div className="space-y-1">
                  {detail.proposals.map((p) => (
                    <div
                      key={`prop-${p.id}`}
                      className="flex items-center justify-between gap-2 text-[11px] py-1.5 px-2 bg-surface-2/50 border border-border-subtle"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="w-3 h-3 text-text-muted shrink-0" />
                        <span className="font-mono text-text-primary truncate">{p.ref}</span>
                        <span className="text-text-muted">devis</span>
                      </div>
                      <span className="text-text-secondary font-semibold shrink-0">
                        {formatCurrency(p.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {detail.invoices.length > 0 && (
                <div className="space-y-1">
                  {detail.invoices.map((inv) => (
                    <div
                      key={`inv-${inv.id}`}
                      className="flex items-center justify-between gap-2 text-[11px] py-1.5 px-2 bg-surface-2/50 border border-border-subtle"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Receipt className="w-3 h-3 text-text-muted shrink-0" />
                        <span className="font-mono text-text-primary truncate">{inv.ref}</span>
                        <span
                          className={cn(
                            "uppercase",
                            inv.paye === "1" ? "text-emerald-300" : "text-text-muted"
                          )}
                        >
                          {inv.paye === "1" ? "payée" : "facture"}
                        </span>
                      </div>
                      <span className="text-text-secondary font-semibold shrink-0">
                        {formatCurrency(inv.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Métadonnées tenant */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border-subtle text-[10px]">
            <div>
              <span className="text-text-muted uppercase tracking-wider font-semibold block">Tenant</span>
              <span className="text-text-secondary font-mono">{deal.tenantSlug || "(absent)"}</span>
            </div>
            <div>
              <span className="text-text-muted uppercase tracking-wider font-semibold block">Référence</span>
              <span className="text-text-secondary font-mono">{refMatch}</span>
            </div>
            <div>
              <span className="text-text-muted uppercase tracking-wider font-semibold block">Project ID</span>
              <span className="text-text-secondary font-mono">{deal.projectId || "—"}</span>
            </div>
            <div>
              <span className="text-text-muted uppercase tracking-wider font-semibold block">Client</span>
              <span className="text-text-secondary font-mono">
                {deal.clientId || "(absent)"} · {deal.clientName || "(inconnu)"}
              </span>
            </div>
          </div>

          {(!deal.tenantSlug || !deal.clientId) && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {!deal.tenantSlug && "Tenant absent — actions désactivées. "}
                {!deal.clientId && "Client non rattaché — vérifier avant action sensible."}
              </span>
            </div>
          )}

          {/* Bandeau garde-fous suppression (5E) */}
          {detail && !deleteAllowed && deleteReason && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <span className="font-bold uppercase tracking-wider">Suppression interdite</span>
                {" — "}
                {deleteReason}
              </span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col gap-2 px-6 py-4 border-t border-border-subtle bg-surface-0/50 shrink-0">
          {error && (
            <div className="flex items-start gap-1.5 text-[11px] text-status-danger">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && <div className="text-[11px] text-emerald-300">{success}</div>}

          {showDeleteConfirm && (
            <div className="flex flex-col gap-2 p-2 border border-status-danger/30 bg-status-danger/5">
              <div className="flex items-start gap-1.5 text-[11px] text-status-danger">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Pour confirmer la suppression définitive, tape exactement :
                  <span className="font-mono font-bold ml-1">{expectedConfirm}</span>
                </span>
              </div>
              <input
                type="text"
                value={deleteTyped}
                onChange={(e) => setDeleteTyped(e.target.value)}
                placeholder={expectedConfirm}
                className="w-full bg-surface-2 border border-status-danger/30 text-sm text-text-primary px-3 py-1.5 font-mono focus:outline-none focus:border-status-danger/60"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteTyped("");
                    setError(null);
                  }}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight text-text-muted hover:text-text-primary"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || deleteTyped.trim() !== expectedConfirm}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight transition-all border",
                    deleteTyped.trim() === expectedConfirm && !deleting
                      ? "text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border-status-danger/30"
                      : "text-text-muted bg-surface-3/50 border-border-subtle cursor-not-allowed"
                  )}
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Confirmer suppression
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiving || saving || deleting || !deal.tenantSlug || !deal.projectId}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-tight border text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 border-amber-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Marquer le projet clôturé (status=2 Dolibarr). Réversible."
              >
                {archiving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
                Archiver
              </button>
              {/* Bloc 5E-SAFE : "Supprimer" complètement masqué sur projet non-test.
                  Doctrine post-incident LUCY-IGH : pour supprimer un projet réel,
                  il faut renommer son ref/title en TEST-* / TMP-* d'abord, ou
                  utiliser Archiver. */}
              {detail?.isTestProject && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setError(null);
                  }}
                  disabled={
                    archiving ||
                    saving ||
                    deleting ||
                    !deal.tenantSlug ||
                    !deal.projectId ||
                    showDeleteConfirm ||
                    loadingDetail ||
                    !deleteAllowed
                  }
                  title={
                    !deleteAllowed && deleteReason
                      ? deleteReason
                      : "Suppression définitive — confirmation forte requise."
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-tight border text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border-status-danger/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3 h-3" />
                  Supprimer…
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-[11px] font-bold uppercase tracking-tight text-text-muted hover:text-text-primary"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || saving || archiving || deleting}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold uppercase tracking-tight transition-all border",
                  dirty && !saving
                    ? "text-accent-glow bg-accent-primary/10 hover:bg-accent-primary/20 border-accent-primary/30"
                    : "text-text-muted bg-surface-3/50 border-border-subtle cursor-not-allowed"
                )}
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// Bloc 5G-bis : le serveur résout le tenant via hostname. Plus jamais de
// query côté client. La signature est conservée pour limiter les diffs.
function buildTenantQs(_tenantSlug?: string): string {
  return "";
}
