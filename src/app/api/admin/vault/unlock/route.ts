// POST /api/admin/vault/unlock — vérifie le PIN, pose le cookie vault_session.
//
// Gates :
//   1. Session SSO valide
//   2. Email === gilleskorzec@gmail.com (VAULT_OWNER_EMAIL)
//   3. Rate-limit IP+email (5 essais → 30 min lockout)
//   4. PIN scrypt match VAULT_ADMIN_PIN_HASH du .vault
//
// Audit log à chaque tentative (succès, échec, lockout).

import { NextResponse } from "next/server";

import { requireVaultOwner } from "@/lib/vault/guard";
import { verifyPin } from "@/lib/vault/pin";
import { readVault } from "@/lib/vault/reader";
import { checkRateLimit, registerAttempt } from "@/lib/vault/rate-limit";
import { COOKIE_NAME, makeSessionToken, TTL_SECONDS } from "@/lib/vault/session";
import { auditVault } from "@/lib/vault/audit";

export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: Request) {
  const guard = await requireVaultOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const ip = clientIp(req);
  const rlKey = `${ip}:${guard.email}`;
  const rl = checkRateLimit(rlKey);
  if (!rl.allowed) {
    await auditVault({ user: guard.email, action: "unlock_locked_out", ok: false, ip });
    return NextResponse.json(
      { error: "locked_out", retryAfterMs: rl.retryAfterMs },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const pin =
    typeof body === "object" && body !== null && typeof (body as { pin?: unknown }).pin === "string"
      ? (body as { pin: string }).pin
      : "";

  const { flat } = await readVault();
  const stored = flat.get("VAULT_ADMIN_PIN_HASH");
  if (!stored) {
    return NextResponse.json({ error: "vault_not_configured" }, { status: 500 });
  }

  const ok = verifyPin(pin, stored);
  registerAttempt(rlKey, ok);
  await auditVault({
    user: guard.email,
    action: ok ? "unlock_ok" : "unlock_failed",
    ok,
    ip,
  });

  if (!ok) {
    return NextResponse.json({ error: "invalid_pin" }, { status: 401 });
  }

  const token = await makeSessionToken(guard.userId, guard.email);
  const res = NextResponse.json({ ok: true, ttlSeconds: TTL_SECONDS });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: TTL_SECONDS,
  });
  return res;
}
