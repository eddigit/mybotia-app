// Bloc 7E — Garde d'accès au vertical VL Medical (page client /vlm + APIs /api/vlm/*).
// Doctrine :
//   - Superadmin : toujours autorisé.
//   - Sinon : session.tenantSlug doit être 'vlmedical'.
//   - Le hostname est utilisé comme indication, pas comme autorité unique
//     (un superadmin sur app.mybotia.com peut consulter /vlm en debug).

import { getSession } from "./session";

export const VLM_SLUG = "vlmedical";

export type VlmAccessResult =
  | { ok: true; userId: string; email: string; tenantSlug: string; isSuperadmin: boolean }
  | { ok: false; status: number; error: string };

export async function requireVlmAccess(): Promise<VlmAccessResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, status: 401, error: "Non authentifie" };
  }
  if (!session.isSuperadmin && session.tenantSlug !== VLM_SLUG) {
    return {
      ok: false,
      status: 403,
      error: "Module VL Medical reserve aux utilisateurs vlmedical (ou superadmin)",
    };
  }
  return {
    ok: true,
    userId: session.userId,
    email: session.email,
    tenantSlug: session.tenantSlug,
    isSuperadmin: session.isSuperadmin,
  };
}
