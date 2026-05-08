"use client";

/**
 * apiFetch — wrapper fetch avec refresh transparent (CL3).
 *
 * Identique au wrapper mybotia-business. Stratégie :
 *  - 1 seul refresh par 401 (param `retried` interne).
 *  - mutex global Promise pour éviter N refresh concurrents.
 *  - refresh = POST https://auth.mybotia.com/refresh credentials:include.
 *  - si refresh KO → redirect /login?next=<currentUrl>.
 *  - jamais de refresh sur 403.
 *  - jamais de log de cookie / token / valeur sensible.
 */

const AUTH_REFRESH_URL = "https://auth.mybotia.com/refresh";
const LOGIN_PATH = "/login";

let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(AUTH_REFRESH_URL, {
        method: "POST",
        credentials: "include",
      });
      return res.ok;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

function redirectToLogin(): never {
  if (typeof window !== "undefined") {
    const next = encodeURIComponent(window.location.href);
    window.location.assign(`${LOGIN_PATH}?next=${next}`);
  }
  throw new Error("Session expired — redirecting to login");
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return apiFetchInternal(input, init, false);
}

async function apiFetchInternal(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  retried: boolean,
): Promise<Response> {
  const opts: RequestInit = { ...(init ?? {}), credentials: "include" };
  const res = await fetch(input, opts);

  if (res.status !== 401 || retried) {
    return res;
  }

  const ok = await refreshSession();
  if (!ok) {
    redirectToLogin();
  }

  return apiFetchInternal(input, init, true);
}

/**
 * Variante "souple" : ne redirige pas vers login si refresh échoue.
 * Utilisée par auth-context au mount initial — l'utilisateur peut être
 * légitimement non connecté, on ne veut pas boucler sur /login.
 */
export async function apiFetchOptional(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const opts: RequestInit = { ...(init ?? {}), credentials: "include" };
  const res = await fetch(input, opts);

  if (res.status !== 401) return res;

  const ok = await refreshSession();
  if (!ok) return res;

  return fetch(input, opts);
}
