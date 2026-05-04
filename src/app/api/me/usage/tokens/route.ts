// Bloc 6F — API client : usage tokens du tenant courant (résolu hostname).
// Auth requis. Pas réservé superadmin.

import { getSession } from "@/lib/session";
import { resolveCockpitTenant } from "@/lib/tenant-resolver";
import { getTokenUsageSummary, getTokenUsageDaily } from "@/lib/token-usage";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Non authentifie" }, { status: 401, headers: NO_STORE });
  }
  const cockpit = resolveCockpitTenant(request);
  // Vérifier que le user a accès au cockpit (sauf superadmin)
  if (!session.isSuperadmin && cockpit.slug !== session.tenantSlug) {
    return Response.json(
      { error: "tenant_slug non autorise pour cet utilisateur" },
      { status: 403, headers: NO_STORE }
    );
  }
  const [summary, daily] = await Promise.all([
    getTokenUsageSummary(cockpit.slug),
    getTokenUsageDaily(cockpit.slug, 30),
  ]);
  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      summary,
      daily,
    },
    { headers: NO_STORE }
  );
}
