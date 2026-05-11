// PIN check via scrypt — pas de nouvelle dep, on garde tout en builtin.
//
// Stockage : `salt:hash` hex dans .vault sous VAULT_ADMIN_PIN_HASH.
// Bruteforce mitigé par rate-limit (5 essais → lockout 30 min).

import { scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

export function verifyPin(pin: string, stored: string): boolean {
  const idx = stored.indexOf(":");
  if (idx <= 0) return false;
  const saltHex = stored.slice(0, idx);
  const hashHex = stored.slice(idx + 1);
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length !== KEY_LEN) return false;
  const candidate = scryptSync(pin, salt, KEY_LEN);
  return timingSafeEqual(candidate, expected);
}
