// Tenant ↔ agent registry V4 — source statique alignée sur /opt/mybotia/config/tenants.yaml.
// Volontairement simple ce soir ; un loader yaml sera branché en bloc 5+.

interface AgentEntry {
  agentSlug: string;
  tenantSlug: string;
  displayName: string;
}

const TENANTS: AgentEntry[] = [
  { agentSlug: "lea", tenantSlug: "mybotia", displayName: "Léa" },
  { agentSlug: "max", tenantSlug: "vlmedical", displayName: "Max" },
  { agentSlug: "lucy", tenantSlug: "igh", displayName: "Lucy" },
  { agentSlug: "raphael", tenantSlug: "cmb_lux", displayName: "Raphaël" },
  { agentSlug: "maria", tenantSlug: "esprit_loft", displayName: "Maria" },
];

const SUPERADMIN_AGENTS: AgentEntry[] = [
  { agentSlug: "damien", tenantSlug: "mybotia", displayName: "Damien" },
  { agentSlug: "main", tenantSlug: "mybotia", displayName: "Damien" },
];

const ALL = [...TENANTS, ...SUPERADMIN_AGENTS];

const tenantToAgent = new Map<string, string>(
  // Premier gagnant : agents tenants avant superadmin (lea wins on mybotia).
  ALL.map((e) => [e.tenantSlug, e.agentSlug] as const)
    .filter(([t], i, arr) => arr.findIndex(([t2]) => t2 === t) === i)
);

const knownAgents = new Set(ALL.map((e) => e.agentSlug));

export class UnknownTenantError extends Error {
  readonly tenantSlug: string;
  constructor(tenantSlug: string) {
    super(`Tenant inconnu: ${tenantSlug}`);
    this.name = "UnknownTenantError";
    this.tenantSlug = tenantSlug;
  }
}

export function getDefaultAgent(tenantSlug: string): string {
  const a = tenantToAgent.get(tenantSlug);
  if (!a) throw new UnknownTenantError(tenantSlug);
  return a;
}

export function isKnownAgent(agentSlug: string): boolean {
  return knownAgents.has(agentSlug);
}

export function isKnownTenant(tenantSlug: string): boolean {
  return tenantToAgent.has(tenantSlug);
}

export function resolveAgentId(
  tenantSlug: string,
  requestedAgentId: string | undefined,
  isSuperadmin: boolean
): string {
  if (isSuperadmin && requestedAgentId) {
    if (!isKnownAgent(requestedAgentId)) {
      const err = new Error(`agent inconnu: ${requestedAgentId}`);
      (err as Error & { code?: string }).code = "agent_unknown";
      throw err;
    }
    return requestedAgentId;
  }
  if (requestedAgentId && requestedAgentId !== getDefaultAgent(tenantSlug)) {
    const err = new Error(
      `tenant ${tenantSlug} not allowed to call agent ${requestedAgentId}`
    );
    (err as Error & { code?: string }).code = "tenant_agent_mismatch";
    throw err;
  }
  return getDefaultAgent(tenantSlug);
}

export function getDisplayName(agentSlug: string): string {
  return ALL.find((e) => e.agentSlug === agentSlug)?.displayName ?? agentSlug;
}
