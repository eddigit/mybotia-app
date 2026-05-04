-- ===================================================================
-- Seed initial des protocoles WhatsApp importés depuis groups.json + jid_index.json
-- Non exécuté automatiquement par les migrations
-- À lancer manuellement uniquement si besoin de replay
-- ===================================================================
--
-- LEA-WA-IMPORT-EXISTING-PROTOCOLS — Seed core.whatsapp_protocols
-- Date : 2026-05-04
-- Pré-requis : core.whatsapp_protocols doit exister
--   (cf migrations/2026-05-04-lea-wa-protocols.sql)
--
-- Sources :
--   - /opt/mybotia/mybotia-gateway/groups.json (21 lignes)
--   - /opt/mybotia/agents/lea/workspace/clients/jid_index.json + profils
--     (2 lignes Systemic, absentes du gateway, importées avec response_mode=silent)
--
-- Idempotent :
--   ON CONFLICT (jid) DO UPDATE met à jour les méta (group_name, tenant,
--   agent, category, response_mode, gilles_instruction_mode, status, notes),
--   mais protège protocol_text et operational_scope : si déjà non vides en
--   DB, ils ne sont PAS écrasés (CASE LIKE 'À compléter%' OR vide).
--
-- Replay :
--   cat seeds/2026-05-04-wa-protocols-initial.sql | docker exec -i \
--     mybotia-postgres psql -U mybotia -d mybotia_core

BEGIN;

-- Capture l'état avant pour rapport conflits
CREATE TEMP TABLE _import_log (
  jid text PRIMARY KEY,
  before_protocol_text text,
  before_operational_scope text
);

INSERT INTO _import_log (jid, before_protocol_text, before_operational_scope)
SELECT jid, protocol_text, operational_scope FROM core.whatsapp_protocols;

-- ===================================================================
-- INSERT/UPSERT — 23 lignes
-- ===================================================================

INSERT INTO core.whatsapp_protocols (
  jid, group_name, tenant_slug, agent_slug,
  category, response_mode, gilles_instruction_mode, status,
  operational_scope, protocol_text, notes
) VALUES
-- 1. Team Coach Digital GK (interne MyBotIA)
('120363407026699197@g.us', 'Team Coach Digital GK', 'mybotia', 'lea',
 'custom', 'operational_autonomous', 'send_direct_if_gilles_writes_exact_message', 'active',
 'Groupe interne MyBotIA (Gilles + Damien). Léa peut intervenir librement dans le périmètre interne, sans envoi externe.',
 'Groupe INTERNE MyBotIA. Léa peut intervenir librement, exécuter des actions internes, parler ouvertement avec Gilles et Damien. Aucune contrainte d''envoi externe car ce groupe ne contient pas de tiers.',
 'import gateway groups.json (profile=INTERNE reactivity=TOUJOURS)'),

-- 2. IA GROUPE IGH (client majeur, validation DM stricte)
('120363423979135043@g.us', 'IA GROUPE IGH', 'igh', 'lucy',
 'sensitive_validation', 'draft_only', 'draft_before_send', 'active',
 'Validation sensible. Aucune action sans GO Gilles. Brouillon DM uniquement.',
 'CLIENT majeur 51840 EUR/an. VALIDATION_DM STRICT : Lucy reçoit un message, rédige sa réponse, envoie le BROUILLON en DM à Gilles, attend GO pour envoyer dans le groupe. SANS GO = PAS D''ENVOI. Aucune exception.',
 'import gateway groups.json (profile=CLIENT reactivity=VALIDATION_DM) + profil igh'),

-- 3. Clarisse Surin - Batonnat 2028 (DEMO stratégique Barreau)
('120363425376786580@g.us', 'Clarisse Surin - Batonnat 2028', 'mybotia', 'lea',
 'legal_workgroup', 'draft_only', 'draft_before_send', 'active',
 'Groupe avocats / juridique. Démonstration MyBotIA, structuration de demandes, contenus, sans conseil juridique ferme.',
 'DEMO stratégique - VITRINE pour le Barreau de Paris. Ton pro formel, commercial et juridique. Toujours répondre avec excellence. JAMAIS de prix, JAMAIS mentionner écosystème MyBotIA ou la technique. JAMAIS de réflexions internes en anglais. JAMAIS proposer de solutions gratuites. Brouillon Gilles obligatoire avant envoi.',
 'import gateway groups.json (profile=DEMO reactivity=TOUJOURS) + profil clarisse-surin'),

-- 4. Clarisse Surin - CLS Avocat (CLIENT pro formel)
('120363426451963719@g.us', 'Clarisse Surin - CLS Avocat', 'mybotia', 'lea',
 'legal_workgroup', 'draft_only', 'draft_before_send', 'active',
 'Groupe avocats / juridique. Démonstration MyBotIA, structuration de demandes, contenus, sans conseil juridique ferme.',
 'CLIENT pro formel, rassurant, expertise juridique. Démonstration IA fiable et connectée aux vraies sources (Judilibre, Legifrance, HUDOC, EUR-Lex). Toujours sourcer les infos juridiques. Être irréprochable. JAMAIS proposer de solutions gratuites. On n''est pas le tournevis, on est l''électricien. Brouillon Gilles obligatoire avant envoi.',
 'import gateway groups.json (profile=CLIENT reactivity=TOUJOURS) + profil clarisse-surin'),

-- 5. Hannah - Paypers (CLIENT projet web)
('120363425162106700@g.us', 'Hannah - Paypers', 'mybotia', 'lea',
 'web_project_delivery', 'draft_only', 'draft_before_send', 'active',
 'Projet web, cahier des charges, contenus, CRM, relance projet, vérification site, GitHub/Vercel si autorisé.',
 'CLIENT TOUJOURS, accompagnement co-construction application + mémoire de tous les échanges. Retenir TOUT ce qu''on échange, construire la mémoire du projet. Aider Hannah, cadrer les sessions de travail avec Gilles. Vitrine pour le père Hubert. JAMAIS proposer de solutions gratuites. Toujours répondre. Brouillon Gilles obligatoire avant envoi.',
 'import gateway groups.json (profile=CLIENT reactivity=TOUJOURS) + profil hannah-paypers'),

-- 6. Com BYRON (Pascal, projet web, prix Gilles directs)
('120363408599518725@g.us', 'Com BYRON', 'mybotia', 'lea',
 'web_project_delivery', 'draft_only', 'draft_before_send', 'active',
 'Projet web, cahier des charges, contenus, CRM, relance projet, vérification site, GitHub/Vercel si autorisé.',
 'CLIENT SUR_DEMANDE. Pascal = relation amicale, Gilles gère directement les tarifs avec lui. Site web 948 EUR one-shot (non facturé, en attente validation). Brouillon Gilles obligatoire avant envoi. Aucune mention de prix ni engagement sans Gilles.',
 'import gateway groups.json (profile=CLIENT reactivity=SUR_DEMANDE) + profil byron'),

-- 7. Assistante Herve (PERSO)
('120363424295220178@g.us', 'Assistante Herve', 'mybotia', 'lea',
 'custom', 'draft_only', 'draft_before_send', 'active',
 'À compléter par Gilles.',
 'À compléter — protocole importé depuis groups.json (profile=PERSO reactivity=TOUJOURS). En attendant, Léa ne répond pas directement : brouillon Gilles par défaut. Aucun prix, devis, délai ferme, engagement ou décision sans validation Gilles.',
 'import gateway groups.json (profile=PERSO reactivity=TOUJOURS)'),

-- 8. ETF - Martine (operational autonomous)
('120363426071294259@g.us', 'ETF - Martine', 'mybotia', 'lea',
 'web_project_delivery', 'operational_autonomous', 'send_direct_if_gilles_writes_exact_message', 'active',
 'Support site, accès, contenu, rédaction, mises à jour simples, relance projet, CRM si projet identifié, GitHub/Vercel si autorisé.',
 'Léa intervient comme support opérationnel MyBotIA. Elle peut vérifier accès site, bug visible, contenu, mise à jour simple, rédaction et suivi projet. Elle ne doit pas se limiter à "je remonte à Gilles" si l''action est dans son périmètre. Elle ne parle jamais de prix, devis, facture, délai ferme ou engagement sans instruction explicite de Gilles. Pour les relances paiement, elle prépare un brouillon sauf si Gilles donne un texte exact ou un GO explicite. Elle ne prend jamais de décision à la place de Gilles. En cas de doute, elle prépare un résumé privé pour Gilles.',
 'import gateway groups.json (profile=CLIENT reactivity=SUR_DEMANDE) + profil martine-etf + brief CTO ETF (operational_autonomous)'),

-- 9. Clement Delpiano (cabinet avocat)
('120363424693375693@g.us', 'Clement Delpiano', 'mybotia', 'lea',
 'legal_workgroup', 'draft_only', 'draft_before_send', 'active',
 'Groupe avocats / juridique. Démonstration MyBotIA, structuration de demandes, contenus, sans conseil juridique ferme.',
 'À compléter — Cabinet Clément Delpiano. CLIENT SUR_DEMANDE. Brouillon Gilles obligatoire avant envoi. Pas de conseil juridique ferme.',
 'import gateway groups.json (profile=CLIENT reactivity=SUR_DEMANDE) + profil clement-delpiano'),

-- 10. Assistante Jean-Luc (VL Medical historique → silent)
('120363406232810102@g.us', 'Assistante Jean-Luc', 'vlmedical', 'max',
 'support_client', 'silent', 'draft_before_send', 'active',
 'Support opérationnel. Groupe historique : ne plus servir au quotidien, rediriger vers Max.',
 'Groupe historique de test VL Medical. Jean-Luc a maintenant Max comme collaborateur IA dédié. Ce groupe ne sert plus au quotidien. Si Jean-Luc écrit ici, ne pas répondre dans le groupe (silent), préparer un résumé privé pour Gilles afin qu''il redirige vers Max.',
 'import gateway groups.json (profile=CLIENT reactivity=SUR_DEMANDE) + profil vlmedical (groupe désaffecté)'),

-- 11. Academie Levinet (PERSO accompagnement gratuit)
('120363425931772536@g.us', 'Academie Levinet', 'mybotia', 'lea',
 'web_project_delivery', 'draft_only', 'draft_before_send', 'active',
 'Projet web, contenus simples, mises à jour modérées. Pas de nouvelles prestations.',
 'PERSO SUR_DEMANDE. Ton amical patient. Tarifs INTERDIT. Pas un client payant, accompagnement gratuit sur modifications simples. NE PAS proposer de nouvelles prestations. NE PAS s''engager sur du dev. Brouillon Gilles obligatoire avant envoi.',
 'import gateway groups.json (profile=PERSO reactivity=SUR_DEMANDE) + profil levinet'),

-- 12. Cannes Rachel (PERSO faible)
('120363405038000558@g.us', 'Cannes Rachel', 'mybotia', 'lea',
 'custom', 'draft_only', 'draft_before_send', 'active',
 'À compléter par Gilles.',
 'À compléter — protocole importé depuis groups.json (profile=PERSO reactivity=SUR_DEMANDE). En attendant, Léa ne répond pas directement : brouillon Gilles par défaut. Aucun prix, devis, délai ferme, engagement ou décision sans validation Gilles.',
 'import gateway groups.json (profile=PERSO reactivity=SUR_DEMANDE)'),

-- 13. Le Latin - Aymen (DEMO commercial)
('120363407466857521@g.us', 'Le Latin - Aymen', 'mybotia', 'lea',
 'commercial_demo', 'draft_only', 'draft_before_send', 'active',
 'Démonstration MyBotIA, explication du rôle de l''IA, préparation de réponses, sans prix ni engagement.',
 'DEMO SUR_DEMANDE. Proposition tarifaire 348 EUR/an (référence interne, ne pas l''annoncer sans GO Gilles). Brouillon Gilles obligatoire avant envoi.',
 'import gateway groups.json (profile=DEMO reactivity=SUR_DEMANDE) + profil latin'),

-- 14. Me Gilles Tobiana (avocat DEMO)
('120363407336999165@g.us', 'Me Gilles Tobiana', 'mybotia', 'lea',
 'legal_workgroup', 'draft_only', 'draft_before_send', 'active',
 'Groupe avocats / juridique. Démonstration MyBotIA, structuration de demandes, contenus, sans conseil juridique ferme.',
 'À compléter — Me Gilles Tobiana, avocat. DEMO SUR_DEMANDE. Brouillon Gilles obligatoire avant envoi. Pas de conseil juridique ferme.',
 'import gateway groups.json (profile=DEMO reactivity=SUR_DEMANDE) + profil tobiana'),

-- 15. CMB Lux (CORRECTION agent_slug=raphael)
('120363408556214663@g.us', 'CMB Lux', 'cmb_lux', 'raphael',
 'support_client', 'draft_only', 'draft_before_send', 'active',
 'Support opérationnel CMB Lux. Demande de précision, suivi client, contenu simple, vérification factuelle. Aucun engagement ni prix sans GO Gilles.',
 'CLIENT TOUJOURS. Tenant cmb_lux, agent Raphaël (corrigé : groups.json indiquait lea, doctrine actuelle = Raphaël agent CMB). Brouillon Gilles obligatoire avant envoi.',
 'import gateway groups.json (profile=CLIENT reactivity=TOUJOURS) + correction CTO agent_slug=raphael'),

-- 16. Mon cousin Jo (PERSO prospect)
('120363427087280014@g.us', 'Mon cousin Jo', 'mybotia', 'lea',
 'custom', 'draft_only', 'draft_before_send', 'active',
 'À compléter par Gilles.',
 'PERSO TOUJOURS. Geoffrey Korzec, cousin de Gilles. Entrepreneur bâtiment Lorraine. Prospect à convaincre, prix à négocier (Gilles seul). Brouillon Gilles obligatoire avant envoi.',
 'import gateway groups.json (profile=PERSO reactivity=TOUJOURS) + profil cousin-jo'),

-- 17. Ness ma femme (PERSO très perso → silent)
('120363424470242785@g.us', 'Ness ma femme', 'mybotia', 'lea',
 'custom', 'silent', 'draft_before_send', 'active',
 'À compléter par Gilles. Groupe très personnel.',
 'PERSO SUR_DEMANDE. Très perso (épouse de Gilles). Silent par défaut. Aucune intervention sans GO explicite Gilles.',
 'import gateway groups.json (profile=PERSO reactivity=SUR_DEMANDE) + niveau personnel élevé'),

-- 18. Soutien Xavier (PERSO faible)
('120363406115931873@g.us', 'Soutien Xavier', 'mybotia', 'lea',
 'custom', 'draft_only', 'draft_before_send', 'active',
 'À compléter par Gilles.',
 'À compléter — protocole importé depuis groups.json (profile=PERSO reactivity=SUR_DEMANDE). En attendant, Léa ne répond pas directement : brouillon Gilles par défaut. Aucun prix, devis, délai ferme, engagement ou décision sans validation Gilles.',
 'import gateway groups.json (profile=PERSO reactivity=SUR_DEMANDE)'),

-- 19. Soutien Clemsen (PERSO faible)
('120363406481118458@g.us', 'Soutien Clemsen', 'mybotia', 'lea',
 'custom', 'draft_only', 'draft_before_send', 'active',
 'À compléter par Gilles.',
 'À compléter — protocole importé depuis groups.json (profile=PERSO reactivity=SUR_DEMANDE). En attendant, Léa ne répond pas directement : brouillon Gilles par défaut. Aucun prix, devis, délai ferme, engagement ou décision sans validation Gilles.',
 'import gateway groups.json (profile=PERSO reactivity=SUR_DEMANDE)'),

-- 20. Maggia Coiffure (CLIENT projet web)
('120363424038612397@g.us', 'Maggia Coiffure', 'mybotia', 'lea',
 'web_project_delivery', 'draft_only', 'draft_before_send', 'active',
 'Projet web, cahier des charges, contenus, CRM, relance projet, vérification site, GitHub/Vercel si autorisé.',
 'À compléter — Maggia Coiffure. CLIENT SUR_DEMANDE. Brouillon Gilles obligatoire avant envoi. Aucun prix, devis, délai ferme, engagement ou décision sans validation Gilles.',
 'import gateway groups.json (profile=CLIENT reactivity=SUR_DEMANDE) + profil maggia'),

-- 21. Initiation Lucy (INTERNE formation)
('120363407877862678@g.us', 'Initiation Lucy', 'mybotia', 'lea',
 'custom', 'operational_autonomous', 'send_direct_if_gilles_writes_exact_message', 'active',
 'Groupe interne formation Lucy. Léa peut intervenir librement dans le périmètre interne.',
 'Groupe INTERNE de formation pour Lucy. Léa peut intervenir librement, expliquer, démontrer. Pas de tiers externe à protéger.',
 'import gateway groups.json (profile=INTERNE reactivity=TOUJOURS)'),

-- 22. Systemic groupe 1 (silent strict)
('120363423353502287@g.us', 'Systemic - Uber Tayeb (groupe 1)', 'mybotia', 'lea',
 'commercial_demo', 'silent', 'draft_before_send', 'active',
 'Démonstration MyBotIA. Protocole strict de non-intervention proactive.',
 'RÈGLE ABSOLUE — NE PAS PARLER EN PREMIER. Attendre que Uber Tayeb écrive lui-même. Tant qu''il n''a pas écrit : invisible, muette, zéro message. Gilles a insisté plusieurs fois. Toute intervention doit passer par validation Gilles, et même alors la posture par défaut est silent.',
 'import jid_index.json + profil systemic (absent de gateway groups.json, importé sur règle CTO avec verrou silent)'),

-- 23. Systemic groupe 2 (silent strict)
('120363408486777515@g.us', 'Systemic - Uber Tayeb (groupe 2)', 'mybotia', 'lea',
 'commercial_demo', 'silent', 'draft_before_send', 'active',
 'Démonstration MyBotIA. Protocole strict de non-intervention proactive.',
 'RÈGLE ABSOLUE — NE PAS PARLER EN PREMIER. Attendre que Uber Tayeb écrive lui-même. Tant qu''il n''a pas écrit : invisible, muette, zéro message. Gilles a insisté plusieurs fois. Toute intervention doit passer par validation Gilles, et même alors la posture par défaut est silent.',
 'import jid_index.json + profil systemic (absent de gateway groups.json, importé sur règle CTO avec verrou silent)')

ON CONFLICT (jid) DO UPDATE SET
  group_name              = EXCLUDED.group_name,
  tenant_slug             = EXCLUDED.tenant_slug,
  agent_slug              = EXCLUDED.agent_slug,
  category                = EXCLUDED.category,
  response_mode           = EXCLUDED.response_mode,
  gilles_instruction_mode = EXCLUDED.gilles_instruction_mode,
  status                  = EXCLUDED.status,
  notes                   = EXCLUDED.notes,
  -- Protection : ne pas écraser un protocol_text déjà rempli manuellement
  protocol_text = CASE
    WHEN core.whatsapp_protocols.protocol_text IS NULL
      OR core.whatsapp_protocols.protocol_text = ''
      OR core.whatsapp_protocols.protocol_text LIKE 'À compléter%'
      THEN EXCLUDED.protocol_text
    ELSE core.whatsapp_protocols.protocol_text
  END,
  operational_scope = CASE
    WHEN core.whatsapp_protocols.operational_scope IS NULL
      OR core.whatsapp_protocols.operational_scope = ''
      OR core.whatsapp_protocols.operational_scope LIKE 'À compléter%'
      THEN EXCLUDED.operational_scope
    ELSE core.whatsapp_protocols.operational_scope
  END,
  updated_at = now();

-- ===================================================================
-- Rapport conflits préservés
-- ===================================================================
\echo === Conflits non écrasés (protocol_text déjà personnalisé en DB) ===
SELECT l.jid, p.group_name, l.before_protocol_text, p.protocol_text AS current_protocol_text
  FROM _import_log l
  JOIN core.whatsapp_protocols p USING (jid)
  WHERE l.before_protocol_text IS NOT NULL
    AND l.before_protocol_text <> ''
    AND l.before_protocol_text NOT LIKE 'À compléter%'
    AND l.before_protocol_text <> p.protocol_text;

COMMIT;
