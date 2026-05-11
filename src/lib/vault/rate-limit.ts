// Rate-limit in-memory pour l'unlock vault.
// Volume attendu : ~10 tentatives/jour. Pas de Redis nécessaire.

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 60 * 1000;

type State = {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number;
};

const state = new Map<string, State>();

export type RateCheck =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: "locked"; retryAfterMs: number };

export function checkRateLimit(key: string): RateCheck {
  const now = Date.now();
  const cur = state.get(key);
  if (cur && cur.lockedUntil > now) {
    return { allowed: false, reason: "locked", retryAfterMs: cur.lockedUntil - now };
  }
  if (cur && cur.lockedUntil > 0 && cur.lockedUntil <= now) {
    // lockout expired, reset
    state.delete(key);
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }
  return { allowed: true, remaining: MAX_ATTEMPTS - (cur?.attempts ?? 0) };
}

export function registerAttempt(key: string, success: boolean): void {
  const now = Date.now();
  if (success) {
    state.delete(key);
    return;
  }
  const cur = state.get(key) ?? { attempts: 0, firstAttemptAt: now, lockedUntil: 0 };
  cur.attempts += 1;
  if (cur.attempts >= MAX_ATTEMPTS) {
    cur.lockedUntil = now + LOCKOUT_MS;
  }
  state.set(key, cur);
}
