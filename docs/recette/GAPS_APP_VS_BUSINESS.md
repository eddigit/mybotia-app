# GAPS_APP_VS_BUSINESS — Surfaces app.mybotia.com vs crm.mybotia.com (mybotia-business)

Date : 2026-05-09
Auteur : Damien (architecte intégration)
Périmètre : `tenantSlug=mybotia` (cockpit Léa). Les pages VLM / CMB / admin transverses
ne sont pas couvertes par mybotia-business — elles n'apparaissent ici qu'en marge.

Convention :
- "biz" = `/opt/mybotia/mybotia-business/src/app/...`
- "app" = `/opt/mybotia/mybotia-app/src/app/...`

Critère succès doctrine : Gilles n'ouvre PAS `crm.mybotia.com` pour son parcours principal.

---

## 1. Endpoints API biz vs proxy app

| Endpoint biz | Méthode(s) biz | Proxy app | Méthode(s) app | Remarques |
|---|---|---|---|---|
| `/api/v1/version` | GET | — | — | Diag interne, non bloquant |
| `/api/v1/health` | GET | — | — | Diag interne |
| `/api/v1/health/db` | GET | — | — | Diag interne |
| `/api/v1/me` | GET | `/api/auth/me` (logique propre) | GET | App n'utilise pas le `/me` biz |
| `/api/v1/dashboard` | GET | `/api/dashboard` | GET | OK |
| `/api/v1/finance/summary` | GET | `/api/finance/summary` | GET | OK |
| `/api/v1/admin/tenants/[slug]/modules` | GET, PATCH | `/api/admin/tenants/[slug]/modules` | GET, PATCH | OK |
| `/api/v1/clients` | GET, POST | `/api/clients` | GET, POST | OK |
| `/api/v1/clients/[id]` | GET, PUT, DELETE | `/api/clients/[id]` | GET, PATCH, DELETE | App expose `PATCH` (mappé sur `PUT` biz). Cohérent. |
| `/api/v1/contacts` | GET, POST | `/api/contacts` | GET, POST, **PUT** | App offre un PUT en plus (legacy, bypass `[id]`). |
| `/api/v1/contacts/[id]` | GET, PUT, DELETE | — | — | **GAP** : pas de proxy unitaire contact → impossible d'éditer/supprimer un contact depuis app. |
| `/api/v1/projects` | GET, POST | `/api/projects` | GET, POST | OK |
| `/api/v1/projects/[id]` | GET, PUT, DELETE | `/api/projects/[id]` | GET, PATCH, DELETE | OK |
| `/api/v1/affaires` | GET, POST | `/api/affaires` | GET, POST | OK |
| `/api/v1/affaires/[id]` | GET, PATCH, DELETE | `/api/affaires/[id]` | GET, PATCH, DELETE | OK |
| `/api/v1/affaires/[id]/sign` | POST | `/api/affaires/[id]/sign` | POST | OK (bascule affaire→production) |
| `/api/v1/tasks` | GET, POST | `/api/tasks` | GET, POST, PUT | OK |
| `/api/v1/tasks/[id]` | GET, PATCH, PUT, DELETE | `/api/tasks/[id]` | PATCH, DELETE | App n'a pas de GET unitaire (lecture passe par la liste). Impact mineur. |
| `/api/v1/quotes` | GET, **POST** | `/api/quotes` | GET (lecture seule) | **GAP bloquant** : pas de POST côté app → création devis impossible depuis app. |
| `/api/v1/quotes/[id]` | GET, **PUT, DELETE** | — (sauf `/[id]/pdf`) | GET (PDF binaire) | **GAP bloquant** : édition/suppression devis impossible depuis app. |
| `/api/v1/invoices` | GET, POST | — | — | **GAP bloquant** : pas de proxy liste/création factures. |
| `/api/v1/invoices/[id]` | GET, PUT, DELETE | — (sauf `/[id]/pdf`) | GET (PDF binaire) | **GAP bloquant** : pas de CRUD facture côté app. |
| `/api/v1/invoices/from-quote/[id]` | POST | — | — | **GAP bloquant** : la conversion devis→facture ne peut pas se faire depuis app. |
| `/api/v1/productions` | GET | `/api/productions` | GET | OK |
| `/api/v1/productions/[id]` | GET, PATCH, DELETE | `/api/productions/[id]` | GET, PATCH | App n'expose pas DELETE. Acceptable (rare). |
| `/api/v1/productions/[id]/subscriptions` | GET, POST | `/api/productions/[id]/subscriptions` | GET, POST | OK |
| — (côté biz inexistant) | — | `/api/productions/[id]/invoices` | GET | App agrège côté serveur en croisant biz invoices ; OK. |

Source des paths app : `grep -oE "/api/v1/[a-zA-Z0-9_/$\{}\[\]\-]+" /opt/mybotia/mybotia-app/src/app/api/**` ; tous les fichiers biz importent via `business-client` / `business-pdf-proxy`.

---

## 2. Pages UI biz vs app

| Page biz | URL biz | Page app équivalente | URL app | Statut |
|---|---|---|---|---|
| `src/app/page.tsx` (HomePageClient KPI) | `/` | `src/app/page.tsx` (CommandCenterHero) | `/` | OK — UX différente (cockpit IA vs KPI brut) mais parité fonctionnelle |
| `src/app/clients/page.tsx` | `/clients` | `src/app/crm/page.tsx` | `/crm` | OK — pipeline CRM remplace la table clients |
| — | — | `src/app/crm/[id]/page.tsx` | `/crm/[id]` | App-only (fiche client + projets + devis/factures) |
| `src/app/projects/page.tsx` | `/projects` | (intégré à `/crm`) | `/crm` | Couvert via fiche client |
| `src/app/tasks/page.tsx` | `/tasks` | `src/app/tasks/page.tsx` | `/tasks` | OK |
| `src/app/affaires/page.tsx` | `/affaires` | `src/app/affaires/page.tsx` | `/affaires` | OK |
| `src/app/affaires/[id]/page.tsx` | `/affaires/[id]` | `src/app/affaires/[id]/page.tsx` | `/affaires/[id]` | OK (incl. modal Sign) |
| `src/app/productions/page.tsx` | `/productions` | `src/app/productions/page.tsx` | `/productions` | OK |
| `src/app/productions/[id]/page.tsx` | `/productions/[id]` | `src/app/productions/[id]/page.tsx` | `/productions/[id]` | OK |
| `src/app/quotes/page.tsx` (CRUD complet) | `/quotes` | — (PDF only) | — | **GAP bloquant** : aucune page liste/édition/création devis dans app |
| `src/app/invoices/page.tsx` (CRUD complet) | `/invoices` | — (PDF only) | — | **GAP bloquant** : aucune page liste/édition/création facture dans app |
| `src/app/finance/page.tsx` | `/finance` | `src/app/finance/page.tsx` (+ `/finance/kpis`) | `/finance` | OK + extension app (KPI multi-sources) |
| `src/app/documents/page.tsx` (placeholder « À implémenter en H7 ») | `/documents` | `src/app/documents/page.tsx` (filtres + listing) | `/documents` | App > biz — biz est juste un stub |
| `src/app/admin/modules/page.tsx` | `/admin/modules` | `src/app/admin/modules/page.tsx` | `/admin/modules` | OK |

Pages app sans équivalent biz (legitimes — out of scope biz) :
`/agenda`, `/agents`, `/cmb`, `/conversations`, `/login`, `/pipeline`, `/privacy`, `/settings`, `/today`, `/vlm`, `/gpt-lea-setup`, `/admin/billing`, `/admin/tenants`, `/admin/usage/tokens`, `/admin/whatsapp-protocols`, `/finance/kpis`.

---

## 3. Composants critiques

| Composant biz | Chemin biz | Équivalent app | Chemin app | Gap |
|---|---|---|---|---|
| `QuotesPageClient` | `src/components/quotes/quotes-page.tsx` | — | — | **Bloquant** : aucun composant CRUD devis (form, table, lignes, totaux) |
| `InvoicesPageClient` | `src/components/invoices/invoices-page.tsx` | — | — | **Bloquant** : aucun composant CRUD facture (incl. bouton « créer depuis devis ») |
| `ClientsPageClient` (table CRUD) | `src/components/clients/clients-page.tsx` | `Pipeline` + `ClientCard` | `src/components/crm/{Pipeline,ClientCard}.tsx` | App offre l'équivalent en visuel pipeline. Création client : pas de modal dédiée standalone (dépend de `CreateProjectModal`/`CrmCard`). |
| `ProjectsPageClient` | `src/components/projects/projects-page.tsx` | `ProjectCard`, `ProjectDetailPanel` | `src/components/crm/...` + `CreateProjectModal` (shared) | Couvert |
| `TasksPageClient` | `src/components/tasks/tasks-page.tsx` | `TaskPanel`, `TaskEditPanel`, `CreateTaskModal` | `src/components/tasks/*` | OK |
| `AffairesPageClient` + `AffaireDetailClient` | `src/components/affaires/*` | `CreateAffaireModal`, `EditAffaireModal`, `SignAffaireModal` + page client `/affaires/[id]` | `src/components/affaires/*` | OK |
| `ProductionsPageClient` + `ProductionDetailClient` | `src/components/productions/*` | `EditProductionModal`, `AddSubscriptionModal` + pages app | `src/components/productions/*` | OK |
| `FinancePageClient` | `src/components/finance/finance-page.tsx` | `app/finance/page.tsx` + `MetricCard` shared | `src/app/finance/page.tsx` | OK |
| `AdminModulesPageClient` | `src/components/admin/modules-page.tsx` | `TenantModulesSection` | `src/components/admin/TenantModulesSection.tsx` | OK |
| `app-shell` (sidebar biz) | `src/components/layout/app-shell.tsx` | layout app (`src/components/layout/*`) | — | UX divergente, mais cockpit app est la cible |
| Hooks de données | `apiFetch` (biz) | `useScopedQuotes` / `useScopedInvoices` | **inexistants** | **Bloquant** : aucun hook React côté app pour devis/factures (cf. `src/hooks/use-api.ts`) |

---

## 4. Gaps bloquants — parcours impossible sans `crm.mybotia.com`

| # | Fonctionnalité | Impact | Solution |
|---|---|---|---|
| B1 | **Création de devis** (`POST /api/v1/quotes`) | Léa ne peut pas envoyer un devis depuis app. Devis = cœur du pipeline (`affaire.quoted` → `affaire.sign`). | Étendre `app/api/quotes/route.ts` avec `POST` ; créer page `/quotes` + `/quotes/[id]` + composants CRUD (réutiliser logique `quotes/totals.ts` biz). |
| B2 | **Édition / suppression devis** (`PUT,DELETE /api/v1/quotes/[id]`) | Impossible d'ajuster un devis brouillon ou de le retirer. | Créer `app/api/quotes/[id]/route.ts` (GET, PATCH, DELETE) + page édition. |
| B3 | **Liste + création facture** (`GET,POST /api/v1/invoices`) | Léa ne peut ni voir le carnet factures, ni en créer manuellement. | Créer `app/api/invoices/route.ts` + page `/invoices`. |
| B4 | **Édition / suppression facture** (`PUT,DELETE /api/v1/invoices/[id]`) | Impossible de marquer une facture payée / la corriger. | Créer `app/api/invoices/[id]/route.ts`. La modal « marquer payée » existe sur `/finance` mais n'a pas de PATCH côté app. |
| B5 | **Conversion devis → facture** (`POST /api/v1/invoices/from-quote/[id]`) | Une fois affaire signée, la génération facturable se fait uniquement depuis biz. | Proxy `app/api/invoices/from-quote/[id]/route.ts` + bouton dans `/affaires/[id]` ou `/quotes/[id]`. |
| B6 | **Édition / suppression contact** (`PUT,DELETE /api/v1/contacts/[id]`) | Léa peut créer un contact mais ne peut pas le corriger ni le supprimer depuis app. | Créer `app/api/contacts/[id]/route.ts` + intégration dans fiche client `/crm/[id]`. |

Total : **6 gaps bloquants**.

---

## 5. Gaps mineurs (workaround possible)

| # | Sujet | Workaround |
|---|---|---|
| M1 | Pas de page liste `/clients` standalone | Pipeline `/crm` couvre l'usage ; UX différente mais fonctionnelle |
| M2 | Pas de page liste `/projects` standalone | Vue dans fiche client `/crm/[id]` |
| M3 | Pas de GET unitaire `/api/tasks/[id]` côté app | TaskEditPanel fonctionne via la liste pré-chargée |
| M4 | Pas de DELETE `/api/productions/[id]` | Suppression production = cas exceptionnel ; fallback DB direct |
| M5 | Page biz `/documents` est un stub vide ; app `/documents` est plus avancé | Pas de gap, app domine |
| M6 | App n'utilise pas `/api/v1/me` biz | App utilise `/api/auth/me` (SSO core), c'est l'identité MyBotIA ; biz `/me` est tenant-scoped |
| M7 | App `/api/v1/contacts` n'expose pas `client_id` filter explicite côté path | URL `?client_id=...` est traversée (`contacts${clientIdQs}`), OK |

---

## 6. Recommandations extension app (pages / proxies à créer)

Priorité 1 (cette semaine, bloque le parcours principal) :
1. **Proxies devis CRUD** : `app/api/quotes/route.ts` (POST), `app/api/quotes/[id]/route.ts` (GET, PATCH→PUT, DELETE), `app/api/quotes/from-quote/...` non concerné.
2. **Pages devis** : `src/app/quotes/page.tsx` (liste filtres status/client) + `src/app/quotes/[id]/page.tsx` (édition lignes + totaux). Réutiliser `lib/quotes/totals.ts` à porter depuis biz vers `mybotia-app`.
3. **Proxies factures CRUD** : `app/api/invoices/route.ts` (GET, POST), `app/api/invoices/[id]/route.ts` (GET, PATCH, DELETE), `app/api/invoices/from-quote/[id]/route.ts` (POST).
4. **Pages factures** : `src/app/invoices/page.tsx` + `src/app/invoices/[id]/page.tsx`.
5. **Bouton « Créer la facture »** dans `/affaires/[id]` (post-sign) et `/quotes/[id]` (post-accepted).
6. **Proxy contact unitaire** : `app/api/contacts/[id]/route.ts` (GET, PATCH, DELETE) + intégration dans `/crm/[id]`.

Priorité 2 (qualité) :
7. Hooks SWR : `useScopedQuotes`, `useScopedInvoices`, `useQuote(id)`, `useInvoice(id)` dans `src/hooks/use-api.ts`.
8. Modal `CreateClientModal` standalone dans `src/components/crm/` (aujourd'hui création passe par flux mixte).
9. GET `app/api/tasks/[id]` (cohérence REST).

---

## 7. Recommandations extension biz (endpoints manquants)

1. **Filtre `deal_id` / `project_id` sur `/api/v1/quotes` GET** (cf. commentaire dans `app/api/quotes/route.ts` : « business ne l'expose pas encore en query »). Évite filtrage client-side et round-trips.
2. **Vue `business_productions.billing_mode` persistée** (cf. commentaire `app/productions/page.tsx` : « V2 : ajouter billing_mode à la vue business_productions… »). Évite la requête lazy `subscriptions`.
3. **Endpoint `/api/v1/clients/[id]/projects`** (raccourci) — actuellement app filtre côté client après `GET /api/v1/projects`.
4. **Documents complets côté biz** : la page `/documents` biz est un stub. Aligner sur l'implémentation app ou décréter app = seule source UI documents.

---

## 8. Verdict doctrine

État courant : Gilles **doit** ouvrir `crm.mybotia.com` pour :
- Créer / éditer / signer un devis (B1, B2)
- Créer / éditer / marquer payée une facture (B3, B4)
- Convertir un devis accepté en facture (B5)
- Corriger un contact (B6)

Tout le reste (cockpit, KPI, affaires, tasks, productions, finance) est déjà 100 % parité ou supérieur côté app.

**Estimation effort top-3 actionnable cette semaine** :
- Reco app #1 + #2 (devis CRUD + UI) : ~1.5 j wall-clock parallèle (1 builder + 1 préparateur tests, doctrine 4 rôles).
- Reco app #3 + #4 (factures CRUD + UI) : ~1.5 j wall-clock parallèle.
- Reco app #5 (bouton from-quote) : ~0.5 j (proxy + bouton).

→ Sortie cible : V1.1.F « Devis & Factures dans app » sous 3 j wall-clock pour clore la doctrine « pas de crm.mybotia.com ».
