// Bloc 6A — API admin tenant : détail + édition légère.
//   GET   : tenant + settings + branding + counts.
//   PATCH : modifier features (whitelist) ou business_model (objet libre)
//           ou branding (core.tenant_branding).
//
// Bloc V1.1.I-A — branding éditable : PATCH { branding: {...} }
//   Champs éditables : identité légale, coordonnées, bancaire,
//   branding visuel, documents / numérotation.
//   Tous les champs sont optionnels (PATCH partiel). Un champ absent
//   ne reset pas la valeur existante. Un champ explicitement null
//   est écrit tel quel si la colonne l'accepte.
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

// ---------------------------------------------------------------------------
// Bloc V1.1.I-A — type BrandingPatch
// Sous-ensemble éditable de core.tenant_branding (PATCH partiel).
// ---------------------------------------------------------------------------
type BrandingPatch = {
  // Identité légale
  legal_name?: string | null;
  legal_form?: string | null;
  siret?: string | null;
  ape_code?: string | null;
  tva_intra?: string | null;
  capital_social?: string | null;
  rcs_city?: string | null;
  // Coordonnées
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  // Bancaire
  bank_name?: string | null;
  iban?: string | null;
  bic?: string | null;
  // Branding visuel
  logo_url?: string | null;
  logo_small_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  // Documents / numérotation
  footer_html?: string | null;
  cgv_text?: string | null;
  default_tva_rate?: number | null;
  payment_terms_days?: number | null;
  late_fees_rate?: number | null;
  quote_prefix?: string | null;
  invoice_prefix?: string | null;
};

const BRANDING_STRING_COLS = [
  "legal_name", "legal_form", "siret", "ape_code", "tva_intra",
  "capital_social", "rcs_city",
  "address_line1", "address_line2", "postal_code", "city", "country",
  "phone", "email", "website",
  "bank_name", "iban", "bic",
  "logo_url", "logo_small_url",
  "primary_color", "secondary_color", "accent_color",
  "footer_html", "cgv_text",
  "quote_prefix", "invoice_prefix",
] as const;

const BRANDING_NUMERIC_COLS = [
  "default_tva_rate",
  "payment_terms_days",
  "late_fees_rate",
] as const;

function parseBrandingPatch(input: unknown): { ok: true; value: BrandingPatch } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "branding doit etre un objet" };
  }
  const src = input as Record<string, unknown>;
  const patch: BrandingPatch = {};

  for (const col of BRANDING_STRING_COLS) {
    if (!(col in src)) continue;
    const v = src[col];
    if (v === null) {
      (patch as Record<string, unknown>)[col] = null;
    } else if (typeof v === "string") {
      (patch as Record<string, unknown>)[col] = v.trim() || null;
    } else {
      return { ok: false, error: `branding.${col} doit etre une chaine ou null` };
    }
  }

  for (const col of BRANDING_NUMERIC_COLS) {
    if (!(col in src)) continue;
    const v = src[col];
    if (v === null) {
      (patch as Record<string, unknown>)[col] = null;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      (patch as Record<string, unknown>)[col] = v;
    } else if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
      (patch as Record<string, unknown>)[col] = Number(v);
    } else {
      return { ok: false, error: `branding.${col} doit etre un nombre ou null` };
    }
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "branding : aucun champ reconnu" };
  }
  return { ok: true, value: patch };
}

// Bloc V1.1.I-A — type BrandingFull retourné dans la réponse GET/PATCH
export type BrandingFull = BrandingPatch & {
  font_family_title?: string | null;
  font_family_body?: string | null;
  quote_next_number?: number | null;
  invoice_next_number?: number | null;
  updated_at?: string | null;
};

async function loadTenant(slug: string): Promise<(AdminTenantRow & { branding: BrandingFull | null }) | null> {
  const rows = await adminQuery<{
    id: string;
    slug: string;
    display_name: string;
    profile: string;
    status: string;
    // branding colonnes individuelles
    legal_name: string | null;
    legal_form: string | null;
    siret: string | null;
    ape_code: string | null;
    tva_intra: string | null;
    capital_social: string | null;
    rcs_city: string | null;
    address_line1: string | null;
    address_line2: string | null;
    postal_code: string | null;
    city: string | null;
    country: string | null;
    phone: string | null;
    b_email: string | null;
    website: string | null;
    bank_name: string | null;
    iban: string | null;
    bic: string | null;
    logo_url: string | null;
    logo_small_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    accent_color: string | null;
    font_family_title: string | null;
    font_family_body: string | null;
    footer_html: string | null;
    cgv_text: string | null;
    default_tva_rate: number | null;
    payment_terms_days: number | null;
    late_fees_rate: number | null;
    quote_prefix: string | null;
    quote_next_number: number | null;
    invoice_prefix: string | null;
    invoice_next_number: number | null;
    branding_updated_at: string | null;
    // settings
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
    modules_enabled: string;
    modules_total: string;
    last_module_activity_at: string | null;
  }>(
    `SELECT
       t.id, t.slug, t.display_name, t.profile, t.status,
       b.legal_name, b.legal_form, b.siret, b.ape_code, b.tva_intra,
       b.capital_social, b.rcs_city,
       b.address_line1, b.address_line2, b.postal_code, b.city, b.country,
       b.phone, b.email AS b_email, b.website,
       b.bank_name, b.iban, b.bic,
       b.logo_url, b.logo_small_url,
       b.primary_color, b.secondary_color, b.accent_color,
       b.font_family_title, b.font_family_body,
       b.footer_html, b.cgv_text,
       b.default_tva_rate, b.payment_terms_days, b.late_fees_rate,
       b.quote_prefix, b.quote_next_number,
       b.invoice_prefix, b.invoice_next_number,
       to_char(b.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS branding_updated_at,
       COALESCE(s.features, '{}'::jsonb) AS features,
       s.business_model,
       s.architecture_config,
       s.quota_users, s.quota_storage_mb, s.quota_llm_tokens_daily,
       s.locale, s.timezone,
       to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
       (SELECT COUNT(*) FROM core.tenant_user tu WHERE tu.tenant_id = t.id) AS user_count,
       (SELECT COUNT(*) FROM core.tenant_modules tm WHERE tm.tenant_id = t.id AND tm.enabled = true) AS modules_enabled,
       (SELECT COUNT(*) FROM core.module_registry) AS modules_total,
       to_char(
         (SELECT MAX(GREATEST(COALESCE(tm.activated_at, 'epoch'::timestamptz), COALESCE(tm.deactivated_at, 'epoch'::timestamptz), tm.updated_at))
            FROM core.tenant_modules tm WHERE tm.tenant_id = t.id) AT TIME ZONE 'UTC',
         'YYYY-MM-DD"T"HH24:MI:SS"Z"'
       ) AS last_module_activity_at
     FROM core.tenant t
     LEFT JOIN core.tenant_settings s ON s.tenant_id = t.id
     LEFT JOIN core.tenant_branding b ON b.tenant_id = t.id
     WHERE t.slug = $1`,
    [slug]
  );
  if (!rows[0]) return null;
  const r = rows[0];

  // Branding est null si la ligne tenant_branding n'existe pas encore
  const hasBranding = r.logo_url !== undefined; // LEFT JOIN : si tout null, on garde quand même l'objet
  const branding: BrandingFull = {
    legal_name: r.legal_name,
    legal_form: r.legal_form,
    siret: r.siret,
    ape_code: r.ape_code,
    tva_intra: r.tva_intra,
    capital_social: r.capital_social,
    rcs_city: r.rcs_city,
    address_line1: r.address_line1,
    address_line2: r.address_line2,
    postal_code: r.postal_code,
    city: r.city,
    country: r.country,
    phone: r.phone,
    email: r.b_email,
    website: r.website,
    bank_name: r.bank_name,
    iban: r.iban,
    bic: r.bic,
    logo_url: r.logo_url,
    logo_small_url: r.logo_small_url,
    primary_color: r.primary_color,
    secondary_color: r.secondary_color,
    accent_color: r.accent_color,
    font_family_title: r.font_family_title,
    font_family_body: r.font_family_body,
    footer_html: r.footer_html,
    cgv_text: r.cgv_text,
    default_tva_rate: r.default_tva_rate,
    payment_terms_days: r.payment_terms_days,
    late_fees_rate: r.late_fees_rate,
    quote_prefix: r.quote_prefix,
    quote_next_number: r.quote_next_number,
    invoice_prefix: r.invoice_prefix,
    invoice_next_number: r.invoice_next_number,
    updated_at: r.branding_updated_at,
  };
  void hasBranding; // used for LEFT JOIN — always include the object

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
    modulesEnabled: Number(r.modules_enabled) || 0,
    modulesTotal: Number(r.modules_total) || 0,
    lastModuleActivityAt: r.last_module_activity_at,
    primaryColor: r.primary_color,
    logoUrl: r.logo_url,
    branding,
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
    branding?: BrandingPatch;
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

  // Bloc V1.1.I-A — branding
  if ("branding" in body) {
    const v = parseBrandingPatch(body.branding);
    if (!v.ok) {
      return Response.json({ error: v.error }, { status: 400, headers: NO_STORE });
    }
    updates.branding = v.value;
  }

  if (
    !updates.features &&
    !("business_model" in updates) &&
    !("architecture_config" in updates) &&
    !updates.branding
  ) {
    return Response.json(
      { error: "rien a modifier (champs autorises: features, business_model, architecture_config, branding)" },
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

    if (sets.length > 0) {
      args.push(tenantId);
      await adminQuery(
        `UPDATE core.tenant_settings SET ${sets.join(", ")} WHERE tenant_id = $${args.length}`,
        args
      );
    }

    // Bloc V1.1.I-A — mise à jour core.tenant_branding (UPSERT partiel)
    if (updates.branding && Object.keys(updates.branding).length > 0) {
      const bPatch = updates.branding as Record<string, unknown>;
      const bCols = Object.keys(bPatch);
      const bArgs: unknown[] = [tenantId];
      const bSets: string[] = [];

      for (const col of bCols) {
        bArgs.push(bPatch[col]);
        bSets.push(`${col} = $${bArgs.length}`);
      }
      bArgs.push(new Date().toISOString());
      bSets.push(`updated_at = $${bArgs.length}`);

      await adminQuery(
        `INSERT INTO core.tenant_branding (tenant_id, ${bCols.join(", ")}, updated_at)
         VALUES ($1, ${bCols.map((_, i) => `$${i + 2}`).join(", ")}, $${bArgs.length})
         ON CONFLICT (tenant_id) DO UPDATE SET ${bSets.join(", ")}`,
        bArgs
      );
    }

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
