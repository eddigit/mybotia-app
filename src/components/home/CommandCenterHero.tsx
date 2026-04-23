"use client";

import { useAuth } from "@/contexts/auth-context";

// Mapping tenant_slug -> info agent principal (affichage front)
const TENANT_AGENT_INFO: Record<string, { name: string; count: string }> = {
  mybotia:     { name: "Lea",     count: "votre collaborateur IA est en ligne" },
  vlmedical:   { name: "Max",     count: "votre collaborateur IA est en ligne" },
  igh:         { name: "Lucy",    count: "votre collaborateur IA est en ligne" },
  cmb_lux:     { name: "Raphael", count: "votre collaborateur IA est en ligne" },
  esprit_loft: { name: "Maria",   count: "votre collaborateur IA est en ligne" },
};

export function CommandCenterHero() {
  const { user } = useAuth();
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon apres-midi" : "Bonsoir";

  const displayName = user?.first_name || user?.email?.split("@")[0] || "";
  const agentInfo =
    (user && TENANT_AGENT_INFO[user.tenant_slug]) ||
    { name: "Lea", count: "votre collaborateur IA est en ligne" };

  const subtitle = user?.is_superadmin
    ? "MyBotIA — interface de pilotage multi-tenant."
    : `${agentInfo.name}, ${agentInfo.count}.`;

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
