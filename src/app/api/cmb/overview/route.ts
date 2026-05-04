// Bloc 7R-SEC — auth + verrouillage tenant cmb_lux strict.
// Cette route expose des données financières CMB ; elle ne doit JAMAIS
// répondre publiquement.

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

const DRIVE_ROOT = "/opt/mybotia/agents/raphael/workspace/drive-work/cache/BACK UP CIE";

const SOC_FOLDERS: Record<string, { id: number; nom: string; folder: string }> = {
  CMB: { id: 1, nom: "CMB CONSEIL", folder: "1 -CMB CONSEIL" },
  PFD: { id: 8, nom: "Phoenix Funding Development", folder: "2- PHOENIX FUNDING DEVELOPMENT" },
  "DC PHDev": { id: 0, nom: "DC Phoenix Dev", folder: "3- DC PHOENIX DEV" },
  "P Inv": { id: 0, nom: "Phoenix Investment FR SAS", folder: "4- PHOENIX INVESTMENT FR SAS" },
  "P Immo": { id: 0, nom: "Phoenix Immobilière Metropole", folder: "5- PHOENIX IMMOBILIERE METROPOLE " },
};

type Banque = { compte: string; banque: string; year: string; nb: number };

function listBanqueFiles(socFolder: string): Banque[] {
  const out: Banque[] = [];
  const root = path.join(DRIVE_ROOT, socFolder);
  if (!fs.existsSync(root)) return out;

  const compta = path.join(root, "17- COMPTA");
  if (fs.existsSync(compta)) {
    let years: string[] = [];
    try { years = fs.readdirSync(compta); } catch { return out; }
    for (const year of years) {
      if (!/^\d{4}$/.test(year)) continue;
      const bq = path.join(compta, year, "0- BANQUE");
      if (!fs.existsSync(bq)) continue;
      try {
        const files = fs.readdirSync(bq).filter((f) => !f.startsWith("._"));
        const byCompte: Record<string, { banque: string; nb: number }> = {};
        for (const f of files) {
          const m = f.match(/\(ExportBQ\)([A-Z0-9]+)/i);
          const compte = m?.[1] || "MIXTE";
          if (!byCompte[compte]) byCompte[compte] = { banque: "?", nb: 0 };
          byCompte[compte].nb++;
        }
        for (const [compte, d] of Object.entries(byCompte)) {
          let banque = "?";
          if (compte.startsWith("CCLU12") || compte.includes("VISALU") || compte.startsWith("VISA")) banque = "Banque Po";
          else if (compte.startsWith("CCLU") || compte.startsWith("VISA")) banque = "ING";
          out.push({ compte, banque, year, nb: d.nb });
        }
      } catch { /* skip */ }
    }
  }
  return out;
}

function countScans(folder: string): number {
  const root = path.join(DRIVE_ROOT, folder);
  if (!fs.existsSync(root)) return 0;
  let count = 0;
  function walk(dir: string) {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (f.startsWith("._") || f.startsWith(".DS_")) continue;
        const p = path.join(dir, f);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else count++;
      }
    } catch { /* skip */ }
  }
  walk(root);
  return count;
}

export async function GET(request: Request) {
  // Bloc 7R-SEC — auth + tenant guard
  const cockpit = await resolveCockpitTenants(request);
  if (!cockpit.ok) {
    return NextResponse.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
  }
  if (cockpit.slug !== "cmb_lux") {
    return NextResponse.json(
      { error: "Route reservee au tenant cmb_lux" },
      { status: 403, headers: NO_STORE }
    );
  }

  const societes = [];
  for (const [sigle, info] of Object.entries(SOC_FOLDERS)) {
    const banques = listBanqueFiles(info.folder);
    const crmStats: Record<string, { factures_count: number; ca_total: number; documents_count: number; events_count: number }> = {
      PFD: { factures_count: 591, ca_total: 297046.97, documents_count: 1318, events_count: 157 },
    };
    const stats = crmStats[sigle] || { factures_count: 0, ca_total: 0, documents_count: 0, events_count: 0 };
    societes.push({ id: info.id, sigle, nom: info.nom, ...stats, banques });
  }
  return NextResponse.json(
    {
      societes,
      scans_a_classer: {
        bureau: countScans("11- SCAN BUREAU"),
        maunia: countScans("12- SCAN MAUNIA"),
      },
      taches_du_jour: [],
    },
    { headers: NO_STORE }
  );
}
