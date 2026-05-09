"use client";

import { useAuth } from "@/contexts/auth-context";
import { useAgents } from "@/hooks/use-api";
import { useActiveAgent } from "@/hooks/use-active-agent";

// V1.1.H.1 — CommandCenterHero branché sur useActiveAgent (cockpit-aware).
// Avant : TENANT_AGENT_NAME[user.tenant_slug] lisait le JWT, jamais mis à jour
// lors d'un switch cockpit → restait sur "Lea" après bascule superadmin.
// Après : useActiveAgent() écoute useCockpitFeatures() qui refetch sur
// mybotia:tenant-switched → mise à jour immédiate sans F5.

export function CommandCenterHero() {
  const { user } = useAuth();
  const { data: agents } = useAgents(false, !!user);
  const { agent: cockpitAgent } = useActiveAgent();
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon apres-midi" : "Bonsoir";

  const displayName = user?.first_name || user?.email?.split("@")[0] || "";
  // Nom de l'agent : cockpit courant (via cookie) en priorité, sinon fallback
  // neutre (ne jamais hardcoder "Lea" — fail-closed doctrine V1.1.G).
  const expectedName = cockpitAgent?.name ?? null;

  // On considère l'agent "principal" comme le premier agent retourné par
  // l'API filtrée par tenant. Pas de chiffre inventé, pas d'état hardcodé.
  const primaryAgent = agents[0];
  const primaryName = primaryAgent?.name || expectedName || "l'agent";
  const status = primaryAgent?.status;

  // Libellé honnête : reflète l'état réel renvoyé par /api/agents
  // (online / busy / listening / offline). Si pas de données → libellé neutre.
  let presenceLabel: string;
  if (status === "online") {
    presenceLabel = "votre collaborateur IA est en ligne";
  } else if (status === "busy") {
    presenceLabel = "votre collaborateur IA traite une demande";
  } else if (status === "listening") {
    presenceLabel = "votre collaborateur IA est à l'écoute";
  } else if (status === "speaking") {
    presenceLabel = "votre collaborateur IA répond";
  } else if (status === "offline") {
    presenceLabel = "votre collaborateur IA est hors ligne";
  } else {
    presenceLabel = "votre collaborateur IA";
  }

  const subtitle = user?.is_superadmin
    ? "MyBotIA — interface de pilotage multi-tenant."
    : `${primaryName}, ${presenceLabel}.`;

  return (
    <section className="mb-8">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-text-primary font-headline mb-2">
          {greeting}
          {displayName ? ", " : ""}
          <span className="text-gradient">{displayName}</span>.
        </h1>
        <p className="text-text-secondary font-medium">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
