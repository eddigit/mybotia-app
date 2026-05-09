# V1.1.G — Audit couche Agent tenant-aware

**Date** : 09/05/2026
**Auteur** : Architecte multi-tenant (audit)
**Scope** : `mybotia-app` — VoicePanel, Conversations V4, /api/agents, sidebar droite
**Doctrine** : `doctrine_tenant_aware_agent_layer.md`

---

## 1. Inventaire des hardcodes / inférences "Léa"

| # | Fichier | Ligne | Problème |
|---|---|---|---|
| 1 | `src/lib/v4/session.ts` | 50 | `getSessionV4()` lit `tenant_slug` du **JWT figé** — n'honore PAS le cookie `cockpit_tenant`. |
| 2 | `src/lib/session.ts` | 60-67 | `getSession()` idem — JWT only. |
| 3 | `src/app/api/agents/route.ts` | 199-201 | Filtre par `session.tenantSlug` (JWT), pas par cockpit. → liste agents du tenant JWT, pas du cockpit. |
| 4 | `src/app/api/conversations/route.ts` | 10-29 | `TENANT_AGENT_MAP` hardcodé + fallback `\|\| "lea"`. |
| 5 | `src/app/api/conversations/stream/route.ts` | 18,55 | Idem fallback `"lea"`. |
| 6 | `src/components/conversations/ConversationsV4Workspace.tsx` | 1470, 1477 | `agentId={conv?.agentId ?? "lea"}` + `agentName={conv?.agentName ?? "Léa"}`. |
| 7 | `src/components/home/CommandCenterHero.tsx` | 10-26 | `TENANT_AGENT_NAME` hardcodé + fallback `"Lea"` ; lit `user.tenant_slug` (JWT) au lieu du cockpit. |
| 8 | `src/components/conversations/ChatActionBar.tsx` | 51 | `agentLabel = agentName \|\| "Léa"`. |
| 9 | `src/components/conversations/SourcesCard.tsx` | 115 | `"Archive Léa"` hardcodé. |
| 10 | `src/hooks/use-api.ts` | 7-55 | `useApi` fait `useEffect([url, tick])` — la clé `/api/agents` ne change PAS au switch tenant ⇒ pas de re-fetch automatique. |

Bonus — pas critiques mais à surveiller :
- `src/components/tasks/CreateTaskModal.tsx`, `TaskEditPanel.tsx`, `app/tasks/page.tsx` : `<option value="lea">Léa</option>` en dur.
- `src/app/crm/[id]/page.tsx:210` : `seedAgent: "lea"`.
- `src/app/api/admin/whatsapp-protocols/route.ts:128` + `app/admin/whatsapp-protocols/page.tsx:226` : default `"lea"`.

---

## 2. Source actuelle de l'agent (verdict)

**Verdict : double inférence incohérente, et désync cockpit ↔ agent.**

Trois chemins coexistent :

1. **Sidebar droite (ContextRail/VoicePanel)** :
   `useAgents()` → `/api/agents` → `getSession()` → `session.tenantSlug` (JWT) → `TENANT_AGENTS[tenantSlug]` → `agents[0]` → `getVoiceConfig(agentId)` (`src/lib/voice-config.ts` mappe `lea→voice.mybotia.com`, `max→voice-vlmedical.mybotia.com`, etc.). Le mapping voice est OK ; le problème est en amont (tenantSlug est figé sur le JWT).

2. **Conversations V4** :
   `v4Api.listConversations()` → `/api/v4/conversations` → `getSessionV4()` (JWT only) → `WHERE tenant_slug = session.tenantSlug AND user_email = session.email`. Idem : ignore le cookie cockpit.

3. **TenantSwitcher (sidebar gauche)** :
   POST `/api/me/switch-tenant` pose le cookie httpOnly `cockpit_tenant=<slug>` puis `router.refresh()`. Ce cookie n'est lu que par `resolveCockpitTenant(request)` (utilisé par `/api/me/features`, `/api/dashboard`, `/api/tasks?today=1`...). **Aucune route agent/conversation/voice n'utilise ce helper.**

**Conséquence directe** : un superadmin sur `app.mybotia.com` (tenant JWT = `mybotia`) qui bascule sur `vlmedical` voit le branding/business changer (cockpit features = vlmedical), mais `/api/agents` et `/api/v4/conversations` continuent de retourner `lea` + conv mybotia. **Bug exact reporté par Gilles.**

Bonus : même si on corrige les routes, `useApi` (dans `use-api.ts`) garde sa data en state et ne re-fetche pas au switch — il faudrait un signal de revalidation (ex. clé incluant le cockpit, ou listener `router.refresh`).

---

## 3. Source de vérité recommandée

**Reco : table dédiée `core.tenant_agents`** (DDL livrée → §4).

| Option | Pour | Contre |
|---|---|---|
| `core.tenant_settings.features.agents` JSONB | rapide, pas de migration | pas de contraintes FK, pas indexable, mélange features/identité agent — sale |
| `core.tenant_settings.architecture_config` JSONB | déjà présent, libre | idem, et déjà utilisé pour autre chose |
| **`core.tenant_agents` table dédiée** ✅ | RLS native, FK propre, indexable, jointures simples côté API, cohérent avec `tenant_modules`/`tenant_capabilities` | 1 table de plus (acceptable) |

Schema retenu :
```
core.tenant_agents (
  tenant_id          uuid PK FK→core.tenant(id),
  primary_agent_slug text NOT NULL,        -- 'lea' | 'max' | 'lucy' | 'raphael' | 'maria'
  primary_agent_name text NOT NULL,        -- 'Léa' | 'Max' | ...
  voice_agent_key    text,                 -- clé systemd voice-agent@<key>
  voice_gender       text CHECK female|male,
  channels           jsonb,                -- {whatsapp,voice,webchat,email}
  capabilities       jsonb,
  created_at, updated_at
) RLS FORCE + policy isolation
```

Seed canonique aligné sur `project_voice_id_par_genre.md` :
- mybotia → lea (♀), vlmedical → max (♂), igh → lucy (♀), cmb_lux → raphael (♂), esprit_loft → maria (♀).

---

## 4. DDL

Fichier livré : `/opt/mybotia/mybotia-business/drizzle/_manual_20260509_v11g_01_tenant_agents.sql`
- idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- RLS FORCE + policy `tenant_agents_isolation`
- seed des 5 tenants
- aucune destruction
- **À appliquer par Damien après audit + GO Gilles** (DDL = règle dure backup avant)

Vérification post-apply :
```sql
SELECT t.slug, ta.primary_agent_slug, ta.primary_agent_name, ta.voice_agent_key
FROM core.tenant_agents ta JOIN core.tenant t ON t.id = ta.tenant_id
ORDER BY t.slug;
```
Attendu : 5 lignes (cmb_lux/raphael, esprit_loft/maria, igh/lucy, mybotia/lea, vlmedical/max).

---

## 5. Plan de fix V1.1.G — 5 étapes ordonnées

### A1 — DDL (DBA)
- Backup `pg_dump core` horodaté.
- Apply `_manual_20260509_v11g_01_tenant_agents.sql`.
- Vérif 5 lignes seed présentes.
- Owner : **Damien (DBA hat)**. Bloquant pour tout le reste.

### A2 — Patch backend session/cockpit (Builder backend)
1. Créer `src/lib/cockpit-session.ts` avec un helper unique `getCockpitSession(request)` :
   - lit JWT (auth) + résout cockpit (cookie `cockpit_tenant` ou hostname) + valide ACL superadmin/non-superadmin
   - retourne `{ userId, email, role, isSuperadmin, jwtTenantSlug, cockpitSlug, cockpitTenantId }`
2. Refacto `getSession()` et `getSessionV4()` pour s'appuyer dessus (compat shim).
3. Charger l'agent depuis `core.tenant_agents` via une fonction `getCockpitAgent(cockpitSlug)` cachée par `unstable_cache` (TTL 60s, tag `tenant-agents`).
4. Refacto :
   - `/api/agents/route.ts` → utilise `cockpitSlug` (pas `session.tenantSlug`) + lit `tenant_agents` au lieu de `TENANT_AGENTS` hardcoded.
   - `/api/v4/conversations/*` → filtrer par `cockpitTenantId` (pas `jwtTenantSlug`). Vérifier table `chat.conversation` : déjà colonne `tenant_slug`.
   - `/api/conversations/route.ts` + `stream` → idem cockpit + `getCockpitAgent`.
- Owner : **Builder backend**. Dépend de A1. ~2h.

### A3 — Patch frontend invalidation (Builder frontend)
1. Étendre `useApi<T>(url, fallback)` → 2e signature `useApi<T>(url, fallback, deps?)` qui ajoute `deps` au `useEffect`.
2. Exposer dans `auth-context` (ou nouveau `cockpit-context`) le `cockpitSlug` lu d'un endpoint léger `/api/me/cockpit` (ou réutiliser `/api/me/features` qui retourne déjà `tenant`).
3. Tous les hooks agent/conversations passent `[cockpitSlug]` en deps.
4. `TenantSwitcher` → après POST `/api/me/switch-tenant`, broadcast un event ou bump un compteur global (`useCockpitVersion`) avant `router.refresh()` pour forcer revalidation client-side.
5. `ContextRail` → `key={cockpitSlug + activeAgent?.id}` pour reset l'état local au switch.
6. `ConversationsV4Workspace` → re-call `refreshLists()` quand `cockpitSlug` change.
- Owner : **Builder frontend**. Peut démarrer en parallèle d'A2 dès que contrat A2 défini. ~3h.

### A4 — Cleanup hardcodes "lea" / "Léa"
- Remplacer fallback `?? "lea"` par `?? cockpitAgent.slug` ou rendre l'agent **non-optionnel** dans le contrat des composants.
- `CommandCenterHero` : virer `TENANT_AGENT_NAME` local, lire `useCockpitAgent()`.
- Owner : **QA casseur + Builder frontend**. Dépend A3. ~1h.

### A5 — Tests acceptance Gilles + smoke
- Smokes serveur Damien (cf. §6).
- Recette navigateur unique groupée Gilles.
- Owner : **Damien (smokes) + Gilles (recette finale)**.

---

## 6. Critères d'acceptation

### Smokes serveur (Damien, automatisés via `curl`)
1. Login superadmin → cookie `mybotia_access` posé.
2. POST `/api/me/switch-tenant {slug:"vlmedical"}` → 200, cookie `cockpit_tenant=vlmedical` posé.
3. GET `/api/agents` → JSON contient `[{id:"max", name:"Max", ...}]` ; **NE contient pas** `lea`.
4. GET `/api/v4/conversations` → uniquement conversations avec `tenant_slug=vlmedical`. Aucune réf `tenant_slug=mybotia`.
5. GET `/api/me/features` → `tenant: "vlmedical"`.
6. POST `/api/me/switch-tenant {slug:"mybotia"}` → re-bascule. `/api/agents` → contient `lea`, plus `max`.
7. POST `/api/me/switch-tenant {slug:"igh"}` → `/api/agents` → contient `lucy` uniquement.
8. SQL : `SELECT count(*) FROM chat.conversation WHERE tenant_slug='vlmedical' AND agent_id NOT IN (SELECT primary_agent_slug FROM core.tenant_agents JOIN core.tenant ON tenant_id=tenant.id WHERE slug='vlmedical');` → **0** (intégrité).

### Recette navigateur Gilles (groupée, après A5)
- [ ] Login superadmin sur `app.mybotia.com` → VoicePanel = Léa, conv MyBotIA visibles.
- [ ] Switch sidebar → VLMedical : VoicePanel passe **de Léa à Max en <2s** (pas de reload manuel).
- [ ] Conversations VLM affichent uniquement celles taggées `vlmedical` ; aucune ref MyBotIA dans le titre/agent.
- [ ] WS voice URL ouvert par VoicePanel = `wss://voice-vlmedical.mybotia.com/ws` (DevTools Network).
- [ ] Refresh navigateur (F5) sur cockpit VLM : reste sur Max, pas de flash Léa.
- [ ] Switch IGH → VoicePanel = Lucy, voice URL = `wss://voice-lucy.mybotia.com/ws`.
- [ ] Switch CMB Lux → VoicePanel = Raphaël.
- [ ] Retour MyBotIA → Léa réapparaît, conv mybotia restaurées.
- [ ] DevTools Application → cookie `cockpit_tenant` change à chaque switch.
- [ ] Aucun warning/erreur console côté client.

### Garde-fous fail-closed
- [ ] Si tenant non présent dans `core.tenant_agents` → `/api/agents` retourne `[]` + `/api/me/features` retourne `agents:null`. UI affiche "Aucun agent configuré pour ce tenant" (pas de fallback Léa).
- [ ] User non-superadmin avec cookie `cockpit_tenant` injecté manuellement → cookie ignoré (déjà couvert par `resolveCockpitTenants` ACL — vérifier que A2 préserve cette défense en profondeur).

---

## Annexes

- DDL : `/opt/mybotia/mybotia-business/drizzle/_manual_20260509_v11g_01_tenant_agents.sql`
- Doctrine source : `/root/.claude/projects/-root/memory/doctrine_tenant_aware_agent_layer.md`
- Doctrine tenant_slug autorité : `/root/.claude/projects/-root/memory/feedback_no_delete_igh_lucy.md`
- Doctrine voice gender : `/root/.claude/projects/-root/memory/project_voice_id_par_genre.md`
- Routes touchées (à patcher en A2) :
  - `/opt/mybotia/mybotia-app/src/lib/session.ts`
  - `/opt/mybotia/mybotia-app/src/lib/v4/session.ts`
  - `/opt/mybotia/mybotia-app/src/lib/tenant-resolver.ts`
  - `/opt/mybotia/mybotia-app/src/app/api/agents/route.ts`
  - `/opt/mybotia/mybotia-app/src/app/api/v4/conversations/route.ts`
  - `/opt/mybotia/mybotia-app/src/app/api/v4/conversations/[id]/route.ts`
  - `/opt/mybotia/mybotia-app/src/app/api/v4/conversations/[id]/messages/route.ts`
  - `/opt/mybotia/mybotia-app/src/app/api/conversations/route.ts`
  - `/opt/mybotia/mybotia-app/src/app/api/conversations/stream/route.ts`
- Composants UI à patcher en A3/A4 :
  - `/opt/mybotia/mybotia-app/src/hooks/use-api.ts`
  - `/opt/mybotia/mybotia-app/src/components/layout/AppShell.tsx`
  - `/opt/mybotia/mybotia-app/src/components/layout/ContextRail.tsx`
  - `/opt/mybotia/mybotia-app/src/components/layout/TenantSwitcher.tsx`
  - `/opt/mybotia/mybotia-app/src/components/conversations/ConversationsV4Workspace.tsx`
  - `/opt/mybotia/mybotia-app/src/components/home/CommandCenterHero.tsx`
  - `/opt/mybotia/mybotia-app/src/lib/voice-config.ts` (déjà bon, vérifier `wss` URLs nginx)
