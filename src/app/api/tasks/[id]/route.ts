// Bloc 5G — /api/tasks/[id] verrouillé sur le cockpit hostname.
// PATCH (whitelist) + DELETE. Le tenant est résolu par hostname,
// le tenant_slug body/query est ignoré côté ACL (5G doctrine).

import { deleteTask, updateTask } from "@/lib/dolibarr";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

const ALLOWED_FIELDS = new Set([
  "label",
  "description",
  "priority",
  "progress",
  "date_end",
  "date_start",
  "fk_project",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !/^\d+$/.test(id)) {
      return Response.json({ error: "id tache invalide" }, { status: 400, headers: NO_STORE });
    }

    const featureCheck = await requireFeature(request, "tasks");
    if (!featureCheck.ok) return featureCheck.response;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }

    const rawBody = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    const patch: Record<string, unknown> = {};
    if (rawBody) {
      for (const [k, v] of Object.entries(rawBody)) {
        if (!ALLOWED_FIELDS.has(k)) continue;
        if (v === undefined || v === null) continue;
        patch[k] = v;
      }
    }

    if (Object.keys(patch).length === 0) {
      return Response.json(
        { error: "aucun champ valide a mettre a jour" },
        { status: 400, headers: NO_STORE }
      );
    }

    await updateTask(id, patch, cockpit.tenant);
    return Response.json(
      { ok: true, id, tenant_slug: cockpit.slug, applied: Object.keys(patch) },
      { headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502, headers: NO_STORE }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !/^\d+$/.test(id)) {
      return Response.json({ error: "id tache invalide" }, { status: 400, headers: NO_STORE });
    }

    const featureCheck = await requireFeature(request, "tasks");
    if (!featureCheck.ok) return featureCheck.response;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }

    await request.json().catch(() => null);

    await deleteTask(id, cockpit.tenant);
    return Response.json(
      { ok: true, id, tenant_slug: cockpit.slug },
      { headers: NO_STORE }
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502, headers: NO_STORE }
    );
  }
}
