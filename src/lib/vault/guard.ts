// Garde commun : seul gilleskorzec@gmail.com peut consulter le vault.
// Plus strict que requireSuperadmin (qui autorise tout super-admin).

import { getSession } from "../session";

export const VAULT_OWNER_EMAIL = "gilleskorzec@gmail.com";

export type VaultGuardResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; status: number; error: string };

export async function requireVaultOwner(): Promise<VaultGuardResult> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401, error: "unauthorized" };
  if (session.email !== VAULT_OWNER_EMAIL) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true, userId: session.userId, email: session.email };
}

/** Clés du vault qu'on ne révèle JAMAIS via l'API (auto-protection). */
export const HIDDEN_KEYS = new Set<string>([
  "VAULT_ADMIN_PIN_HASH",
  "VAULT_SESSION_SECRET",
]);
