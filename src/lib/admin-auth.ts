// Bloc 6A — ACL admin : refuser tout user non-superadmin.
// Doctrine : on ne fait pas confiance à la RLS Postgres seule.
// Chaque route /api/admin/* doit appeler `requireSuperadmin()` en premier.

import { getSession } from "./session";

export type AdminAuthResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; status: number; error: string };

export async function requireSuperadmin(): Promise<AdminAuthResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, status: 401, error: "Non authentifie" };
  }
  if (!session.isSuperadmin) {
    return { ok: false, status: 403, error: "Acces admin reserve aux superadmins" };
  }
  return { ok: true, userId: session.userId, email: session.email };
}
