// Bloc 6F — API admin détail tenant : 30 derniers jours d'usage.
// Superadmin only.

import { requireSuperadmin } from "@/lib/admin-auth";
import { getTokenUsageDaily, getTokenUsageSummary } from "@/lib/token-usage";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { slug } = await params;
  const [summary, daily] = await Promise.all([
    getTokenUsageSummary(slug),
    getTokenUsageDaily(slug, 30),
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
