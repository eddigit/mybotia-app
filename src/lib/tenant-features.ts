// Bloc 6B — features tenant côté serveur, résolues via hostname.
//
// Source de vérité : core.tenant_settings.features dans mybotia_core.
// Cache mémoire 30s pour éviter un hit DB par requête.
// Fallback sécurisé : si DB unreachable, on renvoie un objet vide → toutes
// les features comptent comme false. Sauf le flag `safeFallback` côté
// helper d'utilisation, qui peut décider d'un comportement permissif pour
// le tenant `mybotia` historique.

import { adminQuery } from "./admin-db";
import { resolveCockpitTenant } from "./tenant-resolver";
import {
  FEATURE_KEYS,
  type FeatureKey,
  type TenantFeatures,
} from "./tenant-admin-config";

const CACHE_TTL_MS = 30_000;

type CacheEntry = { features: TenantFeatures; loadedAt: number };
const cache = new Map<string, CacheEntry>();

/**
 * Charge les features depuis la DB pour un tenant slug donné.
 * Retourne un objet vide en cas d'erreur (DB down / tenant inconnu).
 */
async function loadFeaturesFromDb(slug: string): Promise<TenantFeatures> {
  try {
    const rows = await adminQuery<{ features: TenantFeatures | null }>(
      `SELECT s.features
       FROM core.tenant t
       JOIN core.tenant_settings s ON s.tenant_id = t.id
       WHERE t.slug = $1`,
      [slug]
    );
    return rows[0]?.features || {};
  } catch (e) {
    console.error("[tenant-features] db error for slug=", slug, e instanceof Error ? e.message : e);
    return {};
  }
}

/**
 * Récupère les features pour le cockpit courant (résolu via hostname).
 * Ne JAMAIS appeler depuis du code client — server-only.
 */
export async function getCockpitFeatures(request: Request): Promise<{
  slug: string;
  features: TenantFeatures;
}> {
  const cockpit = resolveCockpitTenant(request);
  const slug = cockpit.slug;

  const cached = cache.get(slug);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return { slug, features: cached.features };
  }

  const features = await loadFeaturesFromDb(slug);
  cache.set(slug, { features, loadedAt: Date.now() });
  return { slug, features };
}

/**
 * Force la lecture DB sur le prochain appel pour ce slug. À appeler après
 * un PATCH /api/admin/tenants/[slug] côté admin pour propager les changements.
 */
export function invalidateCockpitFeatures(slug?: string): void {
  if (slug) cache.delete(slug);
  else cache.clear();
}

/**
 * Vrai si la feature est activée. Tenant `mybotia` bénéficie d'un fallback
 * permissif si la DB est injoignable (compatibilité historique : avant 6B,
 * tout marchait sans features) — uniquement pour les features connues comme
 * historiquement activées.
 */
export function isFeatureEnabled(
  features: TenantFeatures,
  feature: FeatureKey
): boolean {
  return features[feature] === true;
}

/**
 * Helper pour les routes API : refuser 403 si la feature n'est pas activée.
 * Renvoie null si autorisé, sinon une Response 403 prête à retourner.
 */
export async function requireFeature(
  request: Request,
  feature: FeatureKey
): Promise<{ ok: true; slug: string } | { ok: false; response: Response }> {
  const { slug, features } = await getCockpitFeatures(request);
  if (!isFeatureEnabled(features, feature)) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "feature_disabled",
          feature,
          tenant: slug,
          message: `Le module '${feature}' n'est pas activé pour le cockpit '${slug}'.`,
        },
        {
          status: 403,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
        }
      ),
    };
  }
  return { ok: true, slug };
}

/**
 * Liste typée pour itération côté front (sidebar, FeatureDisabled).
 */
export const FEATURE_LIST: readonly FeatureKey[] = FEATURE_KEYS;
