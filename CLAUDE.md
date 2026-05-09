# CLAUDE.md — mybotia-app

> Cockpit collaborateur de l'écosystème MyBotIA. Consomme `mybotia-business` (socle métier).

## Doctrine produit (09/05/2026)

`mybotia-business` est le **socle métier modulaire multi-tenant** — pas un CRM. CRM, Pipeline, Productions, Finance, Logistics, Partners, Commissions sont des **modules** activables par tenant via `core.tenant_modules`. La sidebar et les pages de `mybotia-app` dépendent des modules actifs sur le tenant courant : aucun affichage universel par défaut. Vocabulaire obligatoire en UI : "**Affaire**" avant signature, "**Production**" après signature ("Projet" interdit côté produit, toléré uniquement comme nom de table SQL technique). Une Production porte par défaut du **one-shot ET du récurrent** simultanément (site = livraison + maintenance ; collab IA = conception 600€/jour + abos tokens + abo sur mesure) — afficher les deux colonnes même si une est à 0.

Référence canonique : `mybotia-business/docs/LEXIQUE.md` + `mybotia-business/ROADMAP.md` (section "Doctrine 09/05/2026").

@AGENTS.md
