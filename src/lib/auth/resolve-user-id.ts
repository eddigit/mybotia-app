// Helper centralisé pour résoudre un user_id (UUID) depuis un email.
//
// Contexte : les JWT émis par auth-service portent `sub = email`
// (ex `gilleskorzec@gmail.com`). Plusieurs routes tentent de cast cette
// valeur en UUID dans des requêtes core.tenant_user et crashent en 503
// (invalid input syntax for type uuid).
//
// Ce helper fait un lookup `core."user".id` depuis l'email avec un cache
// mémoire 60s (les correspondances email→uuid changent rarement).

import { adminQuery } from "../admin-db";

type CacheEntry = { value: string | null; expiresAt: number };
const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Retourne l'UUID du user dont l'email correspond (case-insensitive),
 * ou null si introuvable. Cache 60s.
 *
 * Si la chaîne fournie est déjà un UUID, elle est retournée telle quelle
 * sans appel DB.
 */
export async function resolveUserIdByEmail(
  email: string | null | undefined,
): Promise<string | null> {
  if (!email) return null;
  const trimmed = email.trim();
  if (!trimmed) return null;

  if (isUuid(trimmed)) return trimmed;

  const key = trimmed.toLowerCase();
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const rows = await adminQuery<{ id: string }>(
      `SELECT id FROM core."user" WHERE lower(email) = lower($1) LIMIT 1`,
      [key],
    );
    const id = rows[0]?.id ?? null;
    cache.set(key, { value: id, expiresAt: now + TTL_MS });
    return id;
  } catch (err) {
    console.error(
      "[resolve-user-id] lookup failed",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
