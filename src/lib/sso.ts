import { createHmac, randomBytes } from "node:crypto";

const TICKET_TTL_SECONDS = 60;

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getSecret(): string {
  const s = process.env.MYBOTIA_SSO_SECRET;
  if (!s || s.length < 32) {
    throw new Error("MYBOTIA_SSO_SECRET manquant ou trop court");
  }
  return s;
}

export interface DolibarrTicketPayload {
  sub: string;
  tenant: string;
  target: string;
  jti: string;
  iat: number;
  exp: number;
}

export function issueDolibarrTicket(params: {
  email: string;
  tenantSlug: string;
  target: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: DolibarrTicketPayload = {
    sub: params.email,
    tenant: params.tenantSlug,
    target: params.target,
    jti: randomBytes(16).toString("hex"),
    iat: now,
    exp: now + TICKET_TTL_SECONDS,
  };

  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const signature = base64url(
    createHmac("sha256", getSecret()).update(signingInput).digest()
  );
  return `${signingInput}.${signature}`;
}

const TENANT_TO_CRM_HOST: Record<string, string> = {
  mybotia: "crm-mybotia.mybotia.com",
  vlmedical: "crm-vlmedical.mybotia.com",
};

export function crmHostForTenant(tenantSlug: string): string | null {
  return TENANT_TO_CRM_HOST[tenantSlug] ?? null;
}
