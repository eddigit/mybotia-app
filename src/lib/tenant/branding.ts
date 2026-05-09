/**
 * Tenant-scoped branding pour mybotia-app (cockpit collaborateurs).
 *
 * Doctrine MyBotIA :
 *   - Le cockpit principal d'un tenant est résolu côté serveur via hostname
 *     (`tenant-resolver.ts`) ; ce helper retourne le branding correspondant.
 *   - Aucun tenant (mybotia inclus) n'est privilégié au niveau framework.
 *   - V1 : map en dur, V2 : table `core.tenant_settings` (mêmes champs).
 *   - Doctrine `feedback_branding_igh` : IGH = "IGH" seul, jamais "IGH Group".
 *
 * Mirror de `mybotia-business/src/lib/tenant/branding.ts`. Champs réduits ici
 * car l'app ne génère pas de PDF (issuerName/iban/etc. restent côté business).
 */

export type TenantBranding = {
  /** Wordmark affiché (badge sidebar, header). Ex: "MyBotIA". */
  displayName: string;
  /** Sous-libellé court (ex: "Cockpit", "DM Cockpit"). */
  subLabel: string;
  /** Couleur primaire — accent de marque. */
  primaryColor: string;
  /** URL CDN du logo (optionnel — sinon initiales/wordmark). */
  logoUrl?: string;
};

const NEUTRAL_COLOR = "#374151"; // slate-700, intentionnellement non-MyBotIA

const BRANDING: Record<string, TenantBranding> = {
  mybotia: {
    displayName: "MyBotIA",
    subLabel: "Cockpit",
    primaryColor: "#0EA5E9", // Sky Blue charte MyBotIA
  },
  vlmedical: {
    displayName: "VL Medical",
    subLabel: "DM Cockpit",
    primaryColor: "#10B981",
  },
  igh: {
    // Doctrine `feedback_branding_igh` : JAMAIS "IGH Group", toujours "IGH".
    displayName: "IGH",
    subLabel: "Cockpit",
    primaryColor: "#6366F1",
  },
  paypers: {
    displayName: "Paypers",
    subLabel: "Copilote 18-30",
    primaryColor: "#F59E0B",
  },
  systemic: {
    displayName: "Systemic",
    subLabel: "Cockpit",
    primaryColor: "#A855F7",
  },
};

/**
 * Résout le branding d'un tenant. Fallback neutre si slug inconnu : on n'hérite
 * jamais de l'identité MyBotIA pour un tenant non explicitement mappé.
 */
export function getTenantBranding(tenantSlug: string | null | undefined): TenantBranding {
  if (!tenantSlug) {
    return {
      displayName: "MyBotIA",
      subLabel: "Cockpit",
      primaryColor: BRANDING.mybotia.primaryColor,
    };
  }
  const entry = BRANDING[tenantSlug];
  if (entry) return entry;
  return {
    displayName: tenantSlug,
    subLabel: "Cockpit",
    primaryColor: NEUTRAL_COLOR,
  };
}

/** Liste explicite — utile pour /admin/tenants ou previews. */
export function listTenantBrandings(): Array<{ slug: string; branding: TenantBranding }> {
  return Object.entries(BRANDING).map(([slug, branding]) => ({ slug, branding }));
}
