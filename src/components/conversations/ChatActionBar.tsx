"use client";

// Bloc 4D — Action Cards métier sous chaque réponse assistant.
// Génère dynamiquement des actions selon le contexte du message :
//  - clientContext actif (issue d'un seed CRM)        → "Voir fiche client"
//  - références PDF détectées dans le contenu        → "Résumer {kind} {ref}"
//  - toujours                                          → "Chercher dans la KB / Archive"
//  - clientContext actif                              → "Préparer une tâche brouillon"
//
// Règle stricte : aucune action write directe. Les actions sont :
//  - "navigate"  : router.push vers une URL interne (lecture)
//  - "prompt"    : envoie un message à l'agent qui applique sa doctrine
//                  (notamment doctrine "GO Gilles" pour les actions sensibles)

import Link from "next/link";
import {
  ExternalLink,
  Sparkles,
  Database,
  Archive,
  ListTodo,
  FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { detectDocumentReferences } from "@/components/shared/DocumentCard";

interface ActionItem {
  key: string;
  label: string;
  title?: string;
  icon: React.ComponentType<{ className?: string }>;
  // navigate = lien interne; prompt = envoyer un message à l'agent
  kind: "navigate" | "prompt";
  href?: string;
  prompt?: string;
}

export function ChatActionBar({
  agentName,
  messageContent,
  clientContext,
  onSeedPrompt,
}: {
  agentName?: string;
  messageContent: string;
  clientContext?: { id: string; name: string } | null;
  onSeedPrompt?: (text: string) => void;
}) {
  const refs = detectDocumentReferences(messageContent);
  const actions: ActionItem[] = [];
  const agentLabel = agentName || "Léa";

  // 1) Voir fiche client si conv contextualisée
  if (clientContext) {
    actions.push({
      key: "view-client",
      label: `Voir fiche ${clientContext.name}`,
      icon: ExternalLink,
      kind: "navigate",
      href: `/crm/${encodeURIComponent(clientContext.id)}`,
      title: "Ouvre la fiche CRM complète du client",
    });
  }

  // 2) Résumer chaque ref PDF mentionnée (max 3 pour ne pas saturer)
  for (const { ref, kind } of refs.slice(0, 3)) {
    const label = kind === "facture" ? "facture" : "devis";
    actions.push({
      key: `summarize-${kind}-${ref}`,
      label: `Résumer ${label} ${ref}`,
      icon: FileSearch,
      kind: "prompt",
      prompt: `Résume en 5 lignes maximum la ${label} ${ref} : client, montant, statut, points d'attention. Ne contacte personne.`,
      title: `${agentLabel} produira un résumé contextuel`,
    });
  }

  // 3) Chercher dans la KB MyBotIA (toujours dispo)
  actions.push({
    key: "search-kb",
    label: "Chercher dans la KB",
    icon: Database,
    kind: "prompt",
    prompt:
      "Cherche dans la KB MyBotIA (visibility_filter=tenant:mybotia) ce qui peut éclairer le contexte courant et résume en 5 lignes max.",
    title: `${agentLabel} appellera kb_search sur tenant:mybotia`,
  });

  // 4) Chercher dans l'archive (toujours dispo)
  actions.push({
    key: "search-archive",
    label: "Chercher dans l'archive",
    icon: Archive,
    kind: "prompt",
    prompt:
      "Cherche dans ton archive mémoire (visibility_filter=private:lea) un élément historique pertinent pour le contexte courant et résume en 5 lignes max. Distingue actuel/historique.",
    title: `${agentLabel} appellera kb_search sur private:lea`,
  });

  // 5) Préparer tâche brouillon — uniquement si client courant.
  //    Léa applique sa doctrine "brouillon → GO Gilles → exécution" : aucune
  //    écriture Dolibarr déclenchée par ce bouton, juste un brouillon affiché
  //    en chat que Gilles validera explicitement.
  if (clientContext) {
    actions.push({
      key: "draft-task",
      label: "Préparer une tâche brouillon",
      icon: ListTodo,
      kind: "prompt",
      prompt: `Prépare un BROUILLON de tâche pour le client "${clientContext.name}" (ID ${clientContext.id}) : titre, description courte, priorité suggérée, échéance si pertinente. Ne crée RIEN dans Dolibarr — affiche juste le brouillon en attendant mon GO explicite.`,
      title: `${agentLabel} prépare un brouillon, validation Gilles requise avant création`,
    });
  }

  if (actions.length === 0) return null;

  function handlePrompt(prompt: string) {
    if (!onSeedPrompt) return;
    onSeedPrompt(prompt);
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      <span className="inline-flex items-center text-[10px] uppercase tracking-wider text-text-muted/70 font-semibold mr-1">
        <Sparkles className="w-3 h-3 mr-1" />
        Actions
      </span>
      {actions.map((a) => {
        const Icon = a.icon;
        const baseClass = cn(
          "inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-tight transition-all border",
          "text-accent-glow hover:text-text-primary bg-accent-primary/10 hover:bg-accent-primary/20 border-accent-primary/20"
        );

        if (a.kind === "navigate" && a.href) {
          return (
            <Link key={a.key} href={a.href} title={a.title} className={baseClass}>
              <Icon className="w-3 h-3" />
              {a.label}
            </Link>
          );
        }

        const disabled = !onSeedPrompt;
        return (
          <button
            key={a.key}
            type="button"
            onClick={() => a.prompt && handlePrompt(a.prompt)}
            disabled={disabled}
            title={a.title}
            className={cn(
              baseClass,
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Icon className="w-3 h-3" />
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
