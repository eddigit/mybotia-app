"use client";

// V1.1.G — Hook unique pour résoudre l'agent du cockpit courant.
//
// Avant : `agents[0]` depuis `useAgents()` (filtre serveur via JWT, pas via
// cockpit cookie) → l'UI restait sur Léa quand Gilles basculait sur VLMedical.
// Après : on lit le tenant slug depuis `useCockpitFeatures()` (cockpit-aware,
// honore le cookie `cockpit_tenant`) et on résout via la map V1.

import { useMemo } from "react";
import { useCockpitFeatures } from "@/hooks/use-api";
import { resolveTenantAgent, type TenantAgent } from "@/lib/agents/tenant-agent";

export interface UseActiveAgentResult {
  agent: TenantAgent | null;
  tenantSlug: string | null;
  loading: boolean;
}

/**
 * Renvoie l'agent principal du cockpit courant. Fail-closed : si le tenant
 * n'est pas mappé dans `TENANT_AGENTS`, l'agent est `null` et l'UI doit
 * afficher un empty state explicite ("Aucun agent configuré pour ce cockpit").
 */
export function useActiveAgent(): UseActiveAgentResult {
  const { data: features, loading } = useCockpitFeatures();
  const tenantSlug = features?.tenant ?? null;
  const agent = useMemo(() => resolveTenantAgent(tenantSlug), [tenantSlug]);
  return { agent, tenantSlug, loading };
}
