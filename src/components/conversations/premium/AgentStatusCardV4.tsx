"use client";

import { AgentAvatar } from "@/components/shared/AgentAvatar";

const AGENT_ROLES: Record<string, { role: string; tagline: string }> = {
  lea: {
    role: "Collaboratrice IA MyBotIA",
    tagline: "Assistante quotidienne — CRM, mails, documents",
  },
  max: {
    role: "Collaborateur IA VL Medical",
    tagline: "Admin, juridique, devis, factures",
  },
  lucy: {
    role: "Collaboratrice IA IGH",
    tagline: "Relation client, EHPAD, résidences",
  },
  raphael: {
    role: "Agent personnel CMB Conseil",
    tagline: "Juridique, fiscal, drive, CRM",
  },
  maria: {
    role: "Collaboratrice IA Esprit Loft",
    tagline: "Coordination, rendez-vous, docs",
  },
  damien: {
    role: "Assistant infrastructure",
    tagline: "DevOps, sysadmin, tooling MyBotIA",
  },
};

/**
 * Carte présence agent — version compacte affichable dans le header chat.
 * Avatar + nom + rôle + statut "En ligne" avec point pulsing.
 * Le tier modèle est affiché en sobre (Standard / Premium), jamais le nom du modèle (doctrine UB).
 */
export function AgentStatusCardV4({
  agentId,
  agentName,
  modelTier,
  className,
}: {
  agentId: string;
  agentName: string;
  modelTier?: "standard" | "premium" | null;
  className?: string;
}) {
  const meta = AGENT_ROLES[agentId] ?? {
    role: "Collaborateur IA",
    tagline: "",
  };

  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <div className="relative shrink-0">
        <AgentAvatar agentId={agentId} size={36} className="rounded-full" />
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-status-success border-2 border-surface-1"
          aria-label="En ligne"
        />
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-status-success animate-pulse-ring" />
      </div>
      <div className="flex flex-col leading-tight min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary truncate">
            {agentName}
          </span>
          {modelTier === "premium" && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-accent-primary/80 px-1.5 py-0.5 rounded bg-accent-primary/10">
              Premium
            </span>
          )}
        </div>
        <span className="text-[11px] text-text-muted truncate">{meta.role}</span>
      </div>
    </div>
  );
}
