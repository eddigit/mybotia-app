// Audit log JSONL append-only pour vault — jamais la valeur en clair, juste KEY + action.

import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const LOG_PATH = process.env.VAULT_AUDIT_LOG ?? "/opt/mybotia/logs/vault-audit.log";

let dirEnsured = false;

async function ensureDir(): Promise<void> {
  if (dirEnsured) return;
  try {
    await mkdir(dirname(LOG_PATH), { recursive: true, mode: 0o750 });
  } catch {
    // best effort
  }
  dirEnsured = true;
}

export type VaultAuditEvent = {
  user: string;
  action:
    | "unlock_ok"
    | "unlock_failed"
    | "unlock_locked_out"
    | "lock"
    | "list"
    | "reveal"
    | "reveal_blocked"
    | "reveal_missing";
  key?: string;
  ok: boolean;
  ip?: string;
};

export async function auditVault(event: VaultAuditEvent): Promise<void> {
  await ensureDir();
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n";
  try {
    await appendFile(LOG_PATH, line, { mode: 0o640 });
  } catch (err) {
    console.error("[vault-audit] append failed", err);
  }
}
