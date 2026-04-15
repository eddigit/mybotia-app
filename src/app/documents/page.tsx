"use client";

import { useState } from "react";
import {
  FileText,
  Download,
  FileOutput,
  Receipt,
  FileCheck2,
  Loader2,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { useDocuments } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/utils";

type FilterKey = "all" | "devis" | "facture";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "devis", label: "Devis" },
  { key: "facture", label: "Factures" },
];

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-zinc-500/15 text-zinc-400" },
  sent: { label: "Envoyee", className: "bg-blue-500/15 text-blue-400" },
  paid: { label: "Payee", className: "bg-emerald-500/15 text-emerald-400" },
  validated: {
    label: "Valide",
    className: "bg-blue-500/15 text-blue-400",
  },
  signed: {
    label: "Signe",
    className: "bg-emerald-500/15 text-emerald-400",
  },
  refused: { label: "Refuse", className: "bg-red-500/15 text-red-400" },
  billed: {
    label: "Facture",
    className: "bg-violet-500/15 text-violet-400",
  },
};

export default function DocumentsPage() {
  const { data: documents, loading } = useDocuments();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [generating, setGenerating] = useState<string | null>(null);

  const filtered = documents.filter((d) => {
    if (filter === "all") return true;
    return d.type === filter;
  });

  const devisCount = documents.filter((d) => d.type === "devis").length;
  const factureCount = documents.filter((d) => d.type === "facture").length;
  const totalDevis = documents
    .filter((d) => d.type === "devis")
    .reduce((s, d) => s + d.totalTTC, 0);
  const totalFactures = documents
    .filter((d) => d.type === "facture")
    .reduce((s, d) => s + d.totalTTC, 0);

  async function handleGenerate(
    modulepart: string,
    ref: string,
    docId: string
  ) {
    setGenerating(docId);
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulepart, ref }),
      });
      const data = await res.json();
      if (data.content) {
        const binary = atob(data.content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || `${ref}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // silent fail
    } finally {
      setGenerating(null);
    }
  }

  function handleDownload(modulepart: string, ref: string) {
    window.open(
      `/api/documents/download?modulepart=${encodeURIComponent(modulepart)}&ref=${encodeURIComponent(ref)}`,
      "_blank"
    );
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted micro-label">
            Chargement des documents...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <ModuleHeader
        icon={FileText}
        title="Documents"
        subtitle={`${documents.length} documents · ${devisCount} devis · ${factureCount} factures`}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Total documents",
            value: documents.length.toString(),
            sub: "devis + factures",
            Icon: FileText,
          },
          {
            label: "Devis",
            value: devisCount.toString(),
            sub: formatCurrency(totalDevis),
            Icon: FileCheck2,
          },
          {
            label: "Factures",
            value: factureCount.toString(),
            sub: formatCurrency(totalFactures),
            Icon: Receipt,
          },
          {
            label: "En attente",
            value: documents
              .filter(
                (d) => d.status === "draft" || d.status === "validated"
              )
              .length.toString(),
            sub: "brouillons + valides",
            Icon: FileOutput,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="card-sharp-high p-5">
            <div className="flex items-center gap-2 mb-2">
              <kpi.Icon className="w-3.5 h-3.5 text-accent-glow" />
              <span className="micro-label text-text-muted">{kpi.label}</span>
            </div>
            <p className="text-2xl font-headline font-extrabold text-text-primary">
              {kpi.value}
            </p>
            <p className="text-[10px] text-text-muted mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter + Table */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-header text-sm font-bold tracking-tight uppercase text-text-primary font-headline">
            Liste ({filtered.length})
          </h3>
          <div className="flex gap-1 bg-surface-1 p-1 rounded-sm">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight rounded-sm transition-all ${
                  filter === f.key
                    ? "bg-accent-primary/10 text-accent-glow"
                    : "text-text-muted hover:bg-surface-3/50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Documents table */}
        <div className="card-sharp overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-5 py-3 micro-label text-text-muted">
                  Type
                </th>
                <th className="text-left px-5 py-3 micro-label text-text-muted">
                  Reference
                </th>
                <th className="text-left px-5 py-3 micro-label text-text-muted">
                  Client
                </th>
                <th className="text-right px-5 py-3 micro-label text-text-muted">
                  Montant TTC
                </th>
                <th className="text-left px-5 py-3 micro-label text-text-muted">
                  Statut
                </th>
                <th className="text-left px-5 py-3 micro-label text-text-muted">
                  Date
                </th>
                <th className="text-right px-5 py-3 micro-label text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => {
                const st = STATUS_LABELS[doc.status] || STATUS_LABELS.draft;
                const isGenerating = generating === doc.id;
                return (
                  <tr
                    key={doc.id}
                    className="border-b border-white/[0.04] hover:bg-surface-3/30 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase rounded-sm ${
                          doc.type === "devis"
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {doc.type === "devis" ? (
                          <FileCheck2 className="w-3 h-3" />
                        ) : (
                          <Receipt className="w-3 h-3" />
                        )}
                        {doc.type === "devis" ? "Devis" : "Facture"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-bold font-mono text-text-primary">
                        {doc.ref}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-text-secondary">
                        {doc.clientName}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-xs font-bold font-mono text-text-primary">
                        {formatCurrency(doc.totalTTC)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-sm ${st.className}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[11px] text-text-muted font-mono">
                        {doc.date}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() =>
                            handleGenerate(doc.modulepart, doc.ref, doc.id)
                          }
                          disabled={isGenerating}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase bg-accent-primary/10 text-accent-glow hover:bg-accent-primary/20 transition-all disabled:opacity-50"
                          title="Generer PDF"
                        >
                          {isGenerating ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <FileOutput className="w-3 h-3" />
                          )}
                          PDF
                        </button>
                        <button
                          onClick={() =>
                            handleDownload(doc.modulepart, doc.ref)
                          }
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase bg-surface-3/50 text-text-muted hover:text-text-primary hover:bg-surface-3 transition-all"
                          title="Telecharger"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-text-muted text-xs"
                  >
                    Aucun document trouve.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
