"use client";

// Bloc 7H — Onglet Devis dans /vlm. Liste + détail (lignes, status, PDF).

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  AlertCircle,
  ArrowLeft,
  FileDown,
  Save,
  Trash2,
  X,
  Link2,
  Lock,
  History,
} from "lucide-react";
import {
  type VlmQuote,
  type VlmQuoteLine,
  type VlmQuoteStatus,
  VLM_QUOTE_STATUSES,
  VLM_QUOTE_STATUS_LABEL,
} from "@/lib/vlm-quote-types";

// Bloc 7J — transitions autorisées (miroir client-side de vlm-quote-events.ts)
const ALLOWED_TRANSITIONS: Record<VlmQuoteStatus, VlmQuoteStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["accepted", "refused", "cancelled"],
  accepted: [],
  refused: [],
  cancelled: [],
};

// Bloc 7J — types des events
const EVENT_LABEL: Record<string, string> = {
  quote_created: "création",
  quote_created_from_deal: "création depuis deal",
  quote_updated: "modification",
  quote_status_changed: "changement de statut",
  line_added: "ajout ligne",
  line_updated: "modification ligne",
  line_deleted: "suppression ligne",
  pdf_downloaded: "téléchargement PDF",
  quote_cancelled: "annulation",
};

function fmtMoney(n: number, currency: string): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

interface Props {
  /** Bloc 7I — devis créé depuis un deal, à ouvrir en détail dès l'arrivée sur l'onglet */
  openQuoteId?: string | null;
  onConsumed?: () => void;
}

export function QuotesTab({ openQuoteId, onConsumed }: Props) {
  const [items, setItems] = useState<VlmQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(openQuoteId || null);

  // Quand le parent demande d'ouvrir un devis (via openQuoteId), on le sélectionne
  useEffect(() => {
    if (openQuoteId && openQuoteId !== selectedId) {
      setSelectedId(openQuoteId);
      onConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openQuoteId]);

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/vlm/quotes")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => setItems(j.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (selectedId) {
    return (
      <QuoteDetail
        quoteId={selectedId}
        onBack={() => {
          setSelectedId(null);
          load();
        }}
      />
    );
  }

  return (
    <section className="card-sharp p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-tight text-text-primary font-headline">
          Devis VL Medical
        </h2>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
        >
          <Plus className="w-3 h-3" />
          Nouveau devis
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-1.5 text-[11px] text-status-danger bg-status-danger/10 border border-status-danger/30 px-3 py-2 mb-4">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {showCreate && (
        <CreateQuoteForm
          onCancel={() => setShowCreate(false)}
          onCreated={(q) => {
            setShowCreate(false);
            setSelectedId(q.id);
            load();
          }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-text-muted italic text-center py-4">
          Aucun devis VLM.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left py-2 px-2">Réf</th>
                <th className="text-left py-2 px-2">Titre / Client</th>
                <th className="text-left py-2 px-2">Valide jusqu&apos;au</th>
                <th className="text-right py-2 px-2">Total HT</th>
                <th className="text-right py-2 px-2">Total TTC</th>
                <th className="text-center py-2 px-2">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {items.map((q) => (
                <tr
                  key={q.id}
                  className="hover:bg-surface-2/40 cursor-pointer"
                  onClick={() => setSelectedId(q.id)}
                >
                  <td className="py-2 px-2">
                    <span className="font-mono text-amber-300 font-bold">{q.ref}</span>
                    {q.dealId && <DealLinkChip dealRef={q.dealRef} />}
                  </td>
                  <td className="py-2 px-2">
                    <div className="text-text-primary">{q.title}</div>
                    <div className="text-text-muted text-[10px]">{q.clientName}</div>
                  </td>
                  <td className="py-2 px-2 font-mono text-text-secondary">{fmtDate(q.validUntil)}</td>
                  <td className="py-2 px-2 text-right font-mono text-text-secondary">{fmtMoney(q.totalHt, q.currency)}</td>
                  <td className="py-2 px-2 text-right font-mono text-text-primary">{fmtMoney(q.totalTtc, q.currency)}</td>
                  <td className="py-2 px-2 text-center">
                    <QuoteBadge status={q.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function QuoteBadge({ status }: { status: VlmQuoteStatus }) {
  const cls =
    status === "accepted" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : status === "sent" ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
    : status === "refused" ? "bg-status-danger/15 text-status-danger border-status-danger/30"
    : status === "cancelled" ? "bg-text-muted/15 text-text-muted border-border-subtle"
    : "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase border ${cls}`}>
      {VLM_QUOTE_STATUS_LABEL[status]}
    </span>
  );
}

interface QuoteEvent {
  id: string;
  actorEmail: string | null;
  eventType: string;
  beforeJsonb: Record<string, unknown> | null;
  afterJsonb: Record<string, unknown> | null;
  createdAt: string;
}

function QuoteEventsSection({ quoteId }: { quoteId: string }) {
  const [events, setEvents] = useState<QuoteEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/vlm/quotes/${quoteId}/events`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => setEvents(j.items || []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [quoteId]);

  return (
    <div className="border-t border-border-subtle pt-4">
      <div className="flex items-center gap-2 mb-2">
        <History className="w-3.5 h-3.5 text-text-muted" />
        <h3 className="text-sm font-bold uppercase tracking-tight text-text-primary">Historique</h3>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
        </div>
      ) : err ? (
        <p className="text-xs text-status-danger italic py-2">{err}</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-text-muted italic py-2">Aucun événement enregistré.</p>
      ) : (
        <ul className="space-y-1">
          {events.map((ev) => {
            const summary = formatEventSummary(ev);
            return (
              <li key={ev.id} className="flex items-baseline gap-2 text-[11px] py-1 border-b border-border-subtle/40 last:border-b-0">
                <span className="font-mono text-text-muted text-[10px] shrink-0 w-32">
                  {fmtDateTime(ev.createdAt)}
                </span>
                <span className="font-bold text-amber-300 uppercase text-[10px] shrink-0 w-32 truncate">
                  {EVENT_LABEL[ev.eventType] || ev.eventType}
                </span>
                <span className="text-text-secondary flex-1 min-w-0">{summary}</span>
                <span className="text-text-muted text-[10px] shrink-0 truncate max-w-[12rem]">
                  {ev.actorEmail || "—"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEventSummary(ev: QuoteEvent): string {
  const a = ev.afterJsonb || {};
  const b = ev.beforeJsonb || {};
  switch (ev.eventType) {
    case "quote_status_changed":
      return `${b.status ?? "—"} → ${a.status ?? "—"}`;
    case "line_added":
      return `${a.label ?? ""} (qty=${a.quantity ?? "?"} · PU=${a.unitPriceHt ?? "?"})`;
    case "line_updated":
      return `${b.label ?? a.lineId ?? ""}`;
    case "line_deleted":
      return `${b.label ?? ""}`;
    case "quote_created":
      return `${a.ref ?? ""} · ${a.clientName ?? ""}`;
    case "quote_created_from_deal":
      return `depuis deal ${a.dealRef ?? a.dealId ?? ""} · mode=${a.mode ?? ""}`;
    case "pdf_downloaded":
      return `${a.ref ?? ""}`;
    case "quote_cancelled":
      return `annulé`;
    default:
      return "";
  }
}

function DealLinkChip({ dealRef }: { dealRef: string | null | undefined }) {
  return (
    <span
      className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase border border-accent-primary/30 bg-accent-primary/10 text-accent-glow align-middle"
      title="Devis lié à un deal container"
    >
      <Link2 className="w-2.5 h-2.5" />
      {dealRef ? `deal ${dealRef}` : "lié au deal"}
    </span>
  );
}

function CreateQuoteForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (q: VlmQuote) => void;
}) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [terms, setTerms] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch("/api/vlm/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim() || null,
          clientAddress: clientAddress.trim() || null,
          title: title.trim(),
          validUntil: validUntil.trim() || null,
          terms: terms.trim() || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onCreated(j.item);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-amber-400/30 bg-amber-400/5 p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase text-amber-300">Nouveau devis VLM</h3>
        <button onClick={onCancel} className="text-text-muted hover:text-text-primary">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field label="Client *">
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Email client">
          <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Titre / objet *">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Valide jusqu'au">
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
      </div>
      <Field label="Adresse client">
        <textarea rows={2} value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-xs" />
      </Field>
      <Field label="Conditions">
        <textarea rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Délai paiement, conditions livraison…" className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-xs" />
      </Field>
      {err && (
        <div className="text-[11px] text-status-danger flex items-start gap-1">
          <AlertCircle className="w-3 h-3 mt-0.5" />
          <span>{err}</span>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1 text-[10px] uppercase border border-border-subtle text-text-muted">
          Annuler
        </button>
        <button onClick={handleCreate} disabled={saving || !clientName.trim() || !title.trim()} className="inline-flex items-center gap-1 px-3 py-1 text-[10px] uppercase font-bold border border-amber-400/30 bg-amber-400/20 text-amber-300 disabled:opacity-40">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Créer
        </button>
      </div>
    </div>
  );
}

function QuoteDetail({ quoteId, onBack }: { quoteId: string; onBack: () => void }) {
  const [quote, setQuote] = useState<VlmQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddLine, setShowAddLine] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    fetch(`/api/vlm/quotes/${quoteId}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => setQuote(j.item))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [quoteId]);

  async function updateStatus(next: VlmQuoteStatus) {
    setError(null);
    try {
      const r = await fetch(`/api/vlm/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setQuote(j.item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function deleteLine(lineId: string) {
    setError(null);
    try {
      const r = await fetch(`/api/vlm/quotes/${quoteId}/lines/${lineId}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  if (loading) {
    return (
      <section className="card-sharp p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </section>
    );
  }

  if (error || !quote) {
    return (
      <section className="card-sharp p-6 space-y-3">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary">
          <ArrowLeft className="w-3 h-3" /> retour aux devis
        </button>
        <div className="flex items-start gap-2 text-status-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error || "Devis introuvable"}</span>
        </div>
      </section>
    );
  }

  const isDraft = quote.status === "draft";

  return (
    <section className="card-sharp p-6 space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary">
          <ArrowLeft className="w-3 h-3" /> retour aux devis
        </button>
        <div className="flex items-center gap-2">
          <a
            href={`/api/vlm/pdf/quote/${quote.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
          >
            <FileDown className="w-3 h-3" />
            Télécharger PDF
          </a>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-1.5 text-[11px] text-status-danger bg-status-danger/10 border border-status-danger/30 px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-base font-mono font-bold text-amber-300">{quote.ref}</span>
            <QuoteBadge status={quote.status} />
            {quote.dealId && <DealLinkChip dealRef={quote.dealRef} />}
          </div>
          <h1 className="text-lg text-text-primary">{quote.title}</h1>
          <p className="text-[11px] text-text-muted mt-1">
            Émis le {fmtDate(quote.createdAt)}
            {quote.validUntil && ` · Valide jusqu'au ${fmtDate(quote.validUntil)}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-text-muted">Total TTC</p>
          <p className="text-2xl font-headline font-extrabold text-amber-300 font-mono">
            {fmtMoney(quote.totalTtc, quote.currency)}
          </p>
        </div>
      </div>

      {/* Bandeau verrouillé si !draft */}
      {!isDraft && (
        <div className="flex items-start gap-2 p-3 border border-amber-400/30 bg-amber-400/10 text-[11px] text-amber-300">
          <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Ce devis n&apos;est plus en brouillon (statut <span className="font-mono font-bold">{VLM_QUOTE_STATUS_LABEL[quote.status]}</span>).
            Les lignes sont verrouillées. Seules les transitions de statut autorisées restent disponibles.
          </span>
        </div>
      )}

      {/* Client */}
      <div className="card-sharp-high p-4">
        <p className="text-[10px] uppercase text-text-muted mb-1">Client</p>
        <p className="text-sm font-bold text-text-primary">{quote.clientName}</p>
        {quote.clientEmail && <p className="text-xs text-text-muted">{quote.clientEmail}</p>}
        {quote.clientAddress &&
          quote.clientAddress.split(/\r?\n/).map((line, i) => (
            <p key={i} className="text-xs text-text-secondary">{line}</p>
          ))
        }
      </div>

      {/* Lignes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold uppercase tracking-tight text-text-primary">Lignes</h3>
          {isDraft && (
            <button
              onClick={() => setShowAddLine(true)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase border border-amber-400/30 bg-amber-400/10 text-amber-300"
            >
              <Plus className="w-3 h-3" /> Ajouter ligne
            </button>
          )}
        </div>
        {showAddLine && isDraft && (
          <AddLineForm
            quoteId={quote.id}
            currency={quote.currency}
            onCancel={() => setShowAddLine(false)}
            onAdded={() => {
              setShowAddLine(false);
              load();
            }}
          />
        )}
        {(quote.lines || []).length === 0 ? (
          <p className="text-xs text-text-muted italic py-3">Aucune ligne dans ce devis.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border-subtle text-text-muted text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left py-2 px-2">Désignation</th>
                  <th className="text-right py-2 px-2">Qté</th>
                  <th className="text-left py-2 px-2">Unité</th>
                  <th className="text-right py-2 px-2">P.U. HT</th>
                  <th className="text-right py-2 px-2">TVA %</th>
                  <th className="text-right py-2 px-2">Total HT</th>
                  <th className="text-right py-2 px-2">Total TTC</th>
                  {isDraft && <th></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {(quote.lines || []).map((l: VlmQuoteLine) => (
                  <tr key={l.id} className="hover:bg-surface-2/40">
                    <td className="py-2 px-2">
                      <div className="text-text-primary">{l.label}</div>
                      {l.description && <div className="text-[10px] text-text-muted">{l.description}</div>}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{l.quantity}</td>
                    <td className="py-2 px-2 text-text-muted">{l.unit || "—"}</td>
                    <td className="py-2 px-2 text-right font-mono">{fmtMoney(l.unitPriceHt, quote.currency)}</td>
                    <td className="py-2 px-2 text-right font-mono">{l.vatRate}%</td>
                    <td className="py-2 px-2 text-right font-mono text-text-secondary">{fmtMoney(l.lineTotalHt, quote.currency)}</td>
                    <td className="py-2 px-2 text-right font-mono text-text-primary">{fmtMoney(l.lineTotalTtc, quote.currency)}</td>
                    {isDraft && (
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => deleteLine(l.id)} className="text-status-danger hover:text-red-400 text-[10px]">
                          <Trash2 className="w-3 h-3 inline" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-3 gap-2 max-w-md ml-auto">
        <div className="col-span-2 p-2 text-right text-[11px] text-text-muted">Total HT</div>
        <div className="p-2 text-right font-mono text-text-primary">{fmtMoney(quote.totalHt, quote.currency)}</div>
        <div className="col-span-2 p-2 text-right text-[11px] text-text-muted">Total TVA</div>
        <div className="p-2 text-right font-mono text-text-primary">{fmtMoney(quote.totalVat, quote.currency)}</div>
        <div className="col-span-2 p-2 text-right text-[11px] font-bold uppercase text-amber-300 bg-amber-400/10">Total TTC</div>
        <div className="p-2 text-right font-mono font-bold text-amber-300 bg-amber-400/10">{fmtMoney(quote.totalTtc, quote.currency)}</div>
      </div>

      {/* Section Historique — Bloc 7J */}
      <QuoteEventsSection quoteId={quote.id} />

      {/* Statut workflow — Bloc 7J : seules les transitions autorisées sont cliquables */}
      <div className="border-t border-border-subtle pt-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase text-text-muted">Statut actuel</p>
          <div className="mt-1"><QuoteBadge status={quote.status} /></div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(() => {
            const allowed = ALLOWED_TRANSITIONS[quote.status] || [];
            if (allowed.length === 0) {
              return (
                <span className="text-[10px] text-text-muted italic">
                  statut terminal · aucune transition possible
                </span>
              );
            }
            return allowed.map((s) => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                className="px-2 py-1 text-[10px] uppercase border border-amber-400/30 text-amber-300 bg-amber-400/10 hover:bg-amber-400/20"
              >
                → {VLM_QUOTE_STATUS_LABEL[s]}
              </button>
            ));
          })()}
        </div>
      </div>
    </section>
  );
}

function AddLineForm({
  quoteId,
  currency,
  onCancel,
  onAdded,
}: {
  quoteId: string;
  currency: string;
  onCancel: () => void;
  onAdded: () => void;
}) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [unitPriceHt, setUnitPriceHt] = useState("0");
  const [vatRate, setVatRate] = useState("20");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const previewTotal = useMemo(() => {
    const q = Number(quantity) || 0;
    const p = Number(unitPriceHt) || 0;
    const v = Number(vatRate) || 0;
    const ht = q * p;
    const tva = ht * v / 100;
    return { ht, tva, ttc: ht + tva };
  }, [quantity, unitPriceHt, vatRate]);

  async function handleAdd() {
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/vlm/quotes/${quoteId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          description: description.trim() || null,
          quantity: Number(quantity),
          unit: unit.trim() || null,
          unitPriceHt: Number(unitPriceHt),
          vatRate: Number(vatRate),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-amber-400/30 bg-amber-400/5 p-3 mb-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-bold uppercase text-amber-300">Ajouter une ligne</h4>
        <button onClick={onCancel} className="text-text-muted hover:text-text-primary">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field label="Désignation *">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Unité">
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit, kg, h…" className="w-full bg-surface-2 border border-border-subtle px-2 py-1" />
        </Field>
        <Field label="Quantité">
          <input type="number" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label={`Prix unitaire HT (${currency})`}>
          <input type="number" step="0.01" min="0" value={unitPriceHt} onChange={(e) => setUnitPriceHt(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
        <Field label="TVA %">
          <input type="number" step="0.01" min="0" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 font-mono" />
        </Field>
      </div>
      <Field label="Description">
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-surface-2 border border-border-subtle px-2 py-1 text-xs" />
      </Field>
      <div className="text-[10px] text-text-muted text-right">
        Preview : HT <span className="font-mono">{fmtMoney(previewTotal.ht, currency)}</span> + TVA{" "}
        <span className="font-mono">{fmtMoney(previewTotal.tva, currency)}</span> ={" "}
        <span className="font-mono font-bold text-text-primary">{fmtMoney(previewTotal.ttc, currency)}</span>
      </div>
      {err && (
        <div className="text-[11px] text-status-danger flex items-start gap-1">
          <AlertCircle className="w-3 h-3 mt-0.5" />
          <span>{err}</span>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1 text-[10px] uppercase border border-border-subtle text-text-muted">
          Annuler
        </button>
        <button onClick={handleAdd} disabled={saving || !label.trim()} className="inline-flex items-center gap-1 px-3 py-1 text-[10px] uppercase font-bold border border-amber-400/30 bg-amber-400/20 text-amber-300 disabled:opacity-40">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Ajouter
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase text-text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
