"use client";

// V1.1.F — Boutons changement de statut devis (sent / accepted / refused).
//
// Confirmation modale obligatoire pour chaque transition (doctrine UX :
// pas d'action irréversible sans confirm). PATCH /api/quotes/[id].

import { useState } from "react";
import { CheckCircle2, Send, XCircle, Loader2 } from "lucide-react";

import { FormModal, btnPrimary, btnSecondary } from "@/components/shared/FormModal";
import { updateQuoteApi, type QuoteDetail } from "@/hooks/use-api";
import { toast } from "@/components/shared/Toast";

type Transition = "sent" | "accepted" | "refused";

const TRANSITION_LABEL: Record<Transition, string> = {
  sent: "Marquer comme envoyé",
  accepted: "Marquer comme accepté",
  refused: "Marquer comme refusé",
};

const TRANSITION_DESC: Record<Transition, string> = {
  sent: "Le devis sera marqué envoyé. Le client pourra l'accepter ou le refuser.",
  accepted:
    "Le devis sera marqué accepté. Vous pourrez ensuite le convertir en facture.",
  refused: "Le devis sera marqué refusé. Aucune facture ne pourra être générée.",
};

export function QuoteStatusActions({
  quote,
  onChanged,
}: {
  quote: QuoteDetail;
  onChanged?: () => void;
}) {
  const [pending, setPending] = useState<Transition | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      await updateQuoteApi(quote.id, { status: pending });
      toast.success(`Devis ${TRANSITION_LABEL[pending].toLowerCase()}`);
      onChanged?.();
      setPending(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  // Status flow business V1.1.D :
  //   draft ─▶ sent ─▶ accepted | refused | cancelled
  //   accepted ─▶ (convertible en facture)
  // Les transitions inverses (accepted → sent par ex.) sont possibles via
  // EditQuoteModal mais on ne les expose pas en boutons rapides.
  const canSend = quote.status === "draft";
  const canAccept = quote.status === "draft" || quote.status === "sent";
  const canRefuse = quote.status === "draft" || quote.status === "sent";

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {canSend && (
          <button
            type="button"
            onClick={() => setPending("sent")}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-blue-500/40 bg-blue-500/10 text-blue-200 text-[11px] font-bold uppercase tracking-tight hover:bg-blue-500/20"
            title="Marquer envoyé"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Marquer envoyé</span>
          </button>
        )}
        {canAccept && (
          <button
            type="button"
            onClick={() => setPending("accepted")}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-[11px] font-bold uppercase tracking-tight hover:bg-emerald-500/20"
            title="Marquer accepté"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Marquer accepté</span>
          </button>
        )}
        {canRefuse && (
          <button
            type="button"
            onClick={() => setPending("refused")}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-rose-500/40 bg-rose-500/10 text-rose-200 text-[11px] font-bold uppercase tracking-tight hover:bg-rose-500/20"
            title="Marquer refusé"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Marquer refusé</span>
          </button>
        )}
      </div>

      <FormModal
        open={pending !== null}
        onClose={() => (busy ? undefined : setPending(null))}
        title={pending ? TRANSITION_LABEL[pending] : "Confirmer"}
      >
        {pending && (
          <div className="space-y-4">
            <p className="text-sm text-text-primary">
              {TRANSITION_DESC[pending]}
            </p>
            <p className="text-xs text-text-muted">
              Devis : <span className="font-mono">{quote.number}</span>
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={busy}
                className={btnSecondary}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className={btnPrimary}
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirmer
              </button>
            </div>
          </div>
        )}
      </FormModal>
    </>
  );
}
