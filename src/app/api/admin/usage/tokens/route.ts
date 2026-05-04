// Bloc 6F — API admin globale : usage tokens par tenant (mois courant).
// Superadmin only.

import { requireSuperadmin } from "@/lib/admin-auth";
import { getAllTenantsTokenSummary } from "@/lib/token-usage";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET() {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const summaries = await getAllTenantsTokenSummary();
  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      tenants: summaries,
    },
    { headers: NO_STORE }
  );
}
