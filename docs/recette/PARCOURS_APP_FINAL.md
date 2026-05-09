# PARCOURS_APP_FINAL — Recette parcours utilisateur cible app.mybotia.com

> Date : 2026-05-09
> Périmètre : V1.1.E — `mybotia-app` `f00499c` / `mybotia-business` `a5691f6`
> Tenant cible : `mybotia` (feature `productions=true` activée ce matin)
> URL racine : **https://app.mybotia.com** (port 3010)
> Backend technique (non utilisateur) : `crm.mybotia.com`
>
> Objectif : Gilles doit pouvoir réaliser ce parcours **de bout en bout sans
> jamais quitter app.mybotia.com**. Toute étape qui requiert encore
> `crm.mybotia.com` est listée dans la section « Gaps détectés ».

---

## Pré-requis

- Session active sur `app.mybotia.com` (SSO `gilleskorzec@gmail.com`, superadmin).
- Cockpit courant = `mybotia` (TenantSwitcher en haut de la sidebar).
- Modules activés sur tenant `mybotia` : `crm`, `pipeline`, `productions`,
  `finance`, `tasks`, `documents`, `agenda`, `pdf`, `adminTools`.
- Au moins 1 client + 1 devis existant pour le tenant `mybotia` (sinon
  étapes 3, 4 et 7 seront bloquées par les contrôles métier).

---

## Étape 1 — Voir les modules activés du tenant

| | |
|---|---|
| **URL** | `https://app.mybotia.com/admin/tenants/mybotia` |
| **Action UI** | Naviguer via sidebar bas → bloc Admin → « Tenants » → carte `mybotia`, OU saisir l'URL directement. Dérouler la section « Modules ». |
| **Attendu visuel** | Header branding `MyBotIA` (logo + couleur primaire) + slug `mybotia` + badge statut. Section **Modules** : matrice des 9 modules registry avec toggle ON/OFF coloré. `productions` doit être en **ON** (state vert + cocher). Sections suivantes : Branding (lecture seule), Features cockpit (whitelist), Modèle économique 890€ (édition JSON), Architecture / Catalogue / Stock / Livraisons / Transport / VLM (panels conditionnels), Audit log (20 dernières lignes). |
| **Données utilisées** | `tenants.mybotia` + `tenant_modules` (registry biz) + `audit_log`. Modèle éco = doctrine V3 Usage Billing (mybotia 890€). |
| **KO si** | (a) page blanche / 403 (perte du rôle superadmin) ; (b) `productions` apparaît OFF ; (c) toggle inopérant (PATCH ne renvoie pas 2xx) ; (d) section Modules absente (= V1.1.E pas livré). |
| **Composants UI clés** | `ModuleHeader` · `TenantModulesSection` · `TenantAuditLogSection` · `ArchitectureSection` · `SubscriptionsSection` · panels admin existants. |
| **Endpoints sollicités** | `GET /api/admin/tenants/mybotia` · `GET /api/admin/tenants/mybotia/modules` · `GET /api/admin/tenants/mybotia/audit-log`. |

---

## Étape 2 — Voir le pipeline / Affaires

| | |
|---|---|
| **URL** | `https://app.mybotia.com/affaires` |
| **Action UI** | Sidebar → Commercial → « Pipeline ». |
| **Attendu visuel** | `ModuleHeader` Pipeline + bouton primaire **« Nouvelle affaire »** (Plus icon). Filtres : multi-select stages (lead/qualified/active/paused/won/lost/abandoned), recherche titre/client, tri (créée / due / potentiel). Table desktop ≥768px (cards mobile <768px) listant les affaires avec colonnes : Titre, Client, Stage (badge coloré), Owner, Date close prévue, MRR HT, One-shot HT. Chaque ligne cliquable → `/affaires/[id]`. Empty state actionnable si vide (« Créer la première affaire »). |
| **Données utilisées** | `projects.lifecycle_stage='affaire'` côté biz, scoping tenant `mybotia` via `resolveCockpitTenants`. |
| **KO si** | (a) `FeatureDisabled` (= module `pipeline` OFF, à corriger en étape 1) ; (b) `crm_provider_not_business` (CRM router pointe encore vers Dolibarr) ; (c) fallback projets legacy (= mock interdit doctrine) ; (d) bouton « Nouvelle affaire » absent. |
| **Composants UI clés** | `ModuleHeader` · `CreateAffaireModal` (déclenché par bouton) · `FeatureDisabled` · `EmptyState` · `ErrorState`. |
| **Endpoints sollicités** | `GET /api/affaires` (proxy → biz `/api/v1/affaires`) · `GET /api/clients` · `GET /api/me/cockpit-features`. |

---

## Étape 3 — Créer une affaire

| | |
|---|---|
| **URL** | `https://app.mybotia.com/affaires` (modale) |
| **Action UI** | Cliquer « Nouvelle affaire » → `CreateAffaireModal` s'ouvre. Remplir : Titre (req), Client (dropdown UUID req), Stage (défaut `lead`), Owner (optionnel), Date close prévue, One-shot HT, MRR HT, Description. Submit. |
| **Attendu visuel** | Modale `FormModal` avec validation Zod inline, boutons primaire/secondaire. Toast succès. Fermeture modale + ligne ajoutée en tête de la liste `/affaires`. Si submit serveur KO (`validation_error`, `feature_disabled`, `crm_provider_not_business`) → message rouge ciblé sur le champ ou banner inline. |
| **Données utilisées** | `tenant_id=mybotia` (jamais frontend-supplied : injecté serveur) · `client_id` issu de `/api/clients` scopé. |
| **KO si** | (a) modale ne s'ouvre pas ; (b) dropdown client vide alors qu'il existe des clients (= scoping cassé) ; (c) submit OK mais affaire absente de la liste après refresh ; (d) `tenant_id` apparaît dans le payload réseau côté front (interdit par Business Connector Protocol). |
| **Composants UI clés** | `CreateAffaireModal` · `FormModal` · `FormField` · `Toast`. |
| **Endpoints sollicités** | `POST /api/affaires` (proxy → biz) · `GET /api/clients?tenant=mybotia`. |

---

## Étape 4 — Signer une affaire (mixed billing)

| | |
|---|---|
| **URL** | `https://app.mybotia.com/affaires/[id]` |
| **Action UI** | Depuis `/affaires`, cliquer la ligne créée à l'étape 3 → fiche détail. Bouton **« Marquer comme signée »** → `SignAffaireModal`. Renseigner : devis accepté (`acceptedQuoteId` UUID, dropdown des devis liés au client), `billingMode` = **mixed**, `oneshotAmountHt`, `signedAt`, et au moins 1 ligne d'abonnement (label + MRR HT + cycle monthly/quarterly/yearly + date début). Submit. |
| **Attendu visuel** | Fiche détail header : titre affaire, badge stage, client, owner, dates, montants. Bouton « Marquer comme signée » visible si stage permet (`lead`/`qualified`/`quoted`/`negotiating`). Modale `SignAffaireModal` : sélecteur billingMode (3 options), bloc one-shot conditionnel, bloc subs avec bouton + (Plus) / suppression (Trash2), récap final formaté FR. Submit OK : toast « Affaire signée », redirect automatique vers `/productions/[id]` (même UUID, lifecycle bascule `affaire → production`). |
| **Données utilisées** | Affaire id (UUID), devis lié `acceptedQuoteId`, lignes subs persistées en `production_subscriptions` côté biz. |
| **KO si** | (a) bouton « Marquer comme signée » absent ; (b) dropdown devis vide alors qu'un devis existe pour ce client ; (c) 409 `already_signed` non transformé en toast lisible ; (d) pas de redirect vers `/productions/[id]` après succès ; (e) MRR / one-shot non visibles dans la production résultante (= mixed billing pas natif). |
| **Composants UI clés** | `SignAffaireModal` · `useQuotesByClient` · `FormModal` · `Toast`. |
| **Endpoints sollicités** | `GET /api/affaires/[id]` · `GET /api/quotes?client_id=...` · `POST /api/affaires/[id]/sign` (proxy → biz). |

---

## Étape 5 — Voir la production créée

| | |
|---|---|
| **URL** | `https://app.mybotia.com/productions/[id]` (atterrissage automatique post-signature) |
| **Action UI** | Arrivée par redirect étape 4. Vérifier les 2 colonnes revenus + bloc factures + bloc abonnements. Tester actions : « Modifier » (`EditProductionModal`), « + abonnement » (`AddSubscriptionModal`). |
| **Attendu visuel** | Header production : icône Hammer, titre, badge stage `active` (vert accent-primary), client résolu, dates. **DEUX colonnes revenus obligatoires** (one-shot HT + récurrent), même à 0€ (doctrine parité CRM). Bloc abonnements : liste subs avec label, MRR HT, cycle, date début, statut. Bloc factures : list factures liées à la production (peut être vide en empty state). Boutons d'action : Modifier (Pencil), + abonnement (Plus), + facture (FilePlus), Archive. Lien « Télécharger devis PDF » (Download icon) si devis lié. |
| **Données utilisées** | `productions` view biz + `production_subscriptions` + `production_invoices` (factures liées). |
| **KO si** | (a) une seule colonne revenus visible ; (b) abonnements créés à l'étape 4 absents ; (c) stage ≠ `active` après sign ; (d) le client n'est pas résolu (UUID brut affiché). |
| **Composants UI clés** | `ModuleHeader` · `EditProductionModal` · `AddSubscriptionModal` · `FeatureDisabled` (si module `productions` OFF). |
| **Endpoints sollicités** | `GET /api/productions/[id]` · `GET /api/productions/[id]/subscriptions` · `GET /api/productions/[id]/invoices` · `GET /api/clients?id=...`. |

---

## Étape 6 — Voir les KPI Finance (MRR, ARR, one-shot, portefeuille)

| | |
|---|---|
| **URL** | `https://app.mybotia.com/finance` |
| **Action UI** | Sidebar → Finance → « Trésorerie ». Optionnellement changer l'année via le sélecteur. |
| **Attendu visuel** | Header `Wallet` « Trésorerie ». Trois KPI tiles : **MRR HT**, **ARR HT** (= MRR×12), **One-shot YTD**. Graphique mensuel sur 12 mois empilant MRR + one-shot. Liste « Abonnements actifs » (`FinanceActiveSubscription`). Liste « Factures récentes » (`FinanceRecentInvoice`). Le MRR/one-shot de l'affaire signée à l'étape 4 doit avoir bougé les KPI. Lien secondaire vers `/finance/kpis` (vue KPI multi-sources legacy Bloc 6C). Ancres `#devis` et `#factures` cibles depuis sidebar. |
| **Données utilisées** | Agrégat biz `finance_summary(year, tenant)` calculé sur `production_subscriptions` + `production_invoices` actifs. |
| **KO si** | (a) `FeatureDisabled` (module `finance` OFF) ; (b) KPI à 0 alors qu'une affaire vient d'être signée ; (c) erreur 500 (provider biz down). |
| **Composants UI clés** | `ModuleHeader` · `FeatureDisabled` · `useFinanceSummary` · `ErrorState`. |
| **Endpoints sollicités** | `GET /api/finance/summary?year=2026` (proxy → biz `/api/v1/finance/summary`). |

---

## Étape 7 — Télécharger un devis PDF

| | |
|---|---|
| **URL** | `https://app.mybotia.com/api/quotes/[id]/pdf` (déclenché depuis lien UI) |
| **Action UI** | Depuis `/affaires/[id]` ou `/productions/[id]`, bloc Devis → bouton **Download** (icône lucide-react `Download`) sur la ligne du devis. Le navigateur télécharge le PDF. |
| **Attendu visuel** | Téléchargement immédiat d'un PDF nommé selon le ref du devis (ex. `DEV-2026-0042.pdf`). Le PDF respecte la charte MyBotIA tenant-scopée (logo + couleur primaire issus de `getTenantBranding('mybotia')`, jamais le mot « Dolibarr ». Headers HTTP `Content-Type: application/pdf`. |
| **Données utilisées** | Devis id (UUID), tenant `mybotia` (provider `mybotia_business`). Branding via `lib/tenant/branding`. |
| **KO si** | (a) HTML renvoyé au lieu d'un PDF (= proxy cassé) ; (b) 403 / 404 ; (c) PDF rendu via fallback Dolibarr legacy `/api/documents/download?modulepart=propale` (= provider mal résolu) ; (d) « MyBotIA » remplacé par « Dolibarr » dans le PDF. |
| **Composants UI clés** | Bouton `Download` (lucide) sur fiche affaire/production. |
| **Endpoints sollicités** | `GET /api/quotes/[id]/pdf` → `proxyBusinessPdf("quotes", id)` → biz `/api/v1/quotes/[id]/pdf`. |

---

## Étape 8 — Piloter agents tenant (Agents IA / Conversations)

| | |
|---|---|
| **URL** | `https://app.mybotia.com/agents` puis `https://app.mybotia.com/conversations` |
| **Action UI** | Sidebar → Agents IA → « Mes agents ». Cliquer une carte agent (Léa) → ouvrir une conversation. Dans `/conversations`, sélectionner un dossier, créer une nouvelle conversation (POST direct serveur, pas tempConv côté front), envoyer un message, vérifier le streaming SSE. |
| **Attendu visuel** | `/agents` : `ModuleHeader` « Collaborateurs IA », bandeau résumé « N en ligne / occupé / écoute / hors ligne », total tâches, grille `AgentPresenceCard` 1/2/3 colonnes responsive. Status par agent (online/listening/busy/offline) avec couleurs (emerald/cyan/amber/zinc). `/conversations` : workspace V4 (`ConversationsV4Workspace`), arborescence Folders/Projects à gauche, liste conversations, panneau messages avec streaming. Création conversation : appel serveur d'abord (POST `/api/conversations` avec `folderId/projectId`), affichage ensuite (cf. CHAT-4B doctrine). |
| **Données utilisées** | Agents scope tenant cockpit, dispatched depuis MCP MyBotIA + state bridge. Conversations en `core` schema scopé tenant. |
| **KO si** | (a) agents d'un autre tenant visibles (= leak isolation tenant) ; (b) tempConv reapparaît dans le code de création (= régression CHAT-4B) ; (c) pas de streaming SSE ; (d) impossible d'envoyer un message (bridge enforce tenant↔agent KO). |
| **Composants UI clés** | `AgentPresenceCard` · `ConversationsV4Workspace` · `ConversationList` · `useAgents` · streaming via `/api/conversations/stream`. |
| **Endpoints sollicités** | `GET /api/agents` · `GET /api/v4/conversations` · `GET /api/v4/folders` · `POST /api/conversations` · `GET /api/conversations/stream` (SSE) · `POST /api/conversations/[id]/messages`. |

---

## Étape 9 — Gérer modules admin (toggle)

| | |
|---|---|
| **URL** | `https://app.mybotia.com/admin/tenants/mybotia` (section Modules) |
| **Action UI** | Toggle ON/OFF d'un module. Tester aussi : éditer le `config` JSON d'un module (textarea + Save), tenter de désactiver un module dont d'autres modules dépendent (doit déclencher confirmation explicite). Vérifier que la page `/admin/tenants` (liste) reflète le compteur `modules_enabled`. |
| **Attendu visuel** | Toggle optimiste (animation immédiate) + rollback automatique si le PATCH renvoie ≠2xx (banner rouge inline). Save config JSON : Loader2 → Check vert. Désactivation avec dépendances : modal/dialogue confirmation listant les modules requérant celui-ci (« Ce module est requis par X. Voulez-vous quand même le désactiver ? »). Audit log se met à jour avec la dernière action. |
| **Données utilisées** | `tenant_modules` registry biz + `audit_log` core. Invalidation cache cockpit features (`invalidateCockpitFeatures`). |
| **KO si** | (a) toggle persiste visuellement mais n'est pas persisté en base (rollback absent) ; (b) désactivation d'un module bloquant (ex: `crm`) sans warning de dépendance ; (c) audit log non mis à jour ; (d) `cockpit-features` cache non invalidé (sidebar reste figée jusqu'au refresh manuel). |
| **Composants UI clés** | `TenantModulesSection` · `TenantAuditLogSection` · `ConfirmState` (dialog dépendances) · banner inline ok/err. |
| **Endpoints sollicités** | `GET /api/admin/tenants/mybotia/modules` · `PATCH /api/admin/tenants/mybotia/modules` body `{ module_key, enabled?, config? }` · `GET /api/admin/tenants/mybotia/audit-log`. |

---

## Données de test recommandées (fixtures minimales tenant `mybotia`)

| Entité | Quantité | Détail |
|---|---|---|
| **Tenant** | 1 | `mybotia` (déjà en place, modules `productions=true` activé matin du 09/05). |
| **Clients** | 2 | Ex: `Acme SAS` (B2B SaaS), `Bistrot des Halles` (resto). UUID stables, scopés tenant `mybotia`. |
| **Devis (`quotes`)** | 2 minimum, statut `accepted` | 1 devis par client, montants HT > 0, ref auto numérotée serveur. |
| **Affaires existantes** | 2 | 1 en stage `lead`, 1 en `qualified`, owner = `gilleskorzec@gmail.com`. |
| **Affaire à créer (étape 3)** | 1 | Titre `Mission V1.1.E recette`, client = `Acme SAS`, stage `qualified`, MRR HT 1200€, one-shot HT 4500€. |
| **Subs à signer (étape 4)** | 2 | Sub A : `Hébergement & maintenance`, MRR 800, monthly. Sub B : `Support premium`, MRR 400, monthly. One-shot : 4500€ mise en place. |
| **Agent test** | 1 | `lea` (online), tenant `mybotia`, voice ID Léa ♀ standard. |
| **Conversation test** | 1 | Folder « Recette V1.1.E », conversation neuve, 1 prompt envoyé. |

> Les fixtures ne doivent contenir **aucun** UUID arbitraire : les tenant_id
> proviennent de `core.tenant` (auth-service), jamais d'un seed manuel
> (doctrine `tenant_id canonique = core.tenant`).

---

## Captures attendues (8 screenshots, ordre du parcours)

1. **`01_admin_tenant_modules.png`** — `/admin/tenants/mybotia`, section Modules dépliée, `productions` ON visible.
2. **`02_pipeline_affaires_liste.png`** — `/affaires`, liste avec filtres et bouton « Nouvelle affaire ».
3. **`03_create_affaire_modal.png`** — `CreateAffaireModal` ouverte avec champs renseignés avant submit.
4. **`04_sign_affaire_modal_mixed.png`** — `SignAffaireModal` en mode `mixed`, 2 lignes de subs visibles, one-shot renseigné.
5. **`05_production_detail.png`** — `/productions/[id]` post-signature, deux colonnes revenus + abonnements + factures.
6. **`06_finance_kpis.png`** — `/finance`, 3 KPI tiles + graphique mensuel + abonnements actifs.
7. **`07_quote_pdf_download.png`** — Capture du PDF ouvert (logo MyBotIA, branding tenant), pas de mention « Dolibarr ».
8. **`08_agents_conversations.png`** — `/agents` (grille + bandeau statut) ou `/conversations` (workspace V4 avec streaming en cours).

> Stocker les captures dans `/opt/mybotia/mybotia-app/docs/recette/screenshots/`
> avec horodatage, et associer le commit `f00499c` (app) + `a5691f6` (biz).

---

## Gaps détectés (étapes nécessitant encore `crm.mybotia.com` ou points faibles)

| # | Gap | Conséquence | Mitigation V1.1.E |
|---|---|---|---|
| G1 | **Liste devis dédiée** : sidebar pointe `/finance#devis` (ancre dans la vue Trésorerie agrégée) faute de page `/finance/devis`. Idem `/finance/factures`. | Pas de page de gestion devis/factures dédiée côté app. Edition devis = encore via biz. | À livrer V1.2 : routes `/finance/devis` et `/finance/factures`. Aujourd'hui : ancres acceptables car aucune CTA création depuis app. |
| G2 | **Création / édition de devis** : aucun équivalent `CreateAffaireModal` pour devis côté app. | Pour générer un devis, Gilles passe encore par l'API biz directement ou un agent IA (Léa). | Pas de page UI livrée V1.1.E. À cadrer : `CreateQuoteModal` côté app (parité CRM). |
| G3 | **Édition de production avancée** (changement de stage `done`/`cancelled`/`abandoned`) : `EditProductionModal` couvre les champs métadonnées mais le bloc factures n'a pas de création UI (bouton « + facture » non câblé). | Création de facture = via biz / agent IA. | À livrer : modal `CreateInvoiceModal` ou délégation explicite à Léa (route IA). |
| G4 | **Tenants Dolibarr legacy** (`vlmedical`, `igh`, `cmb`) : provider CRM ≠ `mybotia_business` → `/affaires`, `/productions`, `/finance` renvoient `crm_provider_not_business`. | Pour ces tenants, rester sur le CRM Dolibarr respectif (`crm-vlmedical.mybotia.com`, etc.). | Hors scope V1.1.E. Migration progressive vers `mybotia_business` par tenant. |
| G5 | **PDF Dolibarr legacy** : `/api/quotes/[id]/pdf` cible uniquement `mybotia_business`. Pour Dolibarr → `/api/documents/download?modulepart=propale&ref=DEVxxx`. | Sur tenant `mybotia` : OK. Sur autres tenants : bouton Download peut pointer vers la mauvaise route si pas conditionné par provider. | Vérifier que les composants Download conditionnent l'URL selon `provider.kind`. |
| G6 | **Audit log côté affaires** : `/affaires/[id]` empty state historique (« pas d'endpoint audit côté business V1.1.D »). | Pas de timeline d'événements affaire dans l'app. | À livrer V1.2 : endpoint biz `GET /api/v1/affaires/[id]/audit`. |
| G7 | **`/finance/kpis` (Bloc 6C legacy)** : encore présent, multi-sources, à dépréquer une fois `/finance` (V1.1.D) confirmée comme source unique. | Doublon visible dans navigation indirecte. | Décommissionner après V1.2. |
| G8 | **Admin modules — visibilité non-superadmin** : la section Modules n'apparaît qu'avec `adminTools=true` + superadmin. Un owner tenant non-superadmin ne peut pas piloter ses propres modules. | Tout pilotage modules passe par Damien/Gilles. | Décision produit : V1.1.E volontairement superadmin-only. À ré-arbitrer V1.2. |

---

## Critère global de succès

Les 9 étapes sont **toutes exécutables** sur `app.mybotia.com` cockpit
`mybotia` sans ouvrir un seul onglet vers `crm.mybotia.com`. Les gaps G1
à G8 ci-dessus n'empêchent **aucune** des 9 étapes ; ils signalent les
travaux V1.2.

---

*Document de recette — révision 2026-05-09. À mettre à jour à chaque
incrément V1.1.x ou V1.2 livré.*
