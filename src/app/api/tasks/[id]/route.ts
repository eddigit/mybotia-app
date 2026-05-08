// Bloc 5G — /api/tasks/[id] verrouillé sur le cockpit hostname.
// PATCH (whitelist) + DELETE. Le tenant est résolu par hostname,
// le tenant_slug body/query est ignoré côté ACL (5G doctrine).

import { deleteTask, updateTask } from "@/lib/dolibarr";
import { resolveCockpitTenants } from "@/lib/tenant-resolver";
import { requireFeature } from "@/lib/tenant-features";
import {
  getCrmProvider,
  CrmRouterError,
  crmRouterErrorResponse,
} from "@/lib/crm-router";
import { businessSendJson, BusinessClientError } from "@/lib/business-client";
import {
  mapInputTaskFromUi,
  isEmptyInput,
} from "@/lib/business-mappers";

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
    if (!id) {
      return Response.json({ error: "id tache invalide" }, { status: 400, headers: NO_STORE });
    }

    const featureCheck = await requireFeature(request, "tasks");
    if (!featureCheck.ok) return featureCheck.response;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }

    const provider = await getCrmProvider(cockpit.slug);
    const rawBody = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    if (provider.kind === "mybotia_business") {
      // V1.1.B Phase 2 A2 — branche business avec mapping Dolibarr→business.
      if (!rawBody || typeof rawBody !== "object") {
        return Response.json({ error: "body json invalide" }, { status: 400, headers: NO_STORE });
      }
      const input = mapInputTaskFromUi(rawBody);
      if (isEmptyInput(input as Record<string, unknown>)) {
        return Response.json(
          {
            error: "no_supported_fields",
            hint: "supported business fields: title, description, projectId, dueDate, status",
          },
          { status: 400, headers: NO_STORE },
        );
      }
      // Si seul `status` est fourni → PATCH partiel business ; sinon PUT complet.
      const onlyStatus =
        Object.keys(input).length === 1 && typeof input.status === "string";
      const method = onlyStatus ? "PATCH" : "PUT";
      const updated = await businessSendJson<{ id: string; status: string }>(
        method,
        `/api/v1/tasks/${encodeURIComponent(id)}`,
        input,
        {
          tenantId: provider.tenantId,
          tenantSlug: cockpit.slug,
          scopes: ["crm:read", "crm:write"],
        },
      );
      return Response.json(
        { ok: true, id: updated.id, tenant_slug: cockpit.slug, applied: Object.keys(input) },
        { headers: NO_STORE },
      );
    }

    if (provider.kind === "external") {
      return Response.json(
        { error: "crm_provider_not_configured", tenant: cockpit.slug },
        { status: 501, headers: NO_STORE },
      );
    }

    // dolibarr (legacy) — id numérique obligatoire
    if (!/^\d+$/.test(id)) {
      return Response.json({ error: "id tache invalide" }, { status: 400, headers: NO_STORE });
    }

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
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
    }
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
    if (!id) {
      return Response.json({ error: "id tache invalide" }, { status: 400, headers: NO_STORE });
    }

    const featureCheck = await requireFeature(request, "tasks");
    if (!featureCheck.ok) return featureCheck.response;

    const cockpit = await resolveCockpitTenants(request);
    if (!cockpit.ok) {
      return Response.json({ error: cockpit.error }, { status: cockpit.status, headers: NO_STORE });
    }

    const provider = await getCrmProvider(cockpit.slug);

    if (provider.kind === "mybotia_business") {
      await request.json().catch(() => null);
      const out = await businessSendJson<{ id: string; deleted: boolean }>(
        "DELETE",
        `/api/v1/tasks/${encodeURIComponent(id)}`,
        undefined,
        {
          tenantId: provider.tenantId,
          tenantSlug: cockpit.slug,
          scopes: ["crm:read", "crm:write"],
        },
      );
      return Response.json(
        { ok: true, id: out.id, tenant_slug: cockpit.slug },
        { headers: NO_STORE },
      );
    }

    if (provider.kind === "external") {
      return Response.json(
        { error: "crm_provider_not_configured", tenant: cockpit.slug },
        { status: 501, headers: NO_STORE },
      );
    }

    // dolibarr (legacy) — id numérique obligatoire
    if (!/^\d+$/.test(id)) {
      return Response.json({ error: "id tache invalide" }, { status: 400, headers: NO_STORE });
    }

    await request.json().catch(() => null);

    await deleteTask(id, cockpit.tenant);
    return Response.json(
      { ok: true, id, tenant_slug: cockpit.slug },
      { headers: NO_STORE }
    );
  } catch (e) {
    if (e instanceof CrmRouterError) return crmRouterErrorResponse(e);
    if (e instanceof BusinessClientError) {
      return Response.json(
        { error: e.code, message: e.message },
        { status: e.status, headers: NO_STORE },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur Dolibarr" },
      { status: 502, headers: NO_STORE }
    );
  }
}
