"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  FileText, ArrowLeft, Download, FileOutput, Loader2,
  Receipt, FileCheck2, FileMinus,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { formatCurrency } from "@/lib/utils";
import type { CommercialDocumentDetails, CommercialDocumentType } from "@/lib/dolibarr";

const TYPE_META: Record<CommercialDocumentType, {
  label: string; icon: typeof Receipt; modulepart: string;
}> = {
  proposal: { label: "Devis", icon: FileCheck2, modulepart: "propale" },
  invoice: { label: "Facture", icon: Receipt, modulepart: "facture" },
  credit_note: { label: "Avoir", icon: FileMinus, modulepart: "facture" },
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-zinc-500/15 text-zinc-400" },
  validated: { label: "Validé", className: "bg-blue-500/15 text-blue-400" },
  signed: { label: "Signé", className: "bg-emerald-500/15 text-emerald-400" },
  refused: { label: "Refusé", className: "bg-red-500/15 text-red-400" },
  billed: { label: "Facturé", className: "bg-violet-500/15 text-violet-400" },
  unpaid: { label: "Impayée", className: "bg-amber-500/15 text-amber-400" },
  paid: { label: "Payée", className: "bg-emerald-500/15 text-emerald-400" },
  abandoned: { label: "Abandonnée", className: "bg-red-500/15 text-red-400" },
};

function fmtDate(d: number | string | null | undefined): string {
  if (!d) return "—";
  const ts = typeof d === "number" ? d * 1000 : Date.parse(String(d));
  if (Number.isNaN(ts)) return "—";
  return new Date(ts).toLocaleDateString("fr-FR");
}

function fmtMoney(s: string | null | undefined): string {
  if (!s) return "—";
  const n = parseFloat(s);
  if (Number.isNaN(n)) return "—";
  return formatCurrency(n);
}

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = use(params);
  const [data, setData] = useState<CommercialDocumentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);

  const docType = type as CommercialDocumentType;
  const meta = TYPE_META[docType];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/documents/${type}/${id}`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || `Erreur ${res.status}`);
          setData(null);
        } else {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur réseau");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [type, id]);

  async function handleDownload() {
    if (!data?.ref || !meta) return;
    setPdfBusy(true);
    try {
      const url = `/api/documents/download?modulepart=${encodeURIComponent(meta.modulepart)}&ref=${encodeURIComponent(data.ref)}`;
      window.open(url, "_blank");
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleGenerate() {
    if (!data?.ref || !meta) return;
    setPdfBusy(true);
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulepart: meta.modulepart, ref: data.ref }),
      });
      const json = await res.json();
      if (json.content) {
        const binary = atob(json.content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = json.filename || `${data.ref}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setPdfBusy(false);
    }
  }

  if (!meta) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-400">Type de document inconnu : {type}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-4">
        <Link href="/documents" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary">
          <ArrowLeft className="w-3 h-3" /> Retour aux documents
        </Link>
        <p className="text-sm text-red-400">{error || "Document introuvable"}</p>
      </div>
    );
  }

  const businessSt = STATUS_LABELS[data.statusBusiness] || { label: data.statusBusiness, className: "bg-zinc-500/15 text-zinc-400" };
  const paymentSt = data.statusPayment ? STATUS_LABELS[data.statusPayment] : null;
  const Icon = meta.icon;

  return (
    <div className="p-6 space-y-6">
      <Link href="/documents" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary">
        <ArrowLeft className="w-3 h-3" /> Retour aux documents
      </Link>

      <ModuleHeader
        icon={Icon}
        title={`${meta.label} — ${data.ref}`}
        subtitle={data.client ? `${data.client.name}${data.client.nameAlias ? ` (${data.client.nameAlias})` : ""}` : "Client inconnu"}
        actions={
          <>
            <button
              onClick={handleGenerate}
              disabled={pdfBusy}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20 transition-all disabled:opacity-50"
            >
              {pdfBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileOutput className="w-3 h-3" />}
              Générer PDF
            </button>
            {data.pdfAvailable && (
              <button
                onClick={handleDownload}
                disabled={pdfBusy}
                className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase bg-surface-3/50 text-text-muted hover:text-text-primary hover:bg-surface-3 transition-all"
              >
                <Download className="w-3 h-3" /> Télécharger
              </button>
            )}
          </>
        }
      />

      {/* Synthèse */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-sharp p-4">
          <div className="text-[10px] uppercase text-text-muted font-bold">Total HT</div>
          <div className="text-lg font-bold text-text-primary mt-1">{fmtMoney(data.totalHT)}</div>
        </div>
        <div className="card-sharp p-4">
          <div className="text-[10px] uppercase text-text-muted font-bold">TVA</div>
          <div className="text-lg font-bold text-text-primary mt-1">{fmtMoney(data.totalTVA)}</div>
        </div>
        <div className="card-sharp p-4">
          <div className="text-[10px] uppercase text-text-muted font-bold">Total TTC</div>
          <div className="text-lg font-bold text-accent-glow mt-1">{fmtMoney(data.totalTTC)}</div>
        </div>
        <div className="card-sharp p-4">
          <div className="text-[10px] uppercase text-text-muted font-bold">
            {data.documentType === "proposal" ? "Validité" : "Reste à payer"}
          </div>
          <div className="text-lg font-bold text-text-primary mt-1">
            {data.documentType === "proposal"
              ? fmtDate(data.dueDate)
              : data.remainToPay !== null ? formatCurrency(data.remainToPay) : "—"}
          </div>
        </div>
      </div>

      {/* Métadonnées */}
      <div className="card-sharp p-6">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary mb-4 font-headline">Informations</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div>
            <div className="text-text-muted">Date</div>
            <div className="text-text-primary font-medium mt-1">{fmtDate(data.date)}</div>
          </div>
          <div>
            <div className="text-text-muted">Échéance</div>
            <div className="text-text-primary font-medium mt-1">{fmtDate(data.dueDate)}</div>
          </div>
          <div>
            <div className="text-text-muted">Statut métier</div>
            <div className="mt-1">
              <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-sm ${businessSt.className}`}>{businessSt.label}</span>
            </div>
          </div>
          {paymentSt && (
            <div>
              <div className="text-text-muted">Statut paiement</div>
              <div className="mt-1">
                <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-sm ${paymentSt.className}`}>{paymentSt.label}</span>
              </div>
            </div>
          )}
          {data.invoiceType && (
            <div>
              <div className="text-text-muted">Type facture</div>
              <div className="text-text-primary font-medium mt-1">{data.invoiceType}</div>
            </div>
          )}
          {data.client && (
            <div>
              <div className="text-text-muted">Client</div>
              <Link href={`/crm/${data.client.id}`} className="text-accent-glow font-medium hover:underline mt-1 block">
                {data.client.name}
              </Link>
            </div>
          )}
          {data.project && (
            <div>
              <div className="text-text-muted">Projet</div>
              <div className="text-text-primary font-medium mt-1">{data.project.ref} — {data.project.title}</div>
            </div>
          )}
        </div>
      </div>

      {/* Lignes */}
      <div className="card-sharp p-6">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary mb-4 font-headline">
          Lignes ({data.lines.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border-subtle">
              <tr className="text-text-muted text-[10px] uppercase font-bold">
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-right px-3 py-2">Qté</th>
                <th className="text-right px-3 py-2">PU HT</th>
                <th className="text-right px-3 py-2">Remise</th>
                <th className="text-right px-3 py-2">TVA</th>
                <th className="text-right px-3 py-2">Total HT</th>
                <th className="text-right px-3 py-2">Total TTC</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((ln) => (
                <tr key={ln.id} className="border-b border-border-subtle/40 hover:bg-surface-3/20">
                  <td className="px-3 py-3 text-text-primary max-w-md">
                    <div className="font-medium">{ln.productLabel || "—"}</div>
                    <div className="text-text-muted text-[11px] mt-0.5 line-clamp-3">{ln.description}</div>
                  </td>
                  <td className="text-right px-3 py-3 text-text-secondary font-mono">{ln.qty || "—"}</td>
                  <td className="text-right px-3 py-3 text-text-secondary font-mono">{fmtMoney(ln.unitPriceHT)}</td>
                  <td className="text-right px-3 py-3 text-text-muted font-mono">{ln.discountPercent && parseFloat(ln.discountPercent) > 0 ? `${ln.discountPercent}%` : "—"}</td>
                  <td className="text-right px-3 py-3 text-text-muted font-mono">{ln.tvaTx ? `${parseFloat(ln.tvaTx)}%` : "—"}</td>
                  <td className="text-right px-3 py-3 text-text-primary font-mono font-bold">{fmtMoney(ln.totalHT)}</td>
                  <td className="text-right px-3 py-3 text-text-primary font-mono font-bold">{fmtMoney(ln.totalTTC)}</td>
                </tr>
              ))}
              {data.lines.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-text-muted">Aucune ligne</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TVA détaillée */}
      {data.tvaDetail.length > 0 && (
        <div className="card-sharp p-6">
          <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary mb-4 font-headline">TVA détaillée</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data.tvaDetail.map((t) => (
              <div key={t.rate} className="flex items-center justify-between p-3 bg-surface-1/50 border border-border-subtle">
                <span className="text-xs font-bold text-text-primary">{parseFloat(t.rate)}%</span>
                <div className="text-right">
                  <div className="text-[10px] text-text-muted">Base {formatCurrency(t.baseHT)}</div>
                  <div className="text-xs font-bold text-text-primary">{formatCurrency(t.tva)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paiements */}
      {data.documentType !== "proposal" && (
        <div className="card-sharp p-6">
          <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary mb-4 font-headline">
            Paiements ({data.payments.length})
          </h2>
          {data.payments.length === 0 ? (
            <p className="text-xs text-text-muted">Aucun paiement enregistré.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="border-b border-border-subtle">
                <tr className="text-text-muted text-[10px] uppercase font-bold">
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Mode</th>
                  <th className="text-left px-3 py-2">Référence</th>
                  <th className="text-right px-3 py-2">Montant</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} className="border-b border-border-subtle/40">
                    <td className="px-3 py-2 text-text-secondary">{fmtDate(p.date)}</td>
                    <td className="px-3 py-2 text-text-secondary">{p.type || "—"}</td>
                    <td className="px-3 py-2 text-text-muted font-mono">{p.ref || "—"}</td>
                    <td className="text-right px-3 py-2 text-text-primary font-mono font-bold">
                      {p.amount ? formatCurrency(parseFloat(String(p.amount))) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Documents liés */}
      {(data.linked.sourceProposal || data.linked.sourceInvoice
        || data.linked.invoices.length > 0 || data.linked.creditNotes.length > 0) && (
        <div className="card-sharp p-6">
          <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary mb-4 font-headline">Documents liés</h2>
          <div className="space-y-2 text-xs">
            {data.linked.sourceProposal && (
              <Link href={`/documents/proposal/${data.linked.sourceProposal.id}`}
                className="flex items-center justify-between p-2 bg-surface-1/50 border border-border-subtle hover:border-accent-primary/40">
                <span><FileCheck2 className="w-3 h-3 inline mr-2 text-blue-400" />Devis source : <span className="font-bold">{data.linked.sourceProposal.ref}</span></span>
                <span className="text-text-muted">{fmtMoney(data.linked.sourceProposal.totalHT)} HT</span>
              </Link>
            )}
            {data.linked.sourceInvoice && (
              <Link href={`/documents/invoice/${data.linked.sourceInvoice.id}`}
                className="flex items-center justify-between p-2 bg-surface-1/50 border border-border-subtle hover:border-accent-primary/40">
                <span><Receipt className="w-3 h-3 inline mr-2 text-amber-400" />Facture source : <span className="font-bold">{data.linked.sourceInvoice.ref}</span></span>
                <span className="text-text-muted">{fmtMoney(data.linked.sourceInvoice.totalHT)} HT</span>
              </Link>
            )}
            {data.linked.invoices.map((inv) => (
              <Link key={inv.id} href={`/documents/invoice/${inv.id}`}
                className="flex items-center justify-between p-2 bg-surface-1/50 border border-border-subtle hover:border-accent-primary/40">
                <span><Receipt className="w-3 h-3 inline mr-2 text-amber-400" />Facture liée : <span className="font-bold">{inv.ref}</span> {inv.type && <span className="text-[10px] text-text-muted ml-1">({inv.type})</span>}</span>
                <span className="text-text-muted">{fmtMoney(inv.totalHT)} HT</span>
              </Link>
            ))}
            {data.linked.creditNotes.map((cn) => (
              <Link key={cn.id} href={`/documents/credit_note/${cn.id}`}
                className="flex items-center justify-between p-2 bg-surface-1/50 border border-border-subtle hover:border-accent-primary/40">
                <span><FileMinus className="w-3 h-3 inline mr-2 text-red-400" />Avoir lié : <span className="font-bold">{cn.ref}</span></span>
                <span className="text-text-muted">{fmtMoney(cn.totalHT)} HT</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Notes publiques */}
      {data.notePublic && (
        <div className="card-sharp p-6">
          <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary mb-3 font-headline">
            <FileText className="w-4 h-4 inline mr-2" />Notes
          </h2>
          <pre className="text-xs text-text-secondary whitespace-pre-wrap font-sans leading-relaxed">{data.notePublic}</pre>
        </div>
      )}
    </div>
  );
}
