// V1.1.B Phase 1 — Client HTTP service-to-service vers mybotia-business.
//
// Signe un JWT court (5 min, scopes limités) avec JWT_SERVICE_SECRET et
// appelle https://crm.mybotia.com/api/v1/* (par défaut http://127.0.0.1:3030
// en intra-VPS pour éviter le round-trip TLS public).
//
// Phase 1 : LECTURE SEULE. Helper `getJSON` uniquement.
// Phase 2 ajoutera mutations + scopes write.
//
// Aucun secret/token n'est loggé. Erreurs réseau/HTTP normalisées en
// `BusinessClientError` consommables côté crm-router.

import jwt from "jsonwebtoken";

const SERVICE_ISSUER = "mybotia-platform";
const SERVICE_AUDIENCE = "mybotia-business";
const TOKEN_TTL_SECONDS = 5 * 60;

const DEFAULT_BUSINESS_URL = "http://127.0.0.1:3030";
const DEFAULT_TIMEOUT_MS = 10_000;

export type ServiceTokenClaims = {
  tenantId: string;
  tenantSlug: string;
  /** Acteur derrière l'appel : `platform` (route Next.js), `agent:lea` (futur). */
  actorType?: "platform" | "agent";
  actorId?: string;
  scopes: readonly string[];
};

export class BusinessClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "BusinessClientError";
  }
}

function getServiceSecret(): string {
  const secret = process.env.JWT_SERVICE_SECRET;
  if (!secret) {
    throw new BusinessClientError(
      500,
      "service_secret_missing",
      "JWT_SERVICE_SECRET non configuré côté Platform",
    );
  }
  return secret;
}

function getBusinessUrl(): string {
  return (process.env.BUSINESS_API_URL || DEFAULT_BUSINESS_URL).replace(/\/+$/, "");
}

function signServiceToken(claims: ServiceTokenClaims): string {
  const secret = getServiceSecret();
  return jwt.sign(
    {
      sub: claims.actorId ?? "platform",
      tenant_id: claims.tenantId,
      tenant_slug: claims.tenantSlug,
      actor_type: claims.actorType ?? "platform",
      actor_id: claims.actorId ?? "platform",
      scopes: [...claims.scopes],
    },
    secret,
    {
      issuer: SERVICE_ISSUER,
      audience: SERVICE_AUDIENCE,
      expiresIn: TOKEN_TTL_SECONDS,
    },
  );
}

type FetchOpts = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

/**
 * Phase 1.1.A — log JSON structuré par appel HTTP business. Capté par
 * `journalctl -u mybotia-app | grep business_call`. Aucune valeur sensible
 * (token, cookie, body) — uniquement métadonnées techniques.
 */
type BusinessCallLog = {
  evt: "business_call";
  tenant_id: string;
  tenant_slug: string;
  path: string;
  status: number;
  duration_ms: number;
  error_code: string | null;
};

function logBusinessCall(entry: BusinessCallLog): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

async function fetchJson<T>(
  url: string,
  token: string,
  opts: FetchOpts,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error("business_client_timeout")),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: opts.signal ?? controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    throw new BusinessClientError(
      502,
      "network_error",
      err instanceof Error ? err.message : "fetch failed",
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const code =
      (body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `http_${res.status}`) || `http_${res.status}`;
    throw new BusinessClientError(res.status, code, `business HTTP ${res.status}`, body);
  }

  return body as T;
}

/**
 * GET signé vers mybotia-business. Retourne le payload `data` du wrapper
 * `tenantHandler` côté business : `{ data: <resource> }` → renvoie `<resource>`.
 */
export async function businessGetJson<T>(
  path: string,
  claims: ServiceTokenClaims,
  opts: FetchOpts = {},
): Promise<T> {
  if (!path.startsWith("/")) {
    throw new BusinessClientError(500, "bad_path", "path must start with /");
  }
  const url = `${getBusinessUrl()}${path}`;
  const token = signServiceToken(claims);
  const startedAt = Date.now();
  let status = 0;
  let errorCode: string | null = null;
  try {
    const wrapper = await fetchJson<{ data: T }>(url, token, opts);
    if (!wrapper || typeof wrapper !== "object" || !("data" in wrapper)) {
      errorCode = "bad_response_shape";
      throw new BusinessClientError(
        502,
        errorCode,
        "Réponse business sans champ `data`",
      );
    }
    status = 200;
    return wrapper.data;
  } catch (err) {
    if (err instanceof BusinessClientError) {
      status = err.status;
      errorCode = errorCode ?? err.code;
    } else {
      status = 502;
      errorCode = "unknown_error";
    }
    throw err;
  } finally {
    logBusinessCall({
      evt: "business_call",
      tenant_id: claims.tenantId,
      tenant_slug: claims.tenantSlug,
      path,
      status,
      duration_ms: Date.now() - startedAt,
      error_code: errorCode,
    });
  }
}
