"use client";

import { Zap } from "lucide-react";
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
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-text-primary font-headline mb-2">
          {greeting}
          {displayName ? ", " : ""}
          <span className="text-gradient">{displayName}</span>.
        </h1>
        <p className="text-text-secondary font-medium">
          {subtitle}
        </p>
      </div>

      <div className="relative group max-w-4xl mx-auto">
        <div className="absolute -inset-1 bg-gradient-to-r from-accent-primary/15 to-transparent blur-xl opacity-40 group-focus-within:opacity-80 transition duration-500 pointer-events-none" />

        <div className="relative flex items-center bg-surface-2 border-b-2 border-accent-primary/25 focus-within:border-accent-primary/60 transition-all">
          <div className="px-6">
            <Zap className="w-6 h-6 text-accent-glow" />
          </div>
          <div className="w-full py-5 text-lg text-text-muted font-body">
            Interface de pilotage MyBotIA — donnees en direct
          </div>
          <div className="pr-6 flex items-center gap-1.5">
            <kbd className="px-2 py-1 text-[9px] font-bold bg-surface-3 rounded border border-border-subtle text-text-muted font-mono">CMD</kbd>
            <kbd className="px-2 py-1 text-[9px] font-bold bg-surface-3 rounded border border-border-subtle text-text-muted font-mono">J</kbd>
          </div>
        </div>
      </div>
    </section>
  );
}
