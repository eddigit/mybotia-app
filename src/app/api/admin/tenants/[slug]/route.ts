// Bloc 6A — API admin tenant : détail + édition légère.
//   GET   : tenant + settings + branding + counts.
//   PATCH : modifier features (whitelist) ou business_model (objet libre).
//
// ACL : superadmin uniquement.

import { adminQuery } from "@/lib/admin-db";
import { requireSuperadmin } from "@/lib/admin-auth";
import { invalidateCockpitFeatures } from "@/lib/tenant-features";
import {
  FEATURE_KEYS,
  INTERFACE_MODES,
  PRIMARY_APP_TYPES,
  type AdminTenantRow,
  type FeatureKey,
  type TenantBusinessModel,
  type TenantFeatures,
  type TenantArchitectureConfig,
  type InterfaceMode,
  type PrimaryAppType,
} from "@/lib/tenant-admin-config";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

async function loadTenant(slug: string): Promise<AdminTenantRow | null> {
  const rows = await adminQuery<{
    id: string;
    slug: string;
    display_name: string;
    profile: string;
    status: string;
    legal_name: string | null;
    features: TenantFeatures | null;
    business_model: TenantBusinessModel | null;
    architecture_config: TenantArchitectureConfig | null;
    quota_users: number | null;
    quota_storage_mb: number | null;
    quota_llm_tokens_daily: number | null;
    locale: string | null;
    timezone: string | null;
    updated_at: string | null;
    user_count: string;
  }>(
    `SELECT
       t.id, t.slug, t.display_name, t.profile, t.status,
       b.legal_name,
       COALESCE(s.features, '{}'::jsonb) AS features,
       s.business_model,
       s.architecture_config,
       s.quota_users, s.quota_storage_mb, s.quota_llm_tokens_daily,
       s.locale, s.timezone,
       to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
       (SELECT COUNT(*) FROM core.tenant_user tu WHERE tu.tenant_id = t.id) AS user_count
     FROM core.tenant t
     LEFT JOIN core.tenant_settings s ON s.tenant_id = t.id
     LEFT JOIN core.tenant_branding b ON b.tenant_id = t.id
     WHERE t.slug = $1`,
    [slug]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    slug: r.slug,
    displayName: r.display_name,
    profile: r.profile,
    status: r.status,
    legalName: r.legal_name,
    features: r.features || {},
    businessModel: r.business_model,
    architectureConfig: r.architecture_config,
    quotaUsers: r.quota_users,
    quotaStorageMb: r.quota_storage_mb,
    quotaLlmTokensDaily: r.quota_llm_tokens_daily,
    locale: r.locale,
    timezone: r.timezone,
    updatedAt: r.updated_at,
    userCount: Number(r.user_count) || 0,
  };
}

// Bloc 7A — validation architecture_config (forward-compat sur clés modules).
function validateArchitectureConfig(input: unknown): { ok: true; value: TenantArchitectureConfig | null } | { ok: false; error: string } {
  if (input === null) return { ok: true, value: null };
  if (typeof input !== "object" || Array.isArray(input))
    return { ok: false, error: "architecture_config doit etre un objet ou null" };
  const o = input as Record<string, unknown>;
  if (typeof o.interfaceMode !== "string" || !INTERFACE_MODES.includes(o.interfaceMode as InterfaceMode))
    return { ok: false, error: `interfaceMode invalide (allowed: ${INTERFACE_MODES.join(", ")})` };
  if (!o.primaryApp || typeof o.primaryApp !== "object")
    return { ok: false, error: "primaryApp requis" };
  const pa = o.primaryApp as Record<string, unknown>;
  if (typeof pa.type !== "string" || !PRIMARY_APP_TYPES.includes(pa.type as PrimaryAppType))
    return { ok: false, error: `primaryApp.type invalide (allowed: ${PRIMARY_APP_TYPES.join(", ")})` };
  if (pa.label !== undefined && pa.label !== null && typeof pa.label !== "string")
    return { ok: false, error: "primaryApp.label doit etre une chaine ou null" };
  if (pa.url !== undefined && pa.url !== null && typeof pa.url !== "string")
    return { ok: false, error: "primaryApp.url doit etre une chaine ou null" };
  if (o.standardModules !== undefined && (typeof o.standardModules !== "object" || Array.isArray(o.standardModules)))
    return { ok: false, error: "standardModules doit etre un objet" };
  if (o.verticalModules !== undefined && (typeof o.verticalModules !== "object" || Array.isArray(o.verticalModules)))
    return { ok: false, error: "verticalModules doit etre un objet" };
  if (o.customModules !== undefined && (typeof o.customModules !== "object" || Array.isArray(o.customModules)))
    return { ok: false, error: "customModules doit etre un objet" };
  return { ok: true, value: input as TenantArchitectureConfig };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { slug } = await params;
  try {
    const tenant = await loadTenant(slug);
    if (!tenant) {
      return Response.json({ error: "tenant inconnu" }, { status: 404, headers: NO_STORE });
    }
    return Response.json({ tenant }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "body json invalide" }, { status: 400, headers: NO_STORE });
  }

  const updates: {
    features?: TenantFeatures;
    business_model?: TenantBusinessModel;
    architecture_config?: TenantArchitectureConfig | null;
  } = {};

  if ("features" in body) {
    const f = body.features;
    if (!f || typeof f !== "object" || Array.isArray(f)) {
      return Response.json(
        { error: "features doit etre un objet" },
        { status: 400, headers: NO_STORE }
      );
    }
    const cleaned: TenantFeatures = {};
    for (const k of FEATURE_KEYS) {
      const v = (f as Record<string, unknown>)[k];
      if (typeof v === "boolean") cleaned[k as FeatureKey] = v;
    }
    if (Object.keys(cleaned).length === 0) {
      return Response.json(
        { error: `aucune feature reconnue (allowed: ${FEATURE_KEYS.join(", ")})` },
        { status: 400, headers: NO_STORE }
      );
    }
    updates.features = cleaned;
  }

  if ("business_model" in body) {
    const bm = body.business_model;
    if (bm !== null && (typeof bm !== "object" || Array.isArray(bm))) {
      return Response.json(
        { error: "business_model doit etre un objet ou null" },
        { status: 400, headers: NO_STORE }
      );
    }
    updates.business_model = bm as TenantBusinessModel;
  }

  // Bloc 7A — architecture_config
  if ("architecture_config" in body) {
    const v = validateArchitectureConfig(body.architecture_config);
    if (!v.ok) {
      return Response.json({ error: v.error }, { status: 400, headers: NO_STORE });
    }
    updates.architecture_config = v.value;
  }

  if (!updates.features && !("business_model" in updates) && !("architecture_config" in updates)) {
    return Response.json(
      { error: "rien a modifier (champs autorises: features, business_model, architecture_config)" },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    const tenantRows = await adminQuery<{ id: string }>(
      "SELECT id FROM core.tenant WHERE slug = $1",
      [slug]
    );
    if (!tenantRows[0]) {
      return Response.json({ error: "tenant inconnu" }, { status: 404, headers: NO_STORE });
    }
    const tenantId = tenantRows[0].id;

    const sets: string[] = [];
    const args: unknown[] = [];
    if (updates.features) {
      args.push(JSON.stringify(updates.features));
      sets.push(`features = COALESCE(features, '{}'::jsonb) || $${args.length}::jsonb`);
    }
    if ("business_model" in updates) {
      if (updates.business_model === null) {
        sets.push(`business_model = NULL`);
      } else {
        args.push(JSON.stringify(updates.business_model));
        sets.push(`business_model = $${args.length}::jsonb`);
      }
    }
    if ("architecture_config" in updates) {
      if (updates.architecture_config === null) {
        sets.push(`architecture_config = NULL`);
      } else {
        args.push(JSON.stringify(updates.architecture_config));
        sets.push(`architecture_config = $${args.length}::jsonb`);
      }
    }

    args.push(tenantId);
    await adminQuery(
      `UPDATE core.tenant_settings SET ${sets.join(", ")} WHERE tenant_id = $${args.length}`,
      args
    );

    // Bloc 6B — invalider le cache features pour propager le changement
    invalidateCockpitFeatures(slug);

    const tenant = await loadTenant(slug);
    return Response.json({ ok: true, tenant }, { headers: NO_STORE });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur DB" },
      { status: 502, headers: NO_STORE }
    );
  }
}
