# Parcours recette navigateur — Gilles (V1.1.E)

Recette finale unique app.mybotia.com, navigateur (Chrome desktop + iPhone 375 px).
Connexion attendue : `gilleskorzec@gmail.com`, cockpit superadmin.
Format : URL exacte, action UI, attendu visuel, KO si.

---

## G-01 — Sidebar et branding tenant (cockpit MyBotIA)

- URL : `https://app.mybotia.com/`
- Action : ouvrir l'application après login. Observer la sidebar gauche.
- Attendu :
  - En haut, bloc logo + wordmark "MyBotIA" + sous-libellé conforme à la charte.
  - Juste en dessous, switcher de cockpit avec badge coloré 32×32 (initiales), nom du tenant courant, et libellé "Superadmin · Cockpit standard" (ou "Cockpit dédié").
  - Groupes navigation : Pilotage / Commercial / Finance / Opérations / Agents IA. Aucun groupe vide affiché.
  - État actif sur l'item courant (Tableau de bord) : fond teinté à la couleur du tenant + barre verticale gauche colorée.
  - Bas : bloc Préférences puis (superadmin + adminTools actif) Modules / Tenants / Billing IA / Usage tokens / Protocoles WhatsApp.
  - Pied de sidebar : avatar utilisateur + nom + ligne `tenant_slug · role`.
- KO si : terme "Dolibarr" visible (interdit côté UI), libellé "Projet" à la place de "Affaire" ou "Production", sidebar vide, bloc tenant en `animate-pulse` qui ne sort jamais du loading.

## G-02 — Modules tenant (console superadmin)

- URL : `https://app.mybotia.com/admin/tenants/mybotia`
- Action : page se charge. Faire défiler.
- Attendu :
  - Header branding avec barre verticale gauche colorée + badge 48×48 (logo ou initiales), `displayName` MyBotIA, ligne meta `slug=mybotia · ... · profile=... · active`.
  - Compteur `enabledModules / totalModules` à droite + nombre d'utilisateurs.
  - Sections successives : Informations générales (UUID, locale, timezone, quotas), Modules (matrice toggle), Branding (lecture seule V1.1.E, mention explicite), Features cockpit (cases à cocher), Modèle économique (textarea JSON), Connexions / outils (lecture masquée, état configuré/manquant), Architecture, Catalogue, Stock, Livraisons, Transport, Panel VLM (si enabled), Audit log.
  - Footer collant en bas : bouton "Enregistrer features / business model" désactivé tant qu'aucune modification n'a été effectuée.
- KO si : 401/403 superadmin, secret en clair dans connexions, JSON `business_model` non valide accepté sans message d'erreur, libellé "Projet" dans la matrice modules.

## G-03 — Liste Affaires

- URL : `https://app.mybotia.com/affaires`
- Action : ouvrir la page. Tester filtres (stage, recherche, tri).
- Attendu :
  - Header `ModuleHeader` icône Briefcase, titre "Affaires", sous-titre `N affaire(s) · M affichée(s)`, bouton primaire "Nouvelle affaire" en haut à droite.
  - Carte filtres : champ recherche (titre/client), boutons tri Création/Date close/Potentiel, chips stages (Prospect, Qualifié, En cours, En attente, Gagné, Perdu, Abandonné).
  - Si aucune affaire : `EmptyState` avec icône TrendingUp, texte explicatif et bouton "Nouvelle affaire" actionnable.
  - Si filtres trop restrictifs : carte centrée "Aucune affaire ne correspond à ces filtres."
  - Sinon : table desktop avec colonnes Stage / Titre / Client / Potentiel / Date close / Création. Mobile : cards.
- KO si : l'endpoint `/api/affaires` retourne une erreur sans déclencher `ErrorState` (titre "Module Affaires non disponible" + bouton réessayer), totaux figés type "12 affaires" alors que liste vide, lien `/affaires/[id]` cassé.

## G-04 — Créer une affaire (modale)

- URL : `https://app.mybotia.com/affaires` puis clic "Nouvelle affaire".
- Action : remplir Titre = "Test recette G-04", Client = un client existant, Stage = Prospect, Date close = J+30, montants vides, Notes vides. Soumettre.
- Attendu :
  - Modale `FormModal` avec autofocus sur Titre, libellés en français : Titre *, Client *, Stage, Propriétaire (UUID utilisateur), Date close prévue, Montant potentiel one-shot HT (€), MRR potentiel HT (€/mois), Notes.
  - Liste des clients triée alphabétiquement.
  - Validation Zod côté client : Titre requis, Client UUID requis.
  - Sur succès : toast "Affaire créée", redirection vers `/affaires/[nouvelId]`.
  - Sur 401/403 : message "Authentification requise — reconnectez-vous."
  - Sur `feature_disabled` : "Module Pipeline non activé pour ce tenant."
- KO si : champ "Propriétaire (UUID utilisateur)" présenté comme obligatoire, dropdown Stage avec libellés en anglais, double soumission possible (bouton non désactivé), message d'erreur en anglais brut.

## G-05 — Signer une affaire (mode mixte 5 000 € + 2 abonnements)

- URL : `https://app.mybotia.com/affaires/[id]` sur l'affaire G-04 puis clic "Marquer signée".
- Pré-requis : un devis accepté lié au client de l'affaire.
- Action : choisir le devis dans le dropdown, Mode = Mixte (one-shot + récurrent), Montant one-shot HT = 5000.00, Date signature = aujourd'hui, ajouter 2 abonnements : "Maintenance" 290.00 mensuel début aujourd'hui, "Tokens IA" 150.00 mensuel début aujourd'hui. Confirmer.
- Attendu :
  - Bloc Abonnements visible avec 2 lignes (Libellé / MRR HT / Cycle / Date début / corbeille).
  - Validation Zod : libellé requis, MRR montant valide, date au format ISO.
  - Sur succès : toast "Affaire signée → Production créée", redirection vers `/productions/[id]` (id partagé entre affaire et production en V1.1.D).
  - Sur 409 ou `already_signed` : toast info "Cette affaire est déjà signée" et redirection.
- KO si : possibilité de soumettre Mixte sans abonnement, possibilité de soumettre Récurrent avec montant one-shot, devis sélectionné non visible, redirection sur `/affaires/[id]` au lieu de `/productions/[id]`.

## G-06 — Voir la production créée

- URL : `https://app.mybotia.com/productions/[id]` (issu de la signature G-05).
- Action : la page se charge.
- Attendu :
  - Lien retour "Productions" en haut à gauche.
  - Carte header : badge stage (En cours), badge billing mode (Mixte, fond fuchsia), icône Hammer, titre `productionTitle`, description si renseignée.
  - Boutons d'action : Modifier, Archiver (désactivé si déjà abandonné), "Générer facture" avec lien vers `/billing?production_id=...`.
  - Grille MetaCard 4 colonnes : Client (lien `/crm/[id]`), Affaire d'origine (lien `/affaires/[id]`), Date de début, Livraison prévue, Owner, Prochaine action.
  - Bloc revenus mixtes : DEUX colonnes obligatoires One-shot HT (5 000 €) + Récurrent MRR HT (290 + 150 = 440 €/mois) avec table des abonnements (Libellé / MRR HT / Cycle / Début / Fin / Statut).
  - Bloc Factures émises : empty state cliquable "Émettre la première facture".
- KO si : MRR ne montre qu'un seul abonnement, billing mode = "One-shot" alors que mixte, lien Affaire d'origine 404, montants en USD au lieu d'EUR.

## G-07 — Ajouter un abonnement à la production

- URL : `https://app.mybotia.com/productions/[id]` puis clic "Nouvel abonnement" dans la colonne Récurrent.
- Action : remplir un troisième abonnement "Hébergement" 60.00 mensuel début aujourd'hui. Valider.
- Attendu :
  - Modale `AddSubscriptionModal` avec mêmes champs que G-05 ligne par ligne.
  - Sur succès : `refetch` automatique, le tableau récurrent passe à 3 lignes, MRR HT total recalculé à 500 €/mois.
  - L'icône Plus accent-primary reste visible et fonctionnelle pour ajouter d'autres lignes.
- KO si : le tableau ne se rafraîchit pas sans hard refresh (F5), MRR figé à 440 €/mois, doublon créé en double clic.

## G-08 — Page Finance (3 KPI + tableaux)

- URL : `https://app.mybotia.com/finance`
- Action : page se charge sur l'exercice courant. Tester sélecteur année (N-1 / N / N+1) + bouton "Actualiser".
- Attendu :
  - Header "Trésorerie" + sous-titre `Cockpit MyBotIA · exercice 2026`.
  - 3 KPI : MRR actif HT (avec hint ARR), One-shot signé YYYY, Portefeuille global (ARR + one-shot YTD).
  - Si `mrr_active_ht === 0 && oneshot_ytd_ht === 0` : bloc "Aucune facture émise — démarre la première."
  - Graphique 12 mois empilé (MRR + one-shot), légende explicite.
  - Tableau "Détail mensuel" 12 lignes (mois, MRR HT, one-shot HT, total).
  - Section "Abonnements actifs" (table desktop + cards mobile).
  - Section "Dernières factures" (table desktop + cards mobile, bouton PDF + lien Voir).
  - Lien bas de page vers `/finance/kpis` pour la vue multi-sources Dolibarr.
- KO si : "EUR" devient "$" pour un tenant non-EUR sans gestion de currency, KPI MRR à 0 € alors que G-07 a livré 500 €/mois, graphique sans labels mois français, table tronquée < 768 px (mobile cards manquantes).

## G-09 — Télécharger le PDF d'un devis

- URL : `https://app.mybotia.com/affaires/[id]` puis cliquer le numéro d'un devis dans la table "Devis associés", OU `https://app.mybotia.com/finance` puis bouton "PDF" sur une facture.
- Action : déclencher le téléchargement.
- Attendu :
  - Pour facture business : `GET /api/invoices/[id]/pdf` ouvre dans un nouvel onglet, PDF Premium MyBotIA téléchargé.
  - Pour devis (V1.1.E) : la table affaire/[id] présente Numéro / Statut / HT / TTC / Date sans bouton PDF natif. Le téléchargement passe par `/finance` ou la page Documents.
- KO si : 404 sur l'URL PDF, PDF affiché avec branding "Dolibarr", PDF en page blanche, ouverture dans la même fenêtre (perte du contexte).

## G-10 — Tenant switcher (mybotia → vlmedical → retour)

- URL : `https://app.mybotia.com/` (cockpit MyBotIA).
- Action : cliquer le bandeau switcher en haut de sidebar. Choisir "VL Medical" dans le dropdown. Attendre la bascule. Rouvrir le switcher, choisir à nouveau "MyBotIA".
- Attendu :
  - Dropdown s'ouvre uniquement si superadmin et au moins 2 tenants disponibles. Sinon read-only.
  - Liste "Cockpits disponibles" avec badge couleur, slug, profile.
  - Pendant la bascule : `Loader2` sur la ligne cliquée.
  - Sur succès : toast bottom-right "Cockpit basculé sur VL Medical", redirection `/` + `router.refresh()`. La sidebar adopte la couleur primaire VLM, le wordmark + sub-label changent, l'entrée "VL Medical" du groupe "Vertical métier" apparaît.
  - Retour mybotia : entrée VL Medical disparaît, couleur revient au primaire MyBotIA.
- KO si : entrée "VL Medical" toujours visible après bascule sur mybotia (bypass cockpit boundary interdit), erreur 503 muette, double bascule possible (bouton non désactivé pendant `switching`).

## G-11 — Mobile 375 px (drawer + cards)

- URL : `https://app.mybotia.com/affaires` puis `https://app.mybotia.com/finance` en viewport iPhone SE (375×667 px).
- Action : ouvrir le menu hamburger pour afficher le drawer mobile, naviguer entre Affaires et Finance, vérifier les listes.
- Attendu :
  - `MobileNavDrawer` avec sidebar pleine largeur, click sur un lien interne ferme le drawer.
  - Page Affaires : passage table → cards (`md:hidden`), badge stage + date à droite, titre, client, potentiel.
  - Page Productions/[id] : grille MetaCard passe en 1 colonne, abonnements en table scrollable horizontalement, factures en cards.
  - Page Finance : KPI en 1 colonne, sections "Abonnements actifs" et "Dernières factures" en cards.
- KO si : table desktop affichée en mobile (overflow horizontal incontrôlé), drawer ne se ferme pas après navigation, lecture impossible (texte hors écran), bouton CTA non tappable (< 44 px).

## G-12 — Logout

- URL : depuis n'importe quelle page authentifiée, cliquer l'icône `LogOut` en bas de sidebar (à côté de l'avatar utilisateur).
- Action : confirmer la déconnexion. Tenter de revenir sur `/affaires` directement.
- Attendu :
  - Logout invalide la session (cookie / SSO MyBotIA).
  - Redirection sur `/login` (ou page d'auth équivalente).
  - Tentative d'accès à une page protégée redirige vers login, pas d'écran à moitié rendu.
  - La doctrine `core.session` (logout révoque la session côté serveur) doit être respectée.
- KO si : retour automatique sur l'app sans re-login (session non révoquée), bouton Logout absent, message d'erreur en anglais, retour direct sur `/affaires` accepté après logout.

---

## Périmètre non couvert par cette recette

- WhatsApp / voice (validés par smokes serveur).
- MCP MyBotIA (chatgpt.mybotia.com).
- Bridge Claude Code et runtime Léa.
- Pages CRM internes Dolibarr (interdites côté UI cockpit, doctrine `app.mybotia = parité CRM`).
