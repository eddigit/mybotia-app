# Bugs anticipés — recette Gilles app.mybotia.com (V1.1.E)

Recensés à partir de la lecture statique de :
- `src/app/affaires/page.tsx` + `[id]/page.tsx`
- `src/app/productions/page.tsx` + `[id]/page.tsx`
- `src/app/finance/page.tsx`
- `src/app/admin/tenants/page.tsx` + `[slug]/page.tsx`
- `src/components/affaires/CreateAffaireModal.tsx`
- `src/components/affaires/SignAffaireModal.tsx`
- `src/components/layout/LeftSidebar.tsx`
- `src/components/layout/TenantSwitcher.tsx`

Format :
`BUG-AG-NN | Catégorie | Description | Étape | Probabilité | Sévérité`

---

| ID | Catégorie | Description | Étape | Probabilité | Sévérité |
|----|-----------|-------------|-------|-------------|----------|
| BUG-AG-01 | Empty state | Le bloc "Cockpits disponibles" reste figé en `animate-pulse` si `/api/me/tenants` met plus de quelques secondes à répondre, sans timeout visible côté UI. | G-01 / G-10 | moyenne | UX |
| BUG-AG-02 | Données | Le proxy `/api/affaires` peut renvoyer des champs en snake_case ou camelCase (cf. `AffaireRowLike`). Si le backend bascule l'un sans l'autre, `clientId` ou `due_date` deviennent vides en table. | G-03 | moyenne | mineur |
| BUG-AG-03 | Filtres | Le filtre `billingFilter` sur `/productions` déclenche un fetch `/api/productions/[id]/subscriptions` par production (lazy mais N+1). Sur 30+ productions, page lente et possible rate-limit. | G-06 | moyenne | UX |
| BUG-AG-04 | Données | `billingMode` côté liste productions est dérivé d'une heuristique (sub active = recurring, pas de moyen de distinguer mixed sans détail). Filtre "Mixte" ne remontera jamais de ligne en liste, contrairement à la fiche détail. | G-06 | haute | UX |
| BUG-AG-05 | Validation | `CreateAffaireModal` accepte `oneshotAmountHt` négatif via la regex `^-?\d+(\.\d{1,2})?$` alors que `min="0"` côté HTML. Soumission via API sans contrôle Zod côté serveur = montant négatif accepté. | G-04 | basse | dette |
| BUG-AG-06 | Flux signature | `SignAffaireModal` filtre les devis acceptés via `q.projectId === affaireId` puis fallback "tous les devis acceptés du client". Si le client a plusieurs affaires, le devis d'une autre affaire peut être proposé par défaut. | G-05 | moyenne | bloquant |
| BUG-AG-07 | Flux signature | `defaultOneshotHt` / `defaultMrrHt` sont lus depuis l'objet `affaire` (champs hors DDL livrée). Si le backend ne renvoie pas ces snapshots, le mode inféré tombe sur "one_shot" même quand l'affaire est mixte. | G-05 | haute | UX |
| BUG-AG-08 | UX | `Marquer signée` est désactivé seulement sur `lifecycle_stage === "production"` ou `status === "abandoned"`. Une affaire `won` mais pas encore basculée peut être signée deux fois si la 2e tentative arrive avant le rerender (fenêtre de course). 409 attrape ensuite mais friction. | G-05 | basse | mineur |
| BUG-AG-09 | Empty state | Section "Activité récente" sur fiche affaire affiche un texte explicite "endpoint audit non livré V1.1.D" mention `audit_logs` en clair. Visible côté Gilles, alors que la doctrine demande de masquer le jargon technique. | G-05 | haute | UX |
| BUG-AG-10 | Devis associés | Sur la fiche affaire, si aucun devis n'est lié à `projectId` mais que le client en a, la liste retombe sur tous les devis du client (`linkedQuotes` = `quotes`). Risque de confusion : Gilles voit des devis n'appartenant pas à cette affaire. | G-05 | haute | bloquant |
| BUG-AG-11 | Données | `formatMoneyCompactFR` est utilisé pour les KPI Production (one-shot HT / MRR HT). Au-delà de 1 000 €, l'arrondi compact peut afficher "1 k" au lieu du montant exact attendu en recette. | G-06 | moyenne | mineur |
| BUG-AG-12 | Routing | Lien "Affaire d'origine" dans MetaCard production utilise `production.id` comme cible `/affaires/[id]`. Si dans une future DDL l'id production diverge de l'id affaire, le lien tombera en 404 silencieuse. | G-06 | basse | dette |
| BUG-AG-13 | Flux factures | Bouton "Émettre la première facture" pointe vers `/billing?production_id=...` mais aucune trace dans la sidebar d'une page `/billing` exposée à l'utilisateur final. Risque de 404 ou page admin only. | G-06 / G-08 | haute | bloquant |
| BUG-AG-14 | Sidebar | Items "Devis" et "Factures" du groupe Finance pointent sur `/finance#devis` et `/finance#factures` (ancres) car les routes dédiées V1.2 ne sont pas livrées. La page `/finance` actuelle n'expose pas ces ancres : le clic ne défile nulle part. | G-08 | haute | UX |
| BUG-AG-15 | Finance | Bouton PDF des factures "non business" pointe sur `/api/documents/download?modulepart=facture&ref=...`, route Dolibarr legacy. Si le tenant courant a basculé sur `mybotia_business`, l'URL reste construite mais la condition `isBusiness` masque seulement le bouton, pas l'URL — race possible si flag mal résolu. | G-09 | basse | dette |
| BUG-AG-16 | Tenant switcher | `effectiveDisplayName` retombe sur `t.displayName` DB si `getTenantBranding` ne connaît pas le slug. Pour un nouveau tenant non câblé dans `branding.ts`, le switcher peut afficher un nom différent du logo (logo fallback générique). | G-10 | moyenne | UX |
| BUG-AG-17 | Permissions | Doctrine `feedback_sidebar_cockpit_boundary` : item "VL Medical" dépend uniquement de `cockpitFeatures.tenant === "vlmedical"`. Si le hook `useCockpitFeatures` renvoie `null` (loading), le filtre `isModuleAllowed` laisse passer mais `isTenantAllowed` reste strict — flash possible où VL Medical apparaît côté admin tools après bascule. | G-10 | basse | mineur |
| BUG-AG-18 | Mobile | `LeftSidebar` en variant `mobile` ferme le drawer au clic sur `a[href]`. Mais clic sur `<button>` switcher de cockpit ne ferme PAS le drawer — Gilles ouvre le dropdown puis se retrouve avec drawer + dropdown empilés. | G-11 | haute | UX |
| BUG-AG-19 | Mobile | Page Productions table récurrent utilise `overflow-x-auto -mx-1`. Sur 375 px avec 6 colonnes, défilement horizontal non guidé (pas d'indicateur visuel "swipe →"). Confusion possible. | G-11 | moyenne | UX |
| BUG-AG-20 | Logout | `useAuth().logout` est appelé via bouton sidebar. La sidebar n'indique pas l'état "déconnexion en cours" (pas de spinner). Si la requête lente, double clic possible → 2 appels logout et toast d'erreur sur le 2nd. Aussi : pas de fallback visible côté UI si la session côté serveur (`core.session`) ne se révoque pas. | G-12 | basse | mineur |
