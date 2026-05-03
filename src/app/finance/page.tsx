"use client";

import {
  FileText,
  Receipt,
  Bell,
  Wallet,
} from "lucide-react";
import { StubPage } from "@/components/shared/StubPage";

export default function FinancePage() {
  return (
    <StubPage
      title="Finances"
      subtitle="Devis, factures, paiements"
      objective="Vue financière transverse : suivi des devis émis, factures clients/fournisseurs, paiements en attente et relances à effectuer. Lecture seule en V1, actions sensibles toujours sous validation explicite."
      cards={[
        {
          title: "Devis",
          description:
            "Liste des devis tous statuts (brouillon, envoyé, signé, refusé). Total, validité, client, lien vers le PDF.",
          icon: FileText,
        },
        {
          title: "Factures",
          description:
            "Factures clients et fournisseurs. Filtres par statut (impayée, payée, partiellement réglée), par client, par date.",
          icon: Receipt,
        },
        {
          title: "Relances",
          description:
            "Factures impayées avec ancienneté. Préparation d'un brouillon de relance par Léa, validation Gilles requise avant envoi.",
          icon: Bell,
          note: "Aucun envoi automatique — règle d'envoi externe stricte",
        },
        {
          title: "Paiements à venir",
          description:
            "Vue des encaissements attendus à 7, 30, 60 jours. Aide à la trésorerie quotidienne.",
          icon: Wallet,
        },
      ]}
      nextBlockNote="Cette page sera activée plus tard, après stabilisation des Blocs 5B-5E. Aucune action comptable ne sera automatisée — toutes les écritures financières restent sous validation explicite."
    />
  );
}
