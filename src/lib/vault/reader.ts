// Parser .vault — format bash export: KEY=VALUE, commentaires #, sections `# === NAME ===`.
//
// Lecture seule. Le fichier .vault est chmod 600 root. mybotia-app tourne en
// root (cf systemd unit), donc l'accès direct est permis.
//
// Doctrine : .vault est la source de vérité unique des secrets. Pas de cache —
// la lecture à la demande coûte qq ms et garde le contenu frais après rotation.

import { promises as fs } from "node:fs";

const VAULT_PATH = process.env.VAULT_PATH ?? "/opt/mybotia/secrets/.vault";

export type VaultEntry = {
  key: string;
  value: string;
  /** Commentaire(s) `#` immédiatement au-dessus de la KEY, ou null. */
  comment: string | null;
};

export type VaultSection = {
  name: string;
  entries: VaultEntry[];
};

export type VaultContent = {
  sections: VaultSection[];
  flat: Map<string, string>;
};

const SECTION_RE = /^#\s*===\s*(.+?)\s*===\s*$/;

export async function readVault(): Promise<VaultContent> {
  const raw = await fs.readFile(VAULT_PATH, "utf-8");
  const sections: VaultSection[] = [];
  const flat = new Map<string, string>();
  let current: VaultSection = { name: "Général", entries: [] };
  sections.push(current);
  let pendingComment: string | null = null;

  for (const line of raw.split("\n")) {
    const stripped = line.trim();
    if (!stripped) {
      pendingComment = null;
      continue;
    }
    if (stripped.startsWith("#")) {
      const m = stripped.match(SECTION_RE);
      if (m) {
        current = { name: m[1]!, entries: [] };
        sections.push(current);
        pendingComment = null;
      } else {
        const text = stripped.replace(/^#\s?/, "");
        pendingComment = pendingComment ? `${pendingComment} ${text}` : text;
      }
      continue;
    }
    if (stripped.startsWith("export ")) {
      // strip `export ` prefix
      const noExport = stripped.replace(/^export\s+/, "");
      parseKV(noExport, current, flat, pendingComment);
    } else {
      parseKV(stripped, current, flat, pendingComment);
    }
    pendingComment = null;
  }

  return {
    sections: sections.filter((s) => s.entries.length > 0),
    flat,
  };
}

function parseKV(
  line: string,
  current: VaultSection,
  flat: Map<string, string>,
  comment: string | null,
): void {
  const eq = line.indexOf("=");
  if (eq <= 0) return;
  const key = line.slice(0, eq).trim();
  let value = line.slice(eq + 1).trim();
  // unquote single or double if balanced
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      value = value.slice(1, -1);
    }
  }
  current.entries.push({ key, value, comment });
  flat.set(key, value);
}
