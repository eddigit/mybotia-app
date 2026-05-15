# GPT_LEA_ACTIONS_GAPS — Périmètre Actions OpenAPI de Léa vs besoins métier

Date : 2026-05-15
Auteur : Damien (architecte intégration)
Périmètre : tools exposés au GPT privé « Léa — MyBotIA » côté ChatGPT.
Pendant document : `GAPS_APP_VS_BUSINESS.md` (gaps UI cockpit vs `mybotia-business`).

---

## 0. Correction de prémisse — Léa n'utilise pas MCP

Plusieurs comptes-rendus internes parlent de « tools MCP `business_*_draft` » de Léa. **C'est faux.** Léa est un **GPT privé hébergé chez OpenAI** (pas un agent Claude). Ses tools sont des **GPT Actions OpenAPI**, pas des tools MCP. Concrètement :

| Brique | Identifiant | Localisation |
|---|---|---|
| Frontend Léa | GPT privé « Léa — MyBotIA » dans GPT Builder | ChatGPT (OpenAI) |
| Définition tools | Schéma OpenAPI 3.1.0 | `https://api.mybotia.com/gpt/openapi.yaml` |
| Runtime handlers | Service `gpt-actions-api` | VPS Hostinger, hors `mybotia-app` |
| Repo source runtime | `/opt/mybotia/projects/gpt-lea/` (probable) | hors `mybotia-app` et hors `mybotia-business` |
| Knowledge pack | `/opt/mybotia/projects/gpt-lea/exports/gpt-lea-knowledge.zip` | VPS, servi via `/gpt-lea-setup/download` |
| Auth | HTTP Bearer token (`GPT_ACTIONS_TOKEN` dans GPT Builder) | — |

Conséquence : tout chantier d'élargissement du périmètre tools de Léa **se fait dans le repo `gpt-actions-api`**, pas dans `mybotia-app` ni dans `mybotia-business`. `mybotia-app` n'a qu'**une seule** trace de Léa : la page d'installation `src/app/gpt-lea-setup/page.tsx` qui pointe vers l'OpenAPI URL et propose le knowledge pack en téléchargement.

---

## 1. Inventaire des 8 operationIds en prod

Source : `https://api.mybotia.com/gpt/openapi.yaml` (récupéré 2026-05-15, OpenAPI 3.1.0, info.version `0.3.0`).

| # | operationId | Méthode | Path | Mode | Persist |
|---|---|---|---|---|---|
| 1 | `getLeaHealth` | GET | `/lea/health` | diag | n/a |
| 2 | `chatLea` | POST | `/lea/chat` | conversation | n/a |
| 3 | `searchCrm` | POST | `/lea/search-crm` | lecture | non |
| 4 | `getClientSummary` | POST | `/lea/client-summary` | lecture | non |
| 5 | `getPendingTasks` | GET | `/lea/pending-tasks` | lecture | non |
| 6 | `createTask` | POST | `/lea/create-task` | draft | **persisted=false (V1)** |
| 7 | `createEmailDraft` | POST | `/lea/create-email-draft` | draft | **persisted=false** |
| 8 | `createWhatsAppDraft` | POST | `/lea/create-whatsapp-draft` | draft | **persisted=false** |

Tous marqués `x-openai-isConsequential: false`. Doctrine V1 : pas d'écriture réelle, uniquement des brouillons. Cohérent avec les règles dures de Léa (« jamais d'engagement sans GO explicite de Gilles »).

**Drift de version repéré** : `src/app/gpt-lea-setup/page.tsx` (lignes 10-11) hardcode `RUNTIME_VERSION = "0.2.2"` et `SCHEMA_VERSION = "0.2.1"`. La prod expose `info.version: 0.3.0`. La page d'installation est obsolète et affiche un faux numéro de version à Gilles. À corriger dans une PR séparée ou dans le chantier ci-dessous.

---

## 2. Matrice besoins Léa vs operationIds existants

Source des besoins : transcription audit Léa-tool ↔ DB du 2026-05-15 + matrice `GAPS_APP_VS_BUSINESS.md`.

### 2.1 Besoins de lecture (Léa doit « voir » avant d'agir)

| Besoin | operationId qui couvre | Verdict |
|---|---|---|
| « Cherche-moi Byron » (recherche texte) | `searchCrm` | OK |
| « Fais-moi un point sur Byron » (synthèse) | `getClientSummary` | OK (mais granularité limitée — pas de contacts multi, pas d'économique) |
| « Combien j'ai de tâches » | `getPendingTasks` | OK |
| **Lister tous les contacts de Byron (Hannah + Hubert + Carine)** | aucun | **GAP** |
| **Voir les affaires en cours de Byron avec montants** | aucun (`getClientSummary` ne renvoie pas `oneshotAmountHt`/`mrrHt`) | **GAP** |
| **Voir les productions en cours de Byron** | aucun | **GAP** |
| **Lire la timeline d'activités d'un client** (notes datées, calls, emails, WA) | aucun | **GAP** (et dépend de l'exposition côté business — voir §5) |
| **Voir les avoirs (`credit_notes`) d'un client** | aucun | **GAP** |

### 2.2 Besoins d'édition (en mode draft V1)

| Besoin | operationId qui couvre | Verdict |
|---|---|---|
| Préparer un email | `createEmailDraft` | OK |
| Préparer un WhatsApp | `createWhatsAppDraft` | OK |
| Préparer une tâche | `createTask` | OK |
| **Préparer la création/modif d'un contact** (Hannah dans la fiche Byron) | aucun | **GAP** |
| **Préparer la modif d'une fiche client** (téléphone, statut, type, notes, whatsappJid, logoUrl) | aucun | **GAP** |
| **Préparer la modif d'une affaire avec économique** (`oneshotAmountHt`, `mrrAmount`, `billingMode`, `expectedCloseDate`) | aucun | **GAP** |
| **Préparer la modif d'une production** (idem) | aucun | **GAP** |
| **Préparer une activité timeline** (note/call/email logué) | aucun | **GAP** (et dépend de §5) |
| **Préparer un avoir** | aucun | **GAP** |

### 2.3 Besoins hors-périmètre (DB ne supporte pas)

À **ne pas** ajouter au schéma OpenAPI tant que la décision produit + la DDL côté `mybotia-business` n'a pas été prise.

| Besoin | Raison du refus |
|---|---|
| IBAN/RIB client | pas de colonne en DB, décision produit pendante |
| SIRET, n° TVA intra | pas de colonnes en DB, décision produit pendante |
| `legal_name` | n'existe pas en DB |
| Adresse postale structurée (`address_line1`, `postal_code`, `city`, `country`) | aucune colonne en DB |
| Site web client | pas de colonne dédiée |
| Tags multi-valués | actuellement une seule colonne `priority` + une seule `clientType` ; passage en multi = décision produit + DDL |
| Pièces jointes / documents attachés à un client | pas de table `documents`/`attachments` côté business V1 |

Ces 7 lignes correspondent aux **champs fantômes** que d'anciens audits prêtaient à tort à Léa. Ne **pas** les ajouter.

---

## 3. operationIds à ajouter (chantier `gpt-actions-api`)

Périmètre proposé : **10 nouveaux operationIds**. Tous suivent la doctrine V1 — les écritures renvoient `persisted: false` et exposent le brouillon ; Gilles confirme côté cockpit (ou via un futur `confirm=true`).

### 3.1 Lectures (READ — sans risque, à livrer en premier)

| operationId | Méthode | Path | Endpoint business cible | Body / Query |
|---|---|---|---|---|
| `getClient` | POST | `/lea/client` | `GET /api/v1/clients/[id]` | `client_query: string` (id ou nom) |
| `listContacts` | POST | `/lea/contacts` | `GET /api/v1/contacts?client_id=` | `client_query: string` |
| `listAffaires` | POST | `/lea/affaires` | `GET /api/v1/affaires?client_id=&status=` | `client_query?`, `status?` |
| `listProductions` | POST | `/lea/productions` | `GET /api/v1/productions?client_id=` | `client_query?` |
| `getClientActivities` | POST | `/lea/client-activities` | `GET /api/v1/clients/[id]/activities` ⚠️ voir §5 | `client_query: string`, `limit?: integer` |
| `listCreditNotes` | POST | `/lea/credit-notes` | `GET /api/v1/credit-notes?client_id=` | `client_query?` |

### 3.2 Drafts (WRITE V1, `persisted: false`)

| operationId | Méthode | Path | Endpoint business cible | Champs whitelistés |
|---|---|---|---|---|
| `updateClientDraft` | POST | `/lea/client-update-draft` | `PUT /api/v1/clients/[id]` | `name`, `email`, `phone`, `status`, `notes`, `clientType`, `priority`, `nextAction`, `whatsappJid`, `logoUrl` |
| `createContactDraft` | POST | `/lea/contact-create-draft` | `POST /api/v1/contacts` | `client_query`, `name`, `email?`, `phone?`, `role?` |
| `updateContactDraft` | POST | `/lea/contact-update-draft` | `PATCH /api/v1/contacts/[id]` | `contact_id`, `name?`, `email?`, `phone?`, `role?` |
| `updateAffaireDraft` | POST | `/lea/affaire-update-draft` | `PATCH /api/v1/affaires/[id]` | `affaire_id`, `name?`, `status?`, `oneshotAmountHt?`, `mrrAmount?`, `billingMode?` (∈ `one_shot|recurring|mixed`), `expectedCloseDate?`, `nextAction?` |

Hors V1 (à discuter ensuite — exigent au minimum l'exposition côté business stabilisée) :
- `updateProductionDraft` — miroir d'`updateAffaireDraft` sur `/api/v1/productions/[id]`
- `createActivityDraft` — `POST /api/v1/clients/[id]/activities` (dépend §5)
- `createCreditNoteDraft` — `POST /api/v1/credit-notes`

### 3.3 Doctrine de réponse pour les `*Draft`

Chaque endpoint draft doit retourner :

```json
{
  "persisted": false,
  "draft": { /* l'objet tel qu'il serait écrit en DB */ },
  "target": { "endpoint": "PATCH /api/v1/affaires/<uuid>", "client_id": "<uuid>" },
  "summary_for_lea": "Tu peux dire à Gilles : <phrase courte naturelle FR>",
  "validation": { "ok": true, "warnings": [] }
}
```

Léa parle à Gilles en langage naturel via `summary_for_lea` ; la décision de persister revient à Gilles via le cockpit (bouton « Appliquer » dans la fiche) ou via un futur `confirm=true` côté operationId (V2).

---

## 4. Anti-patterns à proscrire

| ❌ Ne pas | Raison |
|---|---|
| Ajouter `siret`, `vat_number`, `address_*`, `legal_name`, `website`, `iban`, `tags[]` aux schémas | Décision produit non prise + DDL absente côté `mybotia-business`. Risque : exposer à Léa un champ qu'elle écrira sans jamais être persisté. |
| Faire pointer un draft vers `/api/v1/projects/[id]` | L'endpoint `projects` legacy n'expose pas l'économique. Pointer sur `affaires` (avant signature) ou `productions` (après) selon `lifecycle_stage`. |
| Implémenter les handlers dans `mybotia-app` | `mybotia-app` est un cockpit Next.js, pas un runtime d'Actions GPT. Les handlers vivent dans `gpt-actions-api`. |
| Définir les tools comme « MCP » dans la doctrine ou les RACI | Vocabulaire faux. Le mot juste est **GPT Action** ou **operationId OpenAPI**. |
| Marquer les drafts `x-openai-isConsequential: true` | Casse la doctrine V1 (« jamais d'engagement sans GO Gilles »). Tous les `*Draft` doivent rester `false`. |
| Bumper l'OpenAPI sans bumper la page `/gpt-lea-setup` | La page affiche un numéro de version à Gilles, déjà désynchro (cf. §1). |

---

## 5. Dépendances bloquantes côté `mybotia-business`

Avant que la moitié sud du tableau §3 soit livrable, les endpoints suivants doivent **exister et être proxiés côté `mybotia-app`** :

| Endpoint business | Statut actuel | Bloque |
|---|---|---|
| `GET /api/v1/contacts?client_id=` + `PATCH /api/v1/contacts/[id]` | ✅ business OK ; ❌ proxy app `[id]` absent (gap B6 du doc parallèle) | `listContacts`, `createContactDraft`, `updateContactDraft` |
| `PATCH /api/v1/affaires/[id]` avec économique | ✅ business OK, proxy app OK | `updateAffaireDraft` |
| `GET/POST /api/v1/clients/[id]/activities` | ⚠️ **non confirmé** — `src/app/api/clients/[id]/route.ts:185` renvoie `activities: []` en dur sur provider business V1 ; la transcription récente prétend que la table `client_activities` existe côté VPS, mais aucune migration n'est commitée dans le proxy. **À auditer en priorité.** | `getClientActivities`, `createActivityDraft` |
| `GET/POST/PATCH/DELETE /api/v1/credit-notes` | ⚠️ revendiqué V1.2.F/G dans la transcription, à confirmer depuis le repo `mybotia-business` | `listCreditNotes`, `createCreditNoteDraft` |

**Recommandation** : avant d'écrire la moindre ligne dans `gpt-actions-api`, **auditer le repo `mybotia-business`** pour confirmer la réalité des tables et endpoints `client_activities` et `credit_notes`. Sans ça, on pousse au schéma OpenAPI des Actions qui retourneront systématiquement 404.

---

## 6. Plan d'exécution (côté `gpt-actions-api`, hors ce repo)

Séquence proposée, ordre du coût croissant et du risque produit décroissant :

1. **Audit `mybotia-business`** — confirmer existence + contrats Zod de `client_activities` et `credit_notes`. Livrable : 1 patch dans le doc présent qui passe les ⚠️ de §5 en ✅ ou en ❌.
2. **Livrer les 6 reads** (§3.1) — sans risque produit, débloque immédiatement Léa sur « vois X » même sans capacité d'écrire. Bump OpenAPI à `0.4.0`.
3. **Livrer le proxy app manquant `/api/contacts/[id]`** (gap B6 du doc parallèle) — pré-requis pour que le cockpit puisse appliquer les drafts contact que Léa produit.
4. **Livrer les 4 drafts core** (§3.2) — `updateClientDraft`, `createContactDraft`, `updateContactDraft`, `updateAffaireDraft`. Bump OpenAPI à `0.5.0`.
5. **Resynchroniser `src/app/gpt-lea-setup/page.tsx`** — remplacer `RUNTIME_VERSION` et `SCHEMA_VERSION` hardcodés par un fetch dynamique sur `api.mybotia.com/gpt/openapi.yaml` (ou au minimum par les bonnes valeurs). PR ciblée `mybotia-app`.
6. **Drafts secondaires** (§3.2 « Hors V1 ») — productions, activities, credit-notes. À jalonner après que §5 soit en vert.
7. **Régénérer le knowledge pack** `gpt-lea-knowledge.zip` si la doctrine Léa change (nouveaux tools mentionnés dans les fichiers de connaissance). Gilles ré-importe dans GPT Builder.
8. **Décision produit** sur IBAN / SIRET / adresse / tags multi / documents — chantier hors périmètre tool, bloque l'extension §2.3.

---

## 7. Verdict

`mybotia-app` n'a **rien à livrer** sur l'extension du périmètre Léa, hors le hotfix §6.5 (version hardcodée) et le gap B6 du doc parallèle (proxy contact unitaire). Le chantier réel est dans `gpt-actions-api`, sur les bases d'un audit `mybotia-business` que personne n'a encore fait.

Doctrine cible une fois §6 livré : Léa peut **voir tout ce qui compte** sur un client (contacts multi, économique, activités, avoirs) et **préparer toute action raisonnable** (modif client, contact, affaire) en draft que Gilles confirme — sans jamais pouvoir écrire en DB sans son GO.
