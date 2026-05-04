"use client";

import {
  Calendar,
  Clock,
  Users,
  CalendarDays,
} from "lucide-react";
import { StubPage } from "@/components/shared/StubPage";
import { FeatureDisabled } from "@/components/shared/FeatureDisabled";
import { useCockpitFeatures } from "@/hooks/use-api";

export default function AgendaPage() {
  const { data: cockpitFeatures, loading } = useCockpitFeatures();
  if (!loading && cockpitFeatures && cockpitFeatures.features.agenda !== true) {
    return <FeatureDisabled featureKey="agenda" tenantSlug={cockpitFeatures.tenant} />;
  }
  return (
    <StubPage
      title="Agenda"
      subtitle="Rendez-vous & échéances"
      objective="Vue calendrier des rendez-vous, appels, échéances projet et tâches datées. Vue jour, semaine et mois, avec liaison au CRM et aux conversations."
      cards={[
        {
          title: "Rendez-vous",
          description:
            "Tous les événements agenda Dolibarr (RDV physiques, appels, visio) tous tenants confondus.",
          icon: Calendar,
        },
        {
          title: "Échéances",
          description:
            "Tâches avec date d'échéance, devis à valider, factures à émettre. Codage couleur selon urgence.",
          icon: Clock,
        },
        {
          title: "Vue par client",
          description:
            "Filtrage des événements et échéances par client pour voir l'historique complet d'une relation.",
          icon: Users,
        },
        {
          title: "Vues semaine / mois",
          description:
            "Affichage calendrier classique avec navigation temporelle. Cliquer sur un événement pour ouvrir le détail.",
          icon: CalendarDays,
        },
      ]}
      nextBlockNote="Cette page sera activée au Bloc 5E — vue calendrier connectée à Dolibarr agendaevents."
    />
  );
}
