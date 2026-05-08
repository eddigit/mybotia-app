"use client";

import { useAuth } from "@/contexts/auth-context";
import { useAgents } from "@/hooks/use-api";

// Mapping tenant_slug -> nom de l'agent principal (affichage front).
// V1 garde-fou Voice : on n'affirme plus "est en ligne" en dur.
// La présence réelle est lue depuis useAgents() (API live), avec fallback
// neutre si l'agent n'est pas joignable.
const TENANT_AGENT_NAME: Record<string, string> = {
  mybotia: "Lea",
  vlmedical: "Max",
  igh: "Lucy",
  cmb_lux: "Raphael",
  esprit_loft: "Maria",
};

export function CommandCenterHero() {
  const { user } = useAuth();
  const { data: agents } = useAgents(false, !!user);
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon apres-midi" : "Bonsoir";

  const displayName = user?.first_name || user?.email?.split("@")[0] || "";
  const expectedName =
    (user && TENANT_AGENT_NAME[user.tenant_slug]) || "Lea";

  // On considère l'agent "principal" comme le premier agent retourné par
  // l'API filtrée par tenant. Pas de chiffre inventé, pas d'état hardcodé.
  const primaryAgent = agents[0];
  const primaryName = primaryAgent?.name || expectedName;
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
