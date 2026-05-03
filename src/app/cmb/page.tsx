"use client";

import { useEffect, useState } from "react";
import SocietyCard from "@/components/cmb/SocietyCard";
import RaphaelInlineChat from "@/components/cmb/RaphaelInlineChat";
import QuickActions from "@/components/cmb/QuickActions";

type SocietyOverview = {
  id: number;
  sigle: string;
  nom: string;
  factures_count: number;
  ca_total: number;
  documents_count: number;
  events_count: number;
  banques: { compte: string; banque: string; year: string; nb: number }[];
};

type Overview = {
  societes: SocietyOverview[];
  scans_a_classer: { bureau: number; maunia: number };
  taches_du_jour: { id: number; title: string; due?: string }[];
};

export default function CmbDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/cmb/overview", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: Overview) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-slate-400">Chargement du tableau de bord…</div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-rose-400">
        Impossible de charger : {error || "données manquantes"}
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <header className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-slate-100">
            Tableau de bord — CMB Conseil
          </h1>
          <div className="text-sm text-slate-400">
            {data.societes.length} société{data.societes.length > 1 ? "s" : ""} suivie
            {data.societes.length > 1 ? "s" : ""}
          </div>
        </header>

        <QuickActions
          scansBureau={data.scans_a_classer.bureau}
          scansMaunia={data.scans_a_classer.maunia}
        />

        <section>
          <h2 className="text-lg font-medium text-slate-200 mb-3">Sociétés</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.societes.map((s) => (
              <SocietyCard key={s.id + "-" + s.sigle} society={s} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-medium text-slate-200 mb-3">
            Tâches du jour
          </h2>
          {data.taches_du_jour.length === 0 ? (
            <div className="text-sm text-slate-500 italic">
              Aucune tâche pour aujourd'hui.
            </div>
          ) : (
            <ul className="space-y-2">
              {data.taches_du_jour.map((t) => (
                <li
                  key={t.id}
                  className="bg-slate-800/50 rounded-md p-3 text-sm text-slate-200 flex justify-between"
                >
                  <span>{t.title}</span>
                  {t.due && <span className="text-slate-400">{t.due}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="w-[420px] border-l border-slate-700/40 flex flex-col">
        <RaphaelInlineChat
          contextHint={`Dashboard Narjis CMB Conseil. Sociétés suivies : ${data.societes
            .map((s) => s.sigle)
            .join(", ")}. ${data.scans_a_classer.bureau + data.scans_a_classer.maunia} scans à classer.`}
        />
      </aside>
    </div>
  );
}
