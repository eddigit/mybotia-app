"use client";

// V1.1.F — Actions de changement de statut sur une facture.
//
// Affichées dans la fiche `/invoices/[id]` ET dans la table de liste.
// Bouton principal varie selon le statut courant :
//   - draft     → "Marquer envoyée" (status=sent) + "Marquer payée" (modale)
//   - sent      → "Marquer payée" (modale)
//   - overdue   → "Marquer payée" (modale)
//   - paid      → (aucune action principale, juste "Annuler")
//   - cancelled → (aucune action principale)
//
// "Annuler" passe au statut `cancelled`. C'est doux : la facture reste
// dans la base et garde son numéro.

import { useState } from "react";
import { Loader2, Send, BadgeCheck, Ban } from "lucide-react";
import { updateInvoiceApi } from "@/hooks/use-api";
import { toast } from "@/components/shared/Toast";
import { MarkAsPaidModal } from "./MarkAsPaidModal";

type Status = "draft" | "sent" | "paid" | "overdue" | "cancelled";

const PAYABLE_STATUSES: Status[] = ["draft", "sent", "overdue"];

export function InvoiceStatusActions({
  invoiceId,
  status,
  onChanged,
  size = "md",
}: {
  invoiceId: string;
  status: Status;
  onChanged?: () => void;
  size?: "sm" | "md";
}) {
  const [busy, setBusy] = useState(false);
  const [showPaid, setShowPaid] = useState(false);

  const baseBtn =
    size === "sm"
      ? "inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight border transition-colors disabled:opacity-50"
      : "inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-tight border transition-colors disabled:opacity-50";

  async function markSent() {
    setBusy(true);
    try {
      await updateInvoiceApi(invoiceId, { status: "sent" });
      toast.success("Facture marquée envoyée.");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur statut");
    } finally {
      setBusy(false);
    }
  }

  async function markCancelled() {
    if (!confirm("Annuler cette facture ? Elle restera visible mais ne sera plus exigible.")) {
      return;
    }
    setBusy(true);
    try {
      await updateInvoiceApi(invoiceId, { status: "cancelled" });
      toast.info("Facture annulée.");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur statut");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="inline-flex items-center gap-1">
        {status === "draft" && (
          <button
            type="button"
            disabled={busy}
            onClick={markSent}
            className={`${baseBtn} border-accent-primary/40 text-accent-glow hover:bg-accent-primary/10`}
            title="Marquer la facture comme envoyée"
          >
            {busy ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3" />
            )}
            Envoyée
          </button>
        )}
        {PAYABLE_STATUSES.includes(status) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowPaid(true)}
            className={`${baseBtn} border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10`}
            title="Marquer la facture comme payée"
          >
            <BadgeCheck className="w-3 h-3" />
            Payée
          </button>
        )}
        {status !== "cancelled" && status !== "paid" && (
          <button
            type="button"
            disabled={busy}
            onClick={markCancelled}
            className={`${baseBtn} border-border-subtle text-text-muted hover:text-rose-300 hover:border-rose-400/40`}
            title="Annuler la facture"
          >
            <Ban className="w-3 h-3" />
            Annuler
          </button>
        )}
      </div>
      <MarkAsPaidModal
        open={showPaid}
        invoiceId={invoiceId}
        onClose={() => setShowPaid(false)}
        onMarked={() => {
          setShowPaid(false);
          onChanged?.();
        }}
      />
    </>
  );
}
