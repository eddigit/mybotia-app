"use client";

type Props = { scansBureau: number; scansMaunia: number };

export default function QuickActions({ scansBureau, scansMaunia }: Props) {
  const totalScans = scansBureau + scansMaunia;

  function suggest(prompt: string) {
    window.dispatchEvent(new CustomEvent("raphael-suggest", { detail: { prompt } }));
  }

  return (
    <section className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wide">
          Actions rapides
        </h2>
        {totalScans > 0 && (
          <span className="text-xs text-amber-300 bg-amber-900/30 px-2 py-0.5 rounded">
            {totalScans} scan{totalScans > 1 ? "s" : ""} à classer
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <button
          onClick={() => suggest("Donne-moi un état rapide : factures impayées par société (ordre décroissant), avec date de la plus ancienne.")}
          className="text-left text-sm bg-slate-700/40 hover:bg-slate-700/70 rounded-md px-3 py-2 text-slate-200"
        >
          Factures impayées
        </button>
        <button
          onClick={() => suggest(`Liste les nouveaux scans dans 11- SCAN BUREAU et 12- SCAN MAUNIA (${totalScans} fichiers). Pour chaque non encore classé, propose-moi un nom et une destination selon la nomenclature.`)}
          className="text-left text-sm bg-slate-700/40 hover:bg-slate-700/70 rounded-md px-3 py-2 text-slate-200"
        >
          Classer scans ({totalScans})
        </button>
        <button
          onClick={() => suggest("Propose-moi un état de réconciliation bancaire pour PFD sur les comptes ING et Banque Populaire 2024-2026 : combien d'extraits as-tu, quelles sont les couvertures par mois ?")}
          className="text-left text-sm bg-slate-700/40 hover:bg-slate-700/70 rounded-md px-3 py-2 text-slate-200"
        >
          État réconciliation banque
        </button>
        <button
          onClick={() => suggest("Quelles sont les échéances corporate (AG, dépôts RCS, déclarations fiscales) à venir dans les 30 jours pour mes sociétés ?")}
          className="text-left text-sm bg-slate-700/40 hover:bg-slate-700/70 rounded-md px-3 py-2 text-slate-200"
        >
          Échéances 30j
        </button>
        <button
          onClick={() => suggest("Rédige-moi un brouillon de mail pour relancer un client. Demande-moi : quel client, quelle facture, quel ton.")}
          className="text-left text-sm bg-slate-700/40 hover:bg-slate-700/70 rounded-md px-3 py-2 text-slate-200"
        >
          Rédiger un mail
        </button>
        <button
          onClick={() => suggest("Donne-moi un récap rapide en 5 lignes : où en est le dossier IDN INVESTMENT après la fusion vers PFD ?")}
          className="text-left text-sm bg-slate-700/40 hover:bg-slate-700/70 rounded-md px-3 py-2 text-slate-200"
        >
          Récap fusion IDN→PFD
        </button>
      </div>
    </section>
  );
}
