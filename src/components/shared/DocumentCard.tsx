"use client";

// Composant autonome pour afficher un document Dolibarr (devis ou facture) dans
// l'UI avec actions Telecharger / Generer. FSM stricte : aucune generation
// automatique silencieuse (regle Bloc 3, validee Gilles 2026-05-03).
//
// Reutilise dans :
//  - /crm/[id] (lignes devis/factures de la card Documents) — via renderPdfActions inline
//  - /conversations (ConversationThread, MessageBubble) — via ce composant
//
// Endpoints utilises (existants, deja branches Dolibarr) :
//  - GET  /api/documents/download?modulepart=propale|facture&ref=...
//  - POST /api/documents/generate { modulepart, ref }

import { useState } from "react";
import {
  FileText,
  Download,
  Loader2,
  FilePlus,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

export type DocumentKind = "propale" | "facture";

type DocState =
  | "idle"
  | "downloading"
  | "missing"
  | "generating"
  | "ready"
  | "error";

export function DocumentCard({
  modulepart,
  reference,
  total,
  status,
  date,
  compact = false,
}: {
  modulepart: DocumentKind;
  reference: string;
  total?: number;
  status?: string;
  date?: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<DocState>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function handleDownload() {
    setState("downloading");
    setErrMsg(null);
    try {
      const url = `/api/documents/download?modulepart=${encodeURIComponent(
        modulepart
      )}&ref=${encodeURIComponent(reference)}`;
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const a = document.createElement("a");
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = `${reference}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
        setState("idle");
        return;
      }
      if (res.status === 404 || res.status === 502) {
        setState("missing");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setErrMsg(data?.error || `Erreur telechargement (${res.status})`);
      setState("error");
    } catch (e) {
      setErrMsg((e as Error).message);
      setState("error");
    }
  }

  async function handleGenerate() {
    setState("generating");
    setErrMsg(null);
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulepart, ref: reference }),
      });
      if (res.ok) {
        setState("ready");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setErrMsg(data?.error || `Erreur generation (${res.status})`);
      setState("error");
    } catch (e) {
      setErrMsg((e as Error).message);
      setState("error");
    }
  }

  const kindLabel = modulepart === "propale" ? "Devis" : "Facture";
  const kindColor =
    modulepart === "propale" ? "text-accent-glow" : "text-amber-300";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 px-3 py-2 bg-surface-2 border border-border-subtle",
        compact ? "text-[11px]" : "text-xs"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center shrink-0 bg-surface-3 border border-border-subtle",
          compact ? "w-7 h-7" : "w-9 h-9"
        )}
      >
        <FileText className={cn("text-text-muted", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("font-bold uppercase tracking-tight", kindColor)}>
            {kindLabel}
          </span>
          <span className="font-mono font-bold text-text-primary truncate">
            {reference}
          </span>
        </div>
        {(total !== undefined || status || date) && (
          <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
            {total !== undefined && (
              <span className="font-bold text-text-secondary">
                {formatCurrency(total)}
              </span>
            )}
            {status && <span className="uppercase">{status}</span>}
            {date && (
              <span className="font-mono">
                {new Date(date).toLocaleDateString("fr-FR")}
              </span>
            )}
          </div>
        )}
      </div>
      <DocumentActionButton
        state={state}
        errMsg={errMsg}
        onDownload={handleDownload}
        onGenerate={handleGenerate}
      />
    </div>
  );
}

function DocumentActionButton({
  state,
  errMsg,
  onDownload,
  onGenerate,
}: {
  state: DocState;
  errMsg: string | null;
  onDownload: () => void;
  onGenerate: () => void;
}) {
  const baseBtn =
    "inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-tight transition-all shrink-0";

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
        Generation
      </button>
    );
  }
  if (state === "missing") {
    return (
      <button
        onClick={onGenerate}
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
        onClick={onDownload}
        className={`${baseBtn} text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/30`}
        title={errMsg || "Erreur lors du telechargement. Cliquer pour reessayer."}
      >
        <AlertCircle className="w-3 h-3" />
        Reessayer
      </button>
    );
  }
  return (
    <button
      onClick={onDownload}
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

// Detection de references documents Dolibarr dans un texte libre.
// Patterns supportes en v1 :
//  - factures default : FA{yymm}-{nnnn}     (ex: FA2604-0001)
//  - propals default  : PR{yymm}-{nnnn}     (ex: PR2604-0001)
//  - factures VLM     : 1C{yy}{mm}{nn}      (ex: 1C260501)
//  - propals VLM      : D{yy}{mm}{nn}       (ex: D260501)
// Renvoie une liste deduplique des matches avec leur kind (propale|facture).
export function detectDocumentReferences(
  text: string
): Array<{ ref: string; kind: DocumentKind }> {
  if (!text) return [];
  const found = new Map<string, DocumentKind>();
  const factureRegex = /\b(FA\d{4}-\d{4}|1C\d{6})\b/g;
  const propaleRegex = /\b(PR\d{4}-\d{4}|D\d{6})\b/g;
  for (const m of text.matchAll(factureRegex)) {
    if (!found.has(m[1])) found.set(m[1], "facture");
  }
  for (const m of text.matchAll(propaleRegex)) {
    if (!found.has(m[1])) found.set(m[1], "propale");
  }
  return Array.from(found.entries()).map(([ref, kind]) => ({ ref, kind }));
}
