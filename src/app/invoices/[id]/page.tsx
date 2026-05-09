"use client";

// V1.1.F — Fiche détail facture (cockpit app.mybotia).
//
// Endpoints :
//   - GET    /api/invoices/[id]   → header + lignes
//   - PATCH  /api/invoices/[id]   → modifications (modale Edit)
//   - DELETE /api/invoices/[id]
//   - GET    /api/invoices/[id]/pdf
//   - PATCH  status (boutons InvoiceStatusActions + MarkAsPaidModal)
//
// Doctrine "app.mybotia = parité CRM" : tout est ici, plus besoin
// d'ouvrir crm.mybotia.com.

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Receipt,
  Loader2,
  Pencil,
  Download,
  Trash2,
  ExternalLink,
  AlertTriangle,
  FileSignature,
  Hammer,
  User as UserIcon,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { FeatureDisabled } from "@/components/shared/FeatureDisabled";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  useCockpitFeatures,
  useScopedClients,
  deleteInvoiceApi,
  type InvoiceRow,
  type InvoiceItemRow,
} from "@/hooks/use-api";
import { EditInvoiceModal } from "@/components/invoices/EditInvoiceModal";
import { InvoiceStatusActions } from "@/components/invoices/InvoiceStatusActions";
import { toast } from "@/components/shared/Toast";
import { formatDateFR, formatDateLongFR, formatMoneyFR } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Brouillon",
    className: "bg-text-muted/15 text-text-muted border-border-subtle",
  },
  sent: {
    label: "Envoyée",
    className: "bg-accent-primary/15 text-accent-glow border-accent-primary/40",
  },
  paid: {
    label: "Payée",
    className: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40",
  },
  overdue: {
    label: "En retard",
    className: "bg-amber-400/15 text-amber-200 border-amber-400/40",
  },
  cancelled: {
    label: "Annulée",
    className: "bg-rose-400/15 text-rose-300 border-rose-400/40",
  },
};

function safeNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function getDate(inv: InvoiceRow, key: "issuedAt" | "dueDate"): string | null {
  if (key === "issuedAt") return inv.issuedAt ?? inv.issued_at ?? null;
  return inv.dueDate ?? inv.due_date ?? null;
}

function getClientId(inv: InvoiceRow): string {
  return (inv.clientId ?? inv.client_id ?? "") as string;
}

function getProjectId(inv: InvoiceRow): string | null {
  return (inv.projectId ?? inv.project_id ?? null) as string | null;
}

function getQuoteId(inv: InvoiceRow): string | null {
  return (inv.quoteId ?? inv.quote_id ?? null) as string | null;
}

function isOverdue(inv: InvoiceRow): boolean {
  if (inv.status === "paid" || inv.status === "cancelled") return false;
  const due = getDate(inv, "dueDate");
  if (!due) return false;
  const today = new Date().toISOString().slice(0, 10);
  return due < today;
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: cockpitFeatures, loading: featuresLoading } =
    useCockpitFeatures();
  const financeEnabled = cockpitFeatures?.features?.finance === true;
  const isBusiness = cockpitFeatures?.crmProvider === "mybotia_business";

  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: clients } = useScopedClients();
  const clientById = useMemo(() => {
    const m = new Map<string, { name: string; town?: string }>();
    for (const c of clients) {
      m.set(String(c.id), {
        name: c.company || c.name || "—",
        town: c.town,
      });
    }
    return m;
  }, [clients]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/invoices/${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || `invoice_http_${r.status}`);
        }
        return (await r.json()) as InvoiceRow;
      })
      .then((inv) => {
        if (cancelled) return;
        setInvoice(inv);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  const refetch = () => setTick((t) => t + 1);

  async function handleDelete() {
    if (!invoice) return;
    if (
      !confirm(
        `Supprimer la facture ${invoice.number} ? Action irréversible.`,
      )
    )
      return;
    setDeleting(true);
    try {
      await deleteInvoiceApi(invoice.id);
      toast.success("Facture supprimée.");
      router.push("/invoices");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur suppression");
      setDeleting(false);
    }
  }

  if (!featuresLoading && cockpitFeatures && !financeEnabled) {
    return (
      <FeatureDisabled
        featureKey="finance"
        tenantSlug={cockpitFeatures.tenant}
      />
    );
  }

  if (!featuresLoading && cockpitFeatures && !isBusiness) {
    return (
      <div className="p-8 min-h-screen space-y-6">
        <ModuleHeader
          icon={Receipt}
          title="Facture"
          subtitle="CRM legacy"
        />
        <div className="card-sharp p-6 space-y-3">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-bold">
              Cette page est réservée aux tenants mybotia-business.
            </span>
          </div>
          <Link href="/finance" className="text-accent-glow hover:underline text-[12px]">
            ← Retour à la trésorerie
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent-glow" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-8 min-h-screen space-y-6">
        <BackLink />
        <ErrorState
          title="Facture introuvable"
          message={error ?? "Aucune donnée."}
          onRetry={refetch}
        />
      </div>
    );
  }

  const tone = STATUS_TONE[invoice.status] ?? STATUS_TONE.draft;
  const overdue = isOverdue(invoice);
  const total = safeNumber(invoice.totalTtc ?? invoice.total_ttc);
  const ht = safeNumber(invoice.subtotalHt ?? invoice.subtotal_ht);
  const vat = safeNumber(invoice.vatTotal ?? invoice.vat_total);
  const cid = getClientId(invoice);
  const cinfo = clientById.get(cid);
  const cname = cinfo?.name ?? "—";
  const projectId = getProjectId(invoice);
  const quoteId = getQuoteId(invoice);
  const items: InvoiceItemRow[] = invoice.items ?? [];

  return (
    <div className="p-8 min-h-screen space-y-6">
      <BackLink />
      <ModuleHeader
        icon={Receipt}
        title={invoice.number}
        subtitle={
          invoice.subject
            ? `${invoice.subject} · ${cname}`
            : cname
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`/api/invoices/${encodeURIComponent(invoice.id)}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-accent-primary/40 text-accent-glow hover:bg-accent-primary/10"
            >
              <Download className="w-3 h-3" />
              PDF
            </a>
            <button
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-text-primary"
            >
              <Pencil className="w-3 h-3" />
              Modifier
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-border-subtle text-text-muted hover:text-rose-300 hover:border-rose-400/40 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              Supprimer
            </button>
          </div>
        }
      />

      {/* Status row */}
      <section className="card-sharp p-4 flex items-center gap-3 flex-wrap">
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-tight border",
            tone.className,
          )}
        >
          {tone.label}
        </span>
        {overdue && invoice.status !== "overdue" && (
          <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-tight border bg-amber-400/15 text-amber-200 border-amber-400/40">
            En retard
          </span>
        )}
        <span className="text-[11px] text-text-muted">
          Émise le{" "}
          <span className="text-text-secondary tabular-nums">
            {formatDateLongFR(getDate(invoice, "issuedAt"))}
          </span>
        </span>
        <span className="text-[11px] text-text-muted">
          Échéance{" "}
          <span className="text-text-secondary tabular-nums">
            {formatDateLongFR(getDate(invoice, "dueDate"))}
          </span>
        </span>
        <div className="ml-auto">
          <InvoiceStatusActions
            invoiceId={invoice.id}
            status={invoice.status}
            onChanged={refetch}
            size="md"
          />
        </div>
      </section>

      {/* Client + linked entities */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-sharp p-4 space-y-2">
          <div className="flex items-center gap-2 text-text-muted">
            <UserIcon className="w-3.5 h-3.5" />
            <span className="micro-label">Client</span>
          </div>
          <p className="text-sm font-bold text-text-primary">{cname}</p>
          {cinfo?.town && (
            <p className="text-[12px] text-text-secondary">{cinfo.town}</p>
          )}
          {cid && (
            <Link
              href={`/crm/${cid}`}
              className="inline-flex items-center gap-1 text-[10px] text-accent-glow hover:underline"
            >
              Ouvrir la fiche client
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>

        <div className="card-sharp p-4 space-y-2">
          <div className="flex items-center gap-2 text-text-muted">
            <Hammer className="w-3.5 h-3.5" />
            <span className="micro-label">Production liée</span>
          </div>
          {projectId ? (
            <Link
              href={`/productions/${projectId}`}
              className="inline-flex items-center gap-1 text-sm text-accent-glow hover:underline"
            >
              Voir la production
              <ExternalLink className="w-3 h-3" />
            </Link>
          ) : (
            <p className="text-[12px] text-text-muted">
              Aucune production liée.
            </p>
          )}
        </div>

        <div className="card-sharp p-4 space-y-2">
          <div className="flex items-center gap-2 text-text-muted">
            <FileSignature className="w-3.5 h-3.5" />
            <span className="micro-label">Devis source</span>
          </div>
          {quoteId ? (
            <Link
              href={`/affaires?quote=${encodeURIComponent(quoteId)}`}
              className="inline-flex items-center gap-1 text-sm text-accent-glow hover:underline"
            >
              Voir le devis
              <ExternalLink className="w-3 h-3" />
            </Link>
          ) : (
            <p className="text-[12px] text-text-muted">
              Cette facture n&apos;est pas issue d&apos;un devis.
            </p>
          )}
        </div>
      </section>

      {/* Lines */}
      <section className="card-sharp p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-tight text-text-muted bg-surface-2/40">
            <tr>
              <th className="text-left py-2.5 px-4 font-bold">Libellé</th>
              <th className="text-right py-2.5 px-3 font-bold w-20">Qté</th>
              <th className="text-right py-2.5 px-3 font-bold w-32">PU HT</th>
              <th className="text-right py-2.5 px-3 font-bold w-20">TVA</th>
              <th className="text-right py-2.5 px-4 font-bold w-32">Total HT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-6 text-center text-[12px] text-text-muted"
                >
                  Aucune ligne sur cette facture.
                </td>
              </tr>
            ) : (
              items.map((it, idx) => {
                const qty = safeNumber(it.qty);
                const unit = safeNumber(it.unitPriceHt ?? it.unit_price_ht);
                const lineHt = safeNumber(it.lineHt ?? it.line_ht ?? qty * unit);
                const tva = safeNumber(it.vatRate ?? it.vat_rate);
                return (
                  <tr key={it.id ?? idx}>
                    <td className="py-2.5 px-4">
                      <p className="text-text-primary font-medium">{it.label}</p>
                      {it.description && (
                        <p className="text-[11px] text-text-muted whitespace-pre-line">
                          {it.description}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">
                      {qty.toLocaleString("fr-FR")}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">
                      {formatMoneyFR(unit)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">
                      {tva.toLocaleString("fr-FR", {
                        minimumFractionDigits: 0,
                      })}
                      &nbsp;%
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-bold text-text-primary">
                      {formatMoneyFR(lineHt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-subtle">
              <td colSpan={4} className="py-2 px-4 text-right text-text-secondary">
                Total HT
              </td>
              <td className="py-2 px-4 text-right tabular-nums text-text-secondary">
                {formatMoneyFR(ht)}
              </td>
            </tr>
            <tr>
              <td colSpan={4} className="py-1 px-4 text-right text-text-secondary">
                TVA
              </td>
              <td className="py-1 px-4 text-right tabular-nums text-text-secondary">
                {formatMoneyFR(vat)}
              </td>
            </tr>
            <tr className="bg-surface-2/40">
              <td
                colSpan={4}
                className="py-2.5 px-4 text-right font-headline font-bold text-text-primary text-base"
              >
                Total TTC
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums font-headline font-bold text-text-primary text-base">
                {formatMoneyFR(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Payment block */}
      <section className="card-sharp p-4 space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-tight font-headline text-text-primary">
          Paiement
        </h3>
        {invoice.status === "paid" ? (
          <p className="text-[12px] text-emerald-300">
            Facture payée
            {(invoice.paidAt ?? invoice.paid_at) && (
              <>
                {" "}
                — encaissée le{" "}
                <span className="tabular-nums">
                  {formatDateFR(invoice.paidAt ?? invoice.paid_at)}
                </span>
              </>
            )}
            .
          </p>
        ) : invoice.status === "cancelled" ? (
          <p className="text-[12px] text-rose-300">
            Facture annulée — non exigible.
          </p>
        ) : (
          <p className="text-[12px] text-text-muted">
            En attente de paiement. Utilise &laquo; Marquer payée &raquo; en
            haut pour enregistrer un encaissement.
          </p>
        )}
      </section>

      {/* Notes */}
      {invoice.notes && (
        <section className="card-sharp p-4 space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-tight font-headline text-text-primary">
            Notes
          </h3>
          <p className="text-[12px] text-text-secondary whitespace-pre-line">
            {invoice.notes}
          </p>
        </section>
      )}

      <EditInvoiceModal
        open={showEdit}
        invoiceId={invoice.id}
        onClose={() => setShowEdit(false)}
        onUpdated={() => {
          setShowEdit(false);
          refetch();
        }}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/invoices"
      className="inline-flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary"
    >
      <ArrowLeft className="w-3 h-3" />
      Toutes les factures
    </Link>
  );
}
