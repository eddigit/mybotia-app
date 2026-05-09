# UX cockpit final — review V1.1.E

Périmètre audité (statique, lecture seule) :

- `src/app/page.tsx` (Tableau de bord)
- `src/app/affaires/page.tsx` + `[id]/page.tsx`
- `src/app/productions/page.tsx` + `[id]/page.tsx`
- `src/app/finance/page.tsx`
- `src/app/today/page.tsx`
- `src/app/agenda/page.tsx`
- `src/app/admin/tenants/page.tsx` + `[slug]/page.tsx`
- `src/app/admin/modules/page.tsx`
- `src/components/layout/{LeftSidebar,TopBar,TenantSwitcher,MobileNavDrawer}.tsx`
- Composants partagés appelés (ModuleHeader, EmptyState, MetricCard) — examinés au passage parce qu'ils déterminent la cohérence du cockpit.

Méthode : lecture du JSX/CSS uniquement, aucun rendu navigateur. Notes données sur chacun des 9 critères, somme honnête, aucune supposition non vérifiable depuis le code.

---

## Score global : 67 / 100

| # | Critère | Note /10 | Justification courte |
|---|---|---|---|
| 1 | Cohérence visuelle (titres H1, espacement, typo) | 7 | `ModuleHeader` est utilisé sur 6 pages sur 9. Le Tableau de bord et `productions/[id]` n'utilisent pas `ModuleHeader` (header inline custom). `today` rend un titre via `ModuleHeader` mais ajoute des `SectionHeader` locaux non partagés. Padding pas homogène : `p-8` (home, today, finance, admin) vs `p-4 sm:p-8` (affaires, productions, fiches détail). |
| 2 | Hiérarchie information (KPI primaires en haut) | 8 | Pattern KPI strip cohérent sur Today (4 KPI), Finance (3 KpiCard), Home (1 hero + 4 MetricCard). Affaires et Productions n'ont pas de KPI strip — uniquement filtres + liste, ce qui est défendable mais asymétrique avec Finance/Home. |
| 3 | Empty states (actionnables, pas juste "Aucune donnée") | 8 | Bon globalement : `EmptyState` partagé avec icône + titre + description + CTA est utilisé sur `affaires`, `productions`, `productions/[id]` (factures). Finance subscriptions et invoices fournissent un CTA explicite. Today utilise `EmptyHint` (juste un texte italique) — incohérent avec le reste, sans CTA. Affaires/[id] devis associés affiche un `<p italic>` sans CTA non plus. Agenda = `StubPage` "next bloc 5E" — honnête mais pollue le score si pris au sens strict. |
| 4 | Loading states (skeletons cohérents) | 5 | Pas de skeletons, uniquement des spinners `Loader2` centrés (`w-6 h-6 animate-spin text-accent-glow`). Cohérents entre eux mais primitifs : aucune carte ne reste en place pendant le fetch, l'utilisateur voit le layout sauter quand le data arrive. `TenantSwitcher` est la seule exception (placeholder pulse). Aucun skeleton sur les tables (`affaires`, `finance`, `admin/modules`). |
| 5 | Mobile (≤768px : drawer + cards + KPI colonne) | 7 | Drawer mobile correctement câblé (`MobileNavDrawer` + variant=mobile sur `LeftSidebar`). Tables → cards bien gérées sur `affaires`, `finance` (subs + invoices), `productions/[id]` (subs). MAIS : `admin/tenants` table sans variante mobile (overflow-x scroll), `admin/modules` matrice X-tenants avec sticky col — usable mais punitif sur mobile, `today` cards 2 colonnes en mobile pour KPI (OK), aucun rappel responsive sur l'éditeur Modèle économique JSON (textarea pleine). |
| 6 | Branding tenant (primaryColor utilisée partout) | 6 | Bien injecté dans `LeftSidebar` (logo + bordure tintée, active state = `hexAlpha(primaryColor, 0.2)`) et `TenantSwitcher` (badge + tint). MAIS le reste du cockpit est verrouillé sur `accent-primary` / `accent-glow` (tokens globaux MyBotIA) : `ModuleHeader`, `MetricCard`, KPI cards Finance/Today, badges stages affaires, boutons CTA partout — aucun ne consomme `primaryColor`. Si un cockpit IGH (vert) ou VLM (bleu médical) est sélectionné, seule la sidebar change. Aucune classe Tailwind `[--accent: var(...)]` n'est exposée pour propager. |
| 7 | Vocabulaire FR (pas de "Project", "Settings" résiduels) | 7 | Globalement bon : "Affaires", "Productions", "Trésorerie", "Préférences" (au lieu de Settings) dans la sidebar. Mais résidus visibles : `today/page.tsx` ligne 311 affiche le `stage` brut anglais (`discovery`, `proposal`, `negotiation`, `closing`) en uppercase font-mono ; `today/page.tsx` ligne 370 affiche `p.status` brut pour les devis ; `productions/[id]` `Owner` reste en anglais (label de carte) et expose `ownerUserId` en clair (UUID) ; `admin/tenants` colonne "Profile" garde la valeur DB brute (`classic`, `custom`) ; `affaires/[id]` ligne 247 affiche `Lifecycle : ${affaire.lifecycle_stage}` (terme tech). |
| 8 | Densité info (pas surcharge ni vide) | 7 | Home dense mais lisible (bento + side stack). Today très dense (6 sections empilées) mais structuré. Finance/page fait défiler 4 sections + 2 sub-sections + footer = lourd, page longue. Productions liste correctement groupée par stage. Admin/tenants ligne par tenant compact. Admin/modules matrice X×Y devient illisible >5 tenants (pas de filtre par catégorie module). Les fiches détail [id] sont équilibrées. |
| 9 | Accessibilité (aria, contrastes, focus) | 6 | Présent : `aria-label` sur burger menu et toggle sidebar, `aria-expanded` + `aria-haspopup` sur TenantSwitcher, `role="dialog" aria-modal` sur drawer, `role="listbox"` + `role="option"` sur dropdown switcher, `role="status"` sur toast switcher. Manquants : aucun `<h1>` sur la home (le titre est dans `CommandCenterHero`, non audité ici), `ModuleHeader` produit un `<h1>` correct ; tables `affaires`/`finance` sans `<caption>` ni `aria-label` ; boutons `Actualiser` (TopBar) sans `aria-label` ; iconographie sans `aria-hidden` sur la majorité des icons décoratives ; les états de focus reposent sur `focus:ring-1 focus:ring-accent-primary/40` sur les inputs mais pas sur les boutons (focus visible discutable, contraste à vérifier en dark). Pas de `prefers-reduced-motion` sur les `animate-spin` et `animate-pulse`. |

Total : **67/100** (7+8+8+5+7+6+7+7+6).

---

## Forces top-5

1. **Doctrine empty state respectée** : `EmptyState` partagé + valeurs `"—"` côté Home/Today quand backend partiel (`honestStr`, `fmtCount`). Aucune valeur "0" mensongère, aucun mock — la doctrine "jamais de mock" tient.
2. **Cohérence sémantique des stages affaires/productions** : mêmes maps `STAGE_LABEL` / `STAGE_COLOR` partagées entre `affaires/page`, `affaires/[id]`, `productions/page`, `productions/[id]`. Les badges sont visuellement identiques d'une page à l'autre — l'utilisateur ne ré-apprend rien.
3. **TenantSwitcher** : un des points hauts du cockpit. Loading skeleton, error tooltip, dropdown clavier (Escape, focus management), toast feedback succès/erreur, badge couleur + initiales calculées proprement. C'est le seul composant qui matérialise le branding tenant fortement.
4. **Mobile drawer + responsiveness des tables business** : `LeftSidebar` variant=mobile + `MobileNavDrawer` est cleanement séparé, `affaires` / `finance subs+invoices` / `productions/[id] subs` ont une variante card mobile honnête (pas un overflow-x rageant).
5. **Honnêteté technique** : commentaires en haut de chaque page documentent les limites V1.1.D/E ("audit non livré", "billing_mode pas persisté", "branding lecture seule"). Quand une feature manque, le code l'écrit dans un empty state ou une note italic — l'utilisateur n'est pas trompé.

---

## Faiblesses top-10 (avec sévérité)

| ID | Page | Problème | Sévérité | Reco |
|---|---|---|---|---|
| F1 | `today/page.tsx:311,370` | Stages affaires en anglais brut affichés en UI (`discovery`, `proposal`, `negotiation`, `closing`, statuts devis bruts) | Haute | Réutiliser `STAGE_LABEL` (déjà importé sur affaires) ; créer `lib/labels.ts` partagé |
| F2 | toutes pages | Aucun skeleton sur les tables ; spinner full-screen casse la perception de continuité | Haute | Ajouter `<TableSkeleton rows={5}/>` partagé, l'utiliser sur affaires, finance, admin |
| F3 | `ModuleHeader.tsx`, `MetricCard.tsx`, KPI Finance/Today | `accent-primary` codé en dur partout — branding tenant ne descend pas dans le contenu | Haute | Exposer `--brand-primary` en CSS var sur `<html>` selon cockpit, remplacer `accent-primary` par `var(--brand-primary)` dans les composants partagés |
| F4 | `today/page.tsx` | `EmptyHint` (texte italic plat) au lieu de `EmptyState` partagé sur 6 sections | Moyenne | Migrer vers `EmptyState` avec icône + CTA quand applicable (ex : "Créer une tâche" sur Priorités vide) |
| F5 | `productions/[id]/page.tsx:454` | `Owner` exposé en UUID brut (`ownerUserId`) — illisible pour l'utilisateur | Moyenne | Résoudre via `useUsers()` ou afficher "—" si non résolu, jamais l'UUID |
| F6 | `admin/modules/page.tsx` | Matrice modules × tenants illisible >5 tenants, pas de filtre par catégorie ni search | Moyenne | Ajouter filtre catégorie + search module, virtualiser si >20 modules |
| F7 | `affaires/[id]/page.tsx:247`, header subtitle | `Lifecycle : production` exposé tel quel (jargon dev) | Moyenne | Soit retirer, soit traduire ("Étape : signée" / "Étape : en production") |
| F8 | `finance/page.tsx` | Page longue (4 sections empilées sur ~700 lignes) sans navigation interne ni anchors visibles | Moyenne | Ajouter une nav interne sticky (KPI, Graph, Détail mensuel, Abonnements, Factures) ou tabs |
| F9 | `LeftSidebar.tsx:113-114` | Devis/Factures pointent sur `/finance#devis` et `/finance#factures` mais ces ancres n'existent pas dans `finance/page.tsx` (sections `<section>` sans `id="devis"` ou `id="factures"`) — clic fait recharger la page sans scroll | Haute | Ajouter `id="devis"` à `RecentInvoicesSection` (mal nommée si elle accueille devis) ou créer routes dédiées V1.2 |
| F10 | TopBar `Bell` (notifications) ligne 73 | Icône notification visible mais aucun comportement (commentaire `placeholder`) | Faible | La masquer derrière `process.env.NEXT_PUBLIC_NOTIF_ENABLED` tant que pas livré, sinon l'utilisateur clique dans le vide |

---

## Recommandations actionnables cette semaine (5 max)

| Reco | Fichier:ligne | Effort | Impact UX |
|---|---|---|---|
| Centraliser le mapping stage/status FR (`STAGE_LABEL`, statuts devis/factures, billing_mode) dans `src/lib/labels.ts` et le réutiliser partout, supprimer toute exposition brute en uppercase | nouveau `src/lib/labels.ts` ; refactor `today/page.tsx:311,370`, `productions/[id]/page.tsx:454`, `affaires/[id]/page.tsx:247` | 2 h | Cohérence FR ; corrige F1, F5, F7 d'un coup |
| Créer `<TableSkeleton>` + `<CardSkeleton>` partagés et les substituer aux spinners full-page des listes | nouveau `src/components/shared/Skeletons.tsx` ; refactor `affaires/page.tsx:300-304`, `finance/page.tsx:191-195`, `admin/modules/page.tsx:198-201`, `admin/tenants/page.tsx:76-82` | 3 h | Perception de réactivité divisée par 2 ; corrige F2 |
| Réparer ou retirer les ancres `/finance#devis` / `/finance#factures` de la sidebar | `LeftSidebar.tsx:112-114` (sidebar) + `finance/page.tsx:288, 502` (ajouter `id="devis"` et `id="factures"` aux `<section>`) | 30 min | Évite des liens morts dans la nav principale ; corrige F9 |
| Migrer les 6 `EmptyHint` de Today vers `EmptyState` avec CTA contextuel ("Nouvelle tâche", "Ouvrir le pipeline", etc.) | `today/page.tsx:475-477` (composant) + 6 sites d'appel | 1 h | Aligne Today sur le reste du cockpit ; corrige F4 |
| Exposer `--brand-primary` (et un alias `--brand-glow`) dans `app/layout.tsx` côté serveur depuis le tenant courant, et remplacer `accent-primary`/`accent-glow` par `var(--brand-primary)`/`var(--brand-glow)` dans `ModuleHeader`, `MetricCard`, boutons CTA primaires | `src/app/layout.tsx` (style inline `:root`), `globals.css` (déclaration vars), `ModuleHeader.tsx`, `MetricCard.tsx` | 4 h | Branding tenant cohérent jusqu'au contenu ; corrige F3 |

---

## Recommandations V1.2+

- **Skeletons granulaires par bloc** (KPI strip skeleton, table skeleton, card skeleton) servis depuis le composant qui charge — éviter le full-page spinner.
- **Tabs ou sticky-nav interne** sur Finance et `admin/tenants/[slug]` (les deux pages les plus longues, >500 lignes de JSX). Sur `admin/tenants/[slug]`, 11 sections empilées dont plusieurs très techniques (architecture, catalogue, stock, livraisons, transport, VLM) — un layout en onglets serait plus utilisable.
- **Empty state agenda** : remplacer le `StubPage` par une vraie vue calendrier vide ("Aucun événement cette semaine") dès que le module DB existe, ne pas afficher `nextBlockNote` côté produit.
- **A11y systématique** : audit `axe-core` ciblé sur ces 9 pages, ajout de `aria-hidden` sur les icônes décoratives, focus visible explicite sur les boutons (`focus-visible:ring-2`), respect de `prefers-reduced-motion` sur les animations.
- **Détection notifications** : retirer ou activer la cloche TopBar (F10).
- **Densité Finance** : envisager une vue "compacte" (12 mois en 1 ligne tabulaire) vs "détaillée" (graphique + tableau) avec un toggle.
- **Vocabulaire admin** : profile `classic`/`custom` → "Standard"/"Dédié", lifecycle `production`/`affaire` → "Phase production"/"Phase commerciale".
- **Branding propagation V2** : utiliser `tenant_branding.logo_url` partout, pas seulement sidebar ; brander la TopBar (badge tenant à droite) pour rappeler dans quel cockpit on est, en plus de la sidebar.
- **Console modules** : ajouter une vue "par catégorie" (group by `category`) en plus de la matrice plate.
- **Mobile admin** : `admin/tenants` et `admin/modules` ne sont pas pensés mobile — soit les masquer en `<768px` (acceptable, ce sont des outils superadmin desktop), soit livrer une vue cards.

---

## Captures recommandées Gilles (8-10)

1. **Tableau de bord (`/`) — desktop 1440px**, cockpit MyBotIA, en pleine charge (pour voir le bento Sovereign + KPI strip + activity feed).
2. **Tableau de bord — mobile 375px**, sidebar fermée, drawer ouvert (vérifier que la grid bento se replie en colonne).
3. **Affaires (`/affaires`) — desktop**, avec >3 lignes et un filtre stage actif (vérifier les badges colorés et la cohérence des couleurs entre la pill du filtre et la cellule du tableau).
4. **Affaires — mobile**, vue cards avec une affaire à 25k€ pour voir le formattage `formatMoneyCompactFR` et la troncation des titres longs.
5. **Affaire détail (`/affaires/[id]`) — desktop**, sur une affaire avec ≥1 devis lié (pour voir simultanément badge stage, montants one-shot/MRR, devis associés, boutons Modifier/Marquer signée/Abandonner).
6. **Productions (`/productions`) — desktop** avec filtre billing_mode actif (révèle la latence du lazy fetch + le loader inline).
7. **Trésorerie (`/finance`) — desktop**, exercice courant, avec MRR > 0 + au moins 2 mois de bars stack (pour voir le graph avec les couleurs primaires/translucides) ; bonus mobile pour vérifier le repli des cards subs+invoices.
8. **Today (`/today`) — desktop**, en milieu de journée, idéalement avec ≥1 tâche en retard, ≥1 alerte (cohérence des `SectionHeader` + densité 6 sections).
9. **Admin tenants (`/admin/tenants`) — desktop superadmin**, avec ≥3 tenants pour voir la table compacte + badges branding.
10. **Admin tenant détail (`/admin/tenants/mybotia`)** — desktop superadmin scroll complet (vérifier cohérence des 11 sections, longueur de page, sticky footer "Enregistrer features / business model").

---

*Audit statique réalisé le 2026-05-09. Non-objectif : valider le rendu navigateur, l'a11y dynamique, la performance ou les régressions backend. Les notes reflètent uniquement la lecture du code TypeScript/JSX sur les fichiers listés.*
