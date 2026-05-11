// Cookie session vault — distinct du cookie SSO principal.
// HMAC SHA-256 signed token, TTL 10 min, httpOnly, Secure, SameSite=Strict.

import { createHmac, timingSafeEqual } from "node:crypto";

import { readVault } from "./reader";

export const COOKIE_NAME = "mybotia_vault_session";
const TTL_MS = 10 * 60 * 1000;

async function getSecret(): Promise<string> {
  const { flat } = await readVault();
  const s = flat.get("VAULT_SESSION_SECRET");
  if (!s) throw new Error("VAULT_SESSION_SECRET missing from .vault");
  return s;
}

type Payload = { uid: string; email: string; exp: number };

export async function makeSessionToken(userId: string, email: string): Promise<string> {
  const secret = await getSecret();
  const payload: Payload = { uid: userId, email, exp: Date.now() + TTL_MS };
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

export async function verifySessionToken(token: string): Promise<Payload | null> {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let secret: string;
  try {
    secret = await getSecret();
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret).update(b64).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString()) as Payload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.uid !== "string" || typeof payload.email !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export const TTL_SECONDS = TTL_MS / 1000;
