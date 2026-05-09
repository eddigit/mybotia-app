// V1.1.D Phase 1 — Proxy admin modules.
//   GET   /api/admin/tenants/[slug]/modules → liste modules (registry × tenant_modules)
//   PATCH /api/admin/tenants/[slug]/modules → toggle { module_key, enabled }
//
// Cible : mybotia-business /api/v1/admin/tenants/[slug]/modules.
// Sécurité : relais du JWT utilisateur (cookie `mybotia_access`) en Bearer.
// Le business vérifie ensuite `is_superadmin === true` côté requireSuperadmin().
// Doctrine : superadmin uniquement, tenant ciblé peut être ≠ tenant cockpit.

import { cookies } from "next/headers";
import { requireSuperadmin } from "@/lib/admin-auth";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;
const DEFAULT_BUSINESS_URL = "http://127.0.0.1:3030";
const TIMEOUT_MS = 10_000;

function getBusinessUrl(): string {
  return (process.env.BUSINESS_API_URL || DEFAULT_BUSINESS_URL).replace(/\/+$/, "");
}

async function relayToBusiness(
  method: "GET" | "PATCH",
  slug: string,
  body: unknown,
): Promise<Response> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("mybotia_access")?.value;
  if (!accessToken) {
    return Response.json(
      { error: "missing_user_token" },
      { status: 401, headers: NO_STORE },
    );
  }

  const url = `${getBusinessUrl()}/api/v1/admin/tenants/${encodeURIComponent(slug)}/modules`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
  let payload: BodyInit | undefined;
  if (method === "PATCH" && body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (e) {
    return Response.json(
      {
        error: "business_unreachable",
        message: e instanceof Error ? e.message : "fetch failed",
      },
      { status: 502, headers: NO_STORE },
    );
  } finally {
    clearTimeout(timeout);
  }

  const ct = upstream.headers.get("content-type") ?? "";
  const responseBody = ct.includes("application/json")
    ? await upstream.json().catch(() => null)
    : null;

  return Response.json(responseBody ?? {}, {
    status: upstream.status,
    headers: NO_STORE,
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json(
      { error: auth.error },
      { status: auth.status, headers: NO_STORE },
    );
  }
  const { slug } = await params;
  return relayToBusiness("GET", slug, undefined);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return Response.json(
      { error: auth.error },
      { status: auth.status, headers: NO_STORE },
    );
  }
  const { slug } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "body_json_invalid" },
      { status: 400, headers: NO_STORE },
    );
  }
  return relayToBusiness("PATCH", slug, body);
}
