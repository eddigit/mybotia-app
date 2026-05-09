// Bloc 5G — Résolution tenant par hostname (autorité serveur).
//
// Doctrine :
//   Le cockpit principal d'un client est déterminé par l'URL de connexion,
//   pas par un sélecteur frontend ni par le JWT seul. Cela élimine
//   structurellement les fuites multi-tenant : un user qui visite
//   `app.mybotia.com` ne peut pas, depuis cette URL, lire ou écrire des
//   données VL Medical / IGH / CMB, même s'il est superadmin.
//
//   Mapping cible (DNS à créer côté Cloudflare ultérieurement) :
//     app.mybotia.com        → mybotia
//     vlmedical.mybotia.com  → vlmedical
//     igh.mybotia.com        → igh
//     cmb.mybotia.com        → cmb_lux
//
//   Une zone admin séparée (admin.mybotia.com ou /admin/tenants) restera
//   le seul endroit où un superadmin peut explicitement opérer cross-tenant.
//
// Bloc 7F — Cockpit cookie superadmin :
//   Pour permettre à Gilles (superadmin) de basculer entre cockpits depuis
//   `app.mybotia.com` sans changer de hostname, on lit en priorité le cookie
//   httpOnly `cockpit_tenant`. Ce cookie n'est honoré QUE si la session JWT
//   porte `is_superadmin === true`. Pour tout autre user, le cookie est
//   ignoré (et l'endpoint POST de switch refuse de le poser).
//
//   Ordre de résolution :
//     1. Cookie `cockpit_tenant` (uniquement si superadmin)
//     2. Hostname (vlmedical.mybotia.com → vlmedical)
//     3. Default mybotia
//
// Usage côté route serveur :
//   import { resolveCockpitTenant } from "@/lib/tenant-resolver";
//   const cockpit = resolveCockpitTenant(request);
//   // cockpit = { slug: "mybotia", source: "hostname"|"fallback-dev"|"default"|"cookie" }

const HOSTNAME_TO_TENANT: Record<string, string> = {
  "app.mybotia.com": "mybotia",
  "vlmedical.mybotia.com": "vlmedical",
  "igh.mybotia.com": "igh",
  "cmb.mybotia.com": "cmb_lux",
};

// Hostnames de dev/préproduction qui doivent toujours résoudre vers mybotia.
const DEV_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
]);

const DEFAULT_TENANT = "mybotia";

export type TenantResolution = {
  slug: string;
  source: "hostname" | "fallback-dev" | "default" | "cookie";
  hostname: string | null;
};

// Bloc 7F — nom du cookie cockpit superadmin (httpOnly, scope domaine app).
export const COCKPIT_COOKIE_NAME = "cockpit_tenant";

// Slugs autorisés pour le cookie cockpit (whitelist stricte — refus de tout
// slug arbitraire injecté côté client).
export const KNOWN_TENANT_SLUGS: ReadonlySet<string> = new Set([
  "mybotia",
  "vlmedical",
  "igh",
  "cmb_lux",
  "esprit_loft",
]);

/**
 * Extrait le hostname d'une requête. Strip le port si présent.
 * Supporte X-Forwarded-Host pour les déploiements derrière un reverse proxy.
 */
export function extractHostname(request: Request): string | null {
  const xfh = request.headers.get("x-forwarded-host");
  const host = xfh || request.headers.get("host");
  if (!host) return null;
  // strip ":port"
  const colonIdx = host.indexOf(":");
  return (colonIdx === -1 ? host : host.slice(0, colonIdx)).toLowerCase();
}

/**
 * Lit la valeur d'un cookie depuis le header `Cookie` brut. Évite la
 * dépendance à `next/headers` (cette fonction reçoit déjà la Request).
 * Retourne null si le cookie est absent ou si la valeur est vide.
 */
export function readCookieFromRequest(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  // Parsing volontairement simple : split sur "; " et "=", trim.
  const parts = raw.split(/;\s*/);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    if (k !== name) continue;
    const v = part.slice(eq + 1).trim();
    return v.length > 0 ? decodeURIComponent(v) : null;
  }
  return null;
}

/**
 * Résout le tenant pour une route cockpit.
 * Ordre :
 *   1. Cookie `cockpit_tenant` SI fourni ET dans la whitelist ET (optionnel)
 *      `superadminOnly=true` ET la session est superadmin.
 *      NOTE : la vérification `is superadmin` se fait UNIQUEMENT via le helper
 *      `resolveCockpitTenants` (qui charge la session). La fonction de base
 *      `resolveCockpitTenant` ne sait pas encore si l'user est superadmin —
 *      elle ne fait que lire le cookie. La sécurité finale repose sur :
 *      a) le POST /api/me/switch-tenant qui refuse de poser le cookie pour
 *         un non-superadmin (cookie absent → fallback hostname),
 *      b) `resolveCockpitTenants` qui revalide ACL session vs cockpit.
 *   2. Hostname (vlmedical.mybotia.com → vlmedical).
 *   3. Dev hostname → fallback mybotia.
 *   4. Default mybotia.
 *
 * Cette fonction NE fait PAS d'auth. C'est juste la résolution. Les routes
 * doivent ensuite valider que la session JWT autorise ce tenant.
 */
export function resolveCockpitTenant(request: Request): TenantResolution {
  const hostname = extractHostname(request);

  const cookieSlug = readCookieFromRequest(request, COCKPIT_COOKIE_NAME);
  if (cookieSlug && KNOWN_TENANT_SLUGS.has(cookieSlug)) {
    return { slug: cookieSlug, source: "cookie", hostname };
  }

  if (hostname && HOSTNAME_TO_TENANT[hostname]) {
    return { slug: HOSTNAME_TO_TENANT[hostname], source: "hostname", hostname };
  }
  if (hostname && DEV_HOSTNAMES.has(hostname)) {
    return { slug: DEFAULT_TENANT, source: "fallback-dev", hostname };
  }
  return { slug: DEFAULT_TENANT, source: "default", hostname };
}

/**
 * Vérifie qu'un tenant_slug demandé via query/body matche le tenant résolu
 * par hostname. Utilisé par les routes cockpit pour bloquer les tentatives
 * d'override depuis le client.
 *
 * Renvoie null si OK, sinon un message d'erreur explicatif.
 */
export function assertTenantMatchesHostname(
  request: Request,
  requestedSlug: string | null | undefined
): string | null {
  if (!requestedSlug) return null;
  const cockpit = resolveCockpitTenant(request);
  if (requestedSlug !== cockpit.slug) {
    return `tenant_slug '${requestedSlug}' incompatible avec le cockpit '${cockpit.slug}' (hostname=${cockpit.hostname || "?"}). Cockpits clients = un par hostname.`;
  }
  return null;
}

/**
 * Liste publique des hostnames connus — utile pour la zone admin future
 * et les tests.
 */
export function listKnownHostnames(): Array<{ hostname: string; slug: string }> {
  return Object.entries(HOSTNAME_TO_TENANT).map(([hostname, slug]) => ({ hostname, slug }));
}

// ============================================================================
// Helper unifié pour les routes cockpit
// ============================================================================
// Combine : auth session + résolution hostname + validation tenant_slug query
// + ACL session vs cockpit. Renvoie un tenant config unique (cockpit = mono-tenant).

import { getTenantConfig, type TenantConfig } from "./dolibarr";
import { getSession } from "./session";

export type CockpitResolution =
  | { ok: true; tenant: TenantConfig; slug: string; source: TenantResolution["source"] }
  | { ok: false; status: number; error: string };

/**
 * Pour les routes cockpit principales (today, dashboard, projects, clients,
 * documents, tasks, ...). Ne renvoie JAMAIS plusieurs tenants : un cockpit
 * = un tenant. Toute tentative de cross-tenant via query est refusée.
 *
 * Étapes :
 *   1. Auth session JWT (401 si absente)
 *   2. Hostname → cockpit tenant
 *   3. Si tenant_slug query fourni : doit matcher cockpit (sinon 403)
 *   4. ACL session : user normal doit avoir cockpit.slug == session.tenantSlug,
 *      sinon 403 (sauf superadmin)
 */
export async function resolveCockpitTenants(request: Request): Promise<CockpitResolution> {
  const session = await getSession();
  if (!session) return { ok: false, status: 401, error: "Non authentifie" };

  let cockpit = resolveCockpitTenant(request);

  // Bloc 7F — sécurité : un cookie `cockpit_tenant` ne doit être honoré que
  // pour un superadmin. Pour tout autre user, on retombe sur le hostname
  // (et on log un warning : un cookie est arrivé sans droit). Le cookie ne
  // peut normalement pas être posé sans superadmin (cf. POST /api/me/switch-tenant),
  // mais on défend en profondeur.
  if (cockpit.source === "cookie" && !session.isSuperadmin) {
    console.warn(
      "[tenant-resolver] cookie cockpit présent pour user non-superadmin",
      { user: session.userId, requested: cockpit.slug, tenant: session.tenantSlug }
    );
    // Recompute en ignorant le cookie : on simule une request sans header cookie.
    cockpit = resolveHostnameOnly(request);
  }

  // Étape 3 : query mismatch ?
  const url = new URL(request.url);
  const queryTenant = url.searchParams.get("tenant_slug");
  const mismatch = assertTenantMatchesHostname(request, queryTenant);
  if (mismatch) return { ok: false, status: 403, error: mismatch };

  // Étape 4 : ACL session
  // Superadmin : peut accéder à n'importe quel cockpit qu'il visite (hostname ou cookie).
  // User normal : son tenantSlug doit matcher le cockpit.
  if (!session.isSuperadmin && cockpit.slug !== session.tenantSlug) {
    return {
      ok: false,
      status: 403,
      error: `Acces refuse : votre compte appartient au tenant '${session.tenantSlug}', le cockpit demande '${cockpit.slug}'.`,
    };
  }

  return {
    ok: true,
    tenant: getTenantConfig(cockpit.slug),
    slug: cockpit.slug,
    source: cockpit.source,
  };
}

/**
 * Variante de `resolveCockpitTenant` qui ignore le cookie cockpit. Utile
 * quand le code appelant a déjà déterminé que la session ne peut pas
 * bénéficier du cookie (non-superadmin), pour retomber sur le hostname.
 */
export function resolveHostnameOnly(request: Request): TenantResolution {
  const hostname = extractHostname(request);
  if (hostname && HOSTNAME_TO_TENANT[hostname]) {
    return { slug: HOSTNAME_TO_TENANT[hostname], source: "hostname", hostname };
  }
  if (hostname && DEV_HOSTNAMES.has(hostname)) {
    return { slug: DEFAULT_TENANT, source: "fallback-dev", hostname };
  }
  return { slug: DEFAULT_TENANT, source: "default", hostname };
}
