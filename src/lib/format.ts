/**
 * Helpers centralisés pour formats FR (dates, montants).
 *
 * Doctrine MyBotIA : côté client, tout affichage de date ou de montant
 * passe par ces helpers. Côté serveur (routes API), conserver l'ISO brut
 * pour le wire format.
 *
 * - formatDateFR        → court           ex. "09/05/2026"
 * - formatDateLongFR    → long            ex. "9 mai 2026"
 * - formatMoneyFR       → monétaire FR    ex. "1 234,56 €"
 *
 * Tous gèrent null/undefined/"" → "—" (em dash) sans crash.
 *
 * Mirror de `mybotia-business/src/lib/format.ts` — comportement identique.
 */

const EM_DASH = "—";

function toDate(d: string | Date | null | undefined): Date | null {
  if (d === null || d === undefined || d === "") return null;
  if (d instanceof Date) {
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // string : ISO ("2026-05-09") ou ISO datetime
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const dateShortFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });
const dateShortWithTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
});
const dateLongFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

/**
 * Format date courte FR, ex. "09/05/2026".
 * Avec opts.withTime → "09/05/2026 14:32".
 */
export function formatDateFR(
  d: string | Date | null | undefined,
  opts?: { withTime?: boolean },
): string {
  const date = toDate(d);
  if (!date) return EM_DASH;
  return opts?.withTime ? dateShortWithTimeFmt.format(date) : dateShortFmt.format(date);
}

/**
 * Format date longue FR, ex. "9 mai 2026".
 */
export function formatDateLongFR(d: string | Date | null | undefined): string {
  const date = toDate(d);
  if (!date) return EM_DASH;
  return dateLongFmt.format(date);
}

/**
 * Format montant FR avec devise, ex. "1 234,56 €".
 *
 * Accepte string (drizzle numeric retourne string) ou number.
 * Devise par défaut : EUR.
 */
export function formatMoneyFR(
  amount: number | string | null | undefined,
  currency: string = "EUR",
): string {
  if (amount === null || amount === undefined || amount === "") return EM_DASH;
  const num = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(num)) return EM_DASH;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(num);
}

/**
 * Variante compacte sans décimales ("1 234 €"). Utile pour KPI cards où on veut
 * de l'amplitude visuelle sans le bruit des centimes.
 */
export function formatMoneyCompactFR(
  amount: number | string | null | undefined,
  currency: string = "EUR",
): string {
  if (amount === null || amount === undefined || amount === "") return EM_DASH;
  const num = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(num)) return EM_DASH;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}
