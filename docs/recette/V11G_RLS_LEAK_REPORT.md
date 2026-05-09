# V1.1.G — Audit RLS conversations + voice

Date: 2026-05-09
Auteur: Damien (audit architecte sécu multi-tenant)
Verdict global: **LEAK potentiel cross-user (et secondaire cross-tenant) sur la route legacy `/api/conversations/[id]/messages`** + **RLS absente sur `chat.*`** (defense in depth manquante).

---

## 1. Tables identifiées

| Schéma | Table | Colonne tenant | RLS | FORCE | Policy |
|---|---|---|---|---|---|
| chat | conversations | `tenant_slug` (NOT NULL) + `user_email` (NOT NULL) | NON | NON | aucune |
| chat | messages | aucune (lien indirect via `conversation_id` FK) | NON | NON | aucune |
| chat | folders | `tenant_slug` + `user_email` | NON | NON | aucune |
| core | whatsapp_protocols | `tenant_slug` (NOT NULL) | NON | NON | aucune |
| vectorial_legacy_20260423 | conversation, message | (legacy archive) | n/a | n/a | n/a |

Notes:
- Les tables `chat.*` ont la colonne `tenant_slug` en place (pas `tenant_id` mais c'est le pattern canonique MyBotIA aligné avec `core.tenant.slug`).
- `chat.messages` n'a pas de colonne tenant : isolation par jointure FK vers `chat.conversations`.
- Aucune table `voice_*` côté Postgres → voice = stateless (TTS ElevenLabs au vol, cache fichier `/var/mybotia/tts-cache`, pas de persistance DB).
- Bridge SQLite (`/opt/mybotia/claude-bridge/conversations.db`) stocke des conversations parallèles avec `tenant_slug` et `user_email`. Hors RLS Postgres, mais toute requête bridge filtre via Bearer token + `user_email` query.

---

## 2. Endpoints API audités

### App Next.js — routes V4 (production actuelle)

| Endpoint | Filtre tenant_slug | Filtre user_email | Source tenant | Fail-closed | Verdict |
|---|---|---|---|---|---|
| `GET /api/v4/conversations` | OUI ($1) | OUI ($2) | JWT `getSessionV4()` | OUI (401) | sain |
| `POST /api/v4/conversations` | OUI INSERT | OUI INSERT | JWT | OUI | sain |
| `GET /api/v4/conversations/[id]` | OUI WHERE | OUI WHERE | JWT | OUI (404) | sain |
| `PATCH /api/v4/conversations/[id]` | OUI WHERE | OUI WHERE | JWT | OUI | sain |
| `DELETE /api/v4/conversations/[id]` | OUI WHERE | OUI WHERE | JWT | OUI | sain |
| `GET /api/v4/conversations/[id]/messages` | hérité via load conv | hérité | JWT | OUI (404) | sain |
| `POST /api/v4/conversations/[id]/messages` | hérité via load conv | hérité | JWT | OUI | sain |

### App Next.js — routes legacy (toujours expose)

| Endpoint | Session check | Filtre tenant_slug | Filtre user_email | Verdict |
|---|---|---|---|---|
| `GET /api/conversations` | OUI | non (mais filtre `user_email`) | OUI | partiel (cf §3) |
| `POST /api/conversations` | OUI | non explicite (envoyé via `userContext`) | n/a (write bridge) | acceptable |
| `DELETE /api/conversations/[id]` | OUI | non | OUI (`session.email`) | acceptable |
| `PATCH /api/conversations/[id]` | OUI | non | OUI | acceptable |
| **`GET /api/conversations/[id]/messages`** | **NON** | **NON** | **NON** | **LEAK** |
| `POST /api/conversations/stream` | OUI | non explicite | propagé via userContext | acceptable |

### Bridge claude (FastAPI 9400)

| Endpoint | Bearer | Filtre user_email | Filtre tenant_slug | Verdict |
|---|---|---|---|---|
| `GET /conversations` | OUI | OUI (si fourni) | non | partiel |
| `GET /conversations/{id}/messages` | OUI | **NON** | **NON** | **LEAK secondaire** |
| `DELETE/PATCH /conversations/{id}` | OUI | OUI (403 si mismatch) | non | acceptable |

---

## 3. Verdict sécurité : LEAK potentiel cross-tenant ? **OUI (cross-user, cross-tenant possible)**

### Vulnérabilité primaire (App Next.js)

**Fichier**: `/opt/mybotia/mybotia-app/src/app/api/conversations/[id]/messages/route.ts`

```ts
export async function GET(_request, { params }) {
  const { id } = await params;
  const messages = await getSessionMessages(id, 100);   // <- aucun getSession(), aucun filtre
  return Response.json(messages);
}
```

Conséquence: tout utilisateur authentifié (ou non, route publique) peut récupérer les messages d'une conversation arbitraire s'il connaît son `session_id`. UUID 16 octets → brute force impraticable, mais un ID leakage ailleurs (logs, URL partagée, devtools tiers) suffit. Frontalement utilisée par `useMessages()` dans `src/hooks/use-api.ts:872`.

### Vulnérabilité secondaire (bridge)

`GET /conversations/{session_id}/messages` (poc-bridge.py:1563) ne filtre ni `user_email` ni `tenant_slug`. Bearer token suffit. Dépend du segment auth amont (app Next.js) pour empêcher l'abus.

### Defense in depth manquante

RLS non activée sur `chat.*`. Si jamais l'app oublie un WHERE (cf vulnérabilité primaire), Postgres sert tout. C'est précisément le cas ici.

`core.whatsapp_protocols` : également sans RLS, mais data non sensible cross-tenant (textes de protocole, pas de PII massive). À sécuriser dans une vague ultérieure (V1.1.H+).

---

## 4. Recommandations (DDL préparée, **non appliquée**)

### 4.1 Hotfix code (priorité 1, bloquant)

Patch route legacy app — ajouter session check + user_email + propager au bridge:

```ts
// /opt/mybotia/mybotia-app/src/app/api/conversations/[id]/messages/route.ts
import { getSession } from "@/lib/session";
import { getSessionMessages } from "@/lib/claude-bridge";

export async function GET(_req, { params }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non authentifie" }, { status: 401 });
  const { id } = await params;
  // Vérifier ownership : la conv doit appartenir à (tenant_slug, user_email)
  // soit via DB chat.conversations soit via bridge avec user_email scoping.
  const messages = await getSessionMessages(id, 100, session.email);
  return Response.json(messages);
}
```

Et dans `src/lib/claude-bridge.ts` : étendre `getSessionMessages` pour passer `user_email` en query, puis durcir le bridge (`/conversations/{id}/messages` : récupérer `user_email` query, faire SELECT préliminaire `WHERE id=? AND user_email=?` → 403 sinon).

NON APPLIQUÉ — change la signature `claude-bridge.ts` + bridge Python, dépasse le périmètre "ajouter WHERE". GO Damien requis.

### 4.2 RLS chat.* (defense in depth, priorité 2)

Fichier proposé: `/opt/mybotia/mybotia-business/drizzle/_manual_20260509_v11g_02_rls_chat.sql`

Étape 1 (idempotente) — voir SQL ci-dessous. Stratégie: GUC `app.tenant_slug` + `app.user_email` posées par middleware applicatif via `SET LOCAL` au début de chaque transaction.

ATTENTION: l'app actuelle n'utilise **pas** de pattern `SET LOCAL` par requête. Activer FORCE RLS casserait toutes les routes V4 jusqu'à ce que `withTenant`/middleware soit en place. Donc on prépare la DDL mais on **n'enable pas FORCE** sans avoir validé que toutes les sessions DB poussent bien les GUC. Plan:
1. Ajouter le `SET LOCAL` dans `lib/v4/db.ts query()` wrapper.
2. Tester en staging.
3. Activer ENABLE + FORCE.

### 4.3 voice events

Aucune action requise — pas de persistance. Si V2 ajoute un `voice_events` table, l'inclure d'office avec `tenant_slug NOT NULL` + RLS dès la création.

---

## 5. Fichiers SQL idempotents proposés (NON appliqués)

Voir `/opt/mybotia/mybotia-business/drizzle/_manual_20260509_v11g_02_rls_chat.sql` (créé en parallèle).

---

## 6. Action immédiate demandée à Damien

1. **GO/NO-GO** sur le hotfix route legacy `/api/conversations/[id]/messages` (ajouter session + user_email).
2. **GO/NO-GO** sur la DDL RLS chat.* (préparée, pas appliquée). Recommandation: appliquer Phase 1 (ENABLE sans FORCE) après ajout du `SET LOCAL` dans le wrapper db.
3. **Décider** si on traite `core.whatsapp_protocols` dans V1.1.G ou on reporte V1.1.H.

Aucun patch appliqué sans GO — conformément à la doctrine "audit → STOP → arbitrage → patch".
