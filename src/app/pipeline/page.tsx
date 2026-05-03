"use client";

import {
  TrendingUp,
  Target,
  Sparkles,
  ListChecks,
} from "lucide-react";
import { StubPage } from "@/components/shared/StubPage";

export default function PipelinePage() {
  return (
    <StubPage
      title="Pipeline"
      subtitle="Pipeline commercial"
      objective="Vue dédiée au pipeline commercial avec colonnes par étape (découverte → proposition → négociation → closing → gagné/perdu). Cartes cliquables pour ouvrir le détail d'une opportunité, modifier l'étape, le montant ou la probabilité."
      cards={[
        {
          title: "Pipeline commercial",
          description:
            "Kanban des opportunités en cours par étape. Source : Dolibarr (projets avec opp_amount > 0, mappés via opp_status).",
          icon: TrendingUp,
        },
        {
          title: "Détail opportunité",
          description:
            "Drawer latéral à l'ouverture d'une carte : titre, client, montant, probabilité, échéance, tâches liées, devis associés.",
          icon: Target,
          note: "Arrive au Bloc 5B (cards cliquables + drawer)",
        },
        {
          title: "Actions prochaines",
          description:
            "Boutons par carte : modifier étape, créer tâche, préparer devis, parler à Léa de cette opportunité.",
          icon: ListChecks,
          note: "Pattern réutilisé du Bloc 4D (ChatActionBar)",
        },
        {
          title: "Drag-and-drop",
          description:
            "Déplacement d'une carte d'une colonne à l'autre déclenche une mise à jour Dolibarr (opp_status). Toast de confirmation et rollback UI en cas d'erreur API.",
          icon: Sparkles,
          note: "Arrive au Bloc 5C, après validation des cards cliquables",
        },
      ]}
      nextBlockNote="Cette page sera activée progressivement : Bloc 5B (cards cliquables) puis Bloc 5C (drag-and-drop avec persistance Dolibarr)."
    />
  );
}
