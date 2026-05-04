// Bloc 5G — /api/projects verrouillé sur le cockpit hostname.
// Pas d'agrégation multi-tenant. POST écrit dans le tenant cockpit.

import {
  getProjects,
  getThirdParties,
  createProject,
  validateProject,
} from "@/lib/dolibarr";
import { mapDolibarrProject } from "@/lib/mappers";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET(request: Request) {
  try {
    // Bloc 6B — pipeline = lecture des projets (deals + projects). Aussi gate "tasks"
    // pourrait fonctionner ici, mais "pipeline" est le module conceptuel.
    const featureCheck = await requireFeature(request, "pipeline");
    if (!featureCheck.ok) return featureCheck.response;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const { tenant, slug: tenantSlug } = cockpit;

    const [tps, projects] = await Promise.all([
      getThirdParties(100, tenant).catch(() => []),
      getProjects(100, tenant).catch(() => []),
    ]);

    const clientNameById: Record<string, string> = {};
    for (const t of tps) clientNameById[t.id] = t.name_alias || t.name;

    const mapped = projects.map((dp, i) =>
      mapDolibarrProject(dp, i, clientNameById[dp.socid], tenantSlug)
    );

    return Response.json(mapped, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502, headers: NO_STORE }
    );
  }
}

export async function POST(request: Request) {
  try {
    const featureCheck = await requireFeature(request, "pipeline");
    if (!featureCheck.ok) return featureCheck.response;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }
    const { tenant } = cockpit;

    const body = await request.json();
    if (!body.title || !body.ref) {
      return Response.json(
        { error: "title et ref sont requis" },
        { status: 400, headers: NO_STORE }
      );
    }

    const newId = await createProject(
      {
        ref: body.ref,
        title: body.title,
        socid: body.socid || "",
        description: body.description || "",
        date_start: body.date_start || "",
        date_end: body.date_end || "",
        budget_amount: body.budget_amount || "",
        usage_task: 1,
        usage_opportunity: body.opp_amount ? 1 : 0,
        opp_amount: body.opp_amount || "",
        opp_percent: body.opp_percent || "",
      },
      tenant
    );

    try {
      await validateProject(String(newId), tenant);
    } catch {
      // créé mais non validé
    }

    return Response.json(
      { id: newId, tenant_slug: cockpit.slug },
      { status: 201, headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur creation projet" },
      { status: 502, headers: NO_STORE }
    );
  }
}
