"use client";

import Link from "next/link";

type Banque = { compte: string; banque: string; year: string; nb: number };

type Society = {
  id: number;
  sigle: string;
  nom: string;
  factures_count: number;
  ca_total: number;
  documents_count: number;
  events_count: number;
  banques: Banque[];
};

function formatEur(v: number): string {
  if (!v) return "0 €";
  return v.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default function SocietyCard({ society }: { society: Society }) {
  const banquesByCompte = society.banques.reduce<
    Record<string, { banque: string; total: number; years: string[] }>
  >((acc, b) => {
    if (!acc[b.compte]) {
      acc[b.compte] = { banque: b.banque, total: 0, years: [] };
    }
    acc[b.compte].total += b.nb;
    if (!acc[b.compte].years.includes(b.year)) {
      acc[b.compte].years.push(b.year);
    }
    return acc;
  }, {});

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-4 hover:border-slate-600 transition">
      <div className="flex items-baseline justify-between mb-3">
        <Link
          href={society.id ? `/crm/${society.id}` : "/crm"}
          className="text-base font-semibold text-slate-100 hover:text-blue-300"
        >
          {society.nom}
        </Link>
        <span className="text-xs text-slate-400">{society.sigle}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <div className="text-slate-400 text-xs">Factures</div>
          <div className="text-slate-200">{society.factures_count}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">CA total</div>
          <div className="text-slate-200">{formatEur(society.ca_total)}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">Documents</div>
          <div className="text-slate-200">{society.documents_count}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">Événements</div>
          <div className="text-slate-200">{society.events_count}</div>
        </div>
      </div>

      {Object.keys(banquesByCompte).length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/30">
          <div className="text-slate-400 text-xs mb-2">Banques</div>
          <ul className="space-y-1">
            {Object.entries(banquesByCompte).map(([compte, d]) => (
              <li key={compte} className="text-xs text-slate-300 flex justify-between">
                <span>
                  {d.banque} <span className="text-slate-500">·</span>{" "}
                  <span className="font-mono">{compte}</span>
                </span>
                <span className="text-slate-400">
                  {d.total} fichier{d.total > 1 ? "s" : ""}{" "}
                  <span className="text-slate-500">
                    ({d.years.sort().join(", ")})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
