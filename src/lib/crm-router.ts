// V1.1.B Phase 1 — CRM router.
//
// Lit `core.tenant_settings.architecture_config` (JSONB) pour décider quel
// provider sert les lectures CRM d'un tenant donné. Cache mémoire 30s pour
// éviter un hit DB par requête (même pattern que `tenant-features.ts`).
//
// Validation zod stricte : `crm_provider` ∈ { mybotia_business, dolibarr,
// external }. Tout schéma invalide → erreur explicite, jamais silent
// fallback.
//
// Phase 1 = LECTURE SEULE. Phase 2 ajoutera mutations + scopes write.
//
// Usage côté route Next.js :
//   const provider = await getCrmProvider(tenantSlug);
//   if (provider.kind === "mybotia_business") {
//     const list = await businessGetJson<Client[]>("/api/v1/clients", { ... });
//   } else if (provider.kind === "dolibarr") {
//     const list = await getThirdParties(100, dolibarrCfg);
//   } else {
//     throw new CrmRouterError(501, "crm_provider_not_configured", ...);
//   }

import { z } from "zod";

import { adminQuery } from "./admin-db";

const CACHE_TTL_MS = 30_000;

const CrmProviderConfigSchema = z
  .object({
    crm_provider: z.enum(["mybotia_business", "dolibarr", "external"]),
    crm_provider_config: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type CrmProviderKind = z.infer<typeof CrmProviderConfigSchema>["crm_provider"];

type ResolutionBase = {
  tenantId: string;
  tenantSlug: string;
};

export type CrmProviderResolution = ResolutionBase &
  (
    | {
        kind: "mybotia_business";
        config: {
          url: string;
          api_version: string;
        };
      }
    | { kind: "dolibarr" }
    | {
        kind: "external";
        config: { status: string };
      }
  );

export class CrmRouterError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CrmRouterError";
  }
}

type CacheEntry = { resolution: CrmProviderResolution; loadedAt: number };
const cache = new Map<string, CacheEntry>();

async function loadFromDb(slug: string): Promise<CrmProviderResolution> {
  const rows = await adminQuery<{ tenant_id: string; architecture_config: unknown }>(
    `SELECT t.id AS tenant_id, s.architecture_config
     FROM core.tenant t
     JOIN core.tenant_settings s ON s.tenant_id = t.id
     WHERE t.slug = $1`,
    [slug],
  );

  if (rows.length === 0) {
    throw new CrmRouterError(
      404,
      "tenant_unknown",
      `Tenant '${slug}' introuvable dans core.tenant`,
    );
  }

  const tenantId = rows[0].tenant_id;
  const raw = rows[0].architecture_config;
  if (raw === null || raw === undefined) {
    throw new CrmRouterError(
      501,
      "crm_provider_not_configured",
      `Tenant '${slug}' n'a pas de architecture_config (V1.1.B requis)`,
    );
  }

  const parsed = CrmProviderConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CrmRouterError(
      500,
      "crm_provider_config_invalid",
      `Tenant '${slug}' architecture_config invalide`,
    );
  }

  const cfg = parsed.data;
  const base: ResolutionBase = { tenantId, tenantSlug: slug };

  if (cfg.crm_provider === "mybotia_business") {
    const sub = cfg.crm_provider_config ?? {};
    const url = typeof sub.url === "string" ? sub.url : "";
    const api_version = typeof sub.api_version === "string" ? sub.api_version : "v1";
    if (!url) {
      throw new CrmRouterError(
        500,
        "crm_provider_config_invalid",
        `Tenant '${slug}' provider=mybotia_business sans url`,
      );
    }
    return { ...base, kind: "mybotia_business", config: { url, api_version } };
  }

  if (cfg.crm_provider === "dolibarr") {
    return { ...base, kind: "dolibarr" };
  }

  // external
  const status =
    cfg.crm_provider_config &&
    typeof cfg.crm_provider_config === "object" &&
    typeof (cfg.crm_provider_config as { status?: unknown }).status === "string"
      ? ((cfg.crm_provider_config as { status: string }).status)
      : "unknown";
  return { ...base, kind: "external", config: { status } };
}

/**
 * Résout le provider CRM pour un tenant. Cache 30s. Erreurs explicites
 * (jamais de silent fallback Dolibarr).
 */
export async function getCrmProvider(tenantSlug: string): Promise<CrmProviderResolution> {
  const cached = cache.get(tenantSlug);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.resolution;
  }
  const resolution = await loadFromDb(tenantSlug);
  cache.set(tenantSlug, { resolution, loadedAt: Date.now() });
  return resolution;
}

export function invalidateCrmProvider(slug?: string): void {
  if (slug) cache.delete(slug);
  else cache.clear();
}

/**
 * Helper Response : transforme `CrmRouterError` en réponse HTTP normalisée.
 * Les routes Next.js peuvent l'utiliser via `if (e instanceof CrmRouterError)`.
 */
export function crmRouterErrorResponse(err: CrmRouterError): Response {
  return Response.json(
    {
      error: err.code,
      message: err.message,
    },
    {
      status: err.status,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    },
  );
}
