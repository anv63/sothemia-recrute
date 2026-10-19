// Developer handoff content — single source for the « Design & handoff » screen and docs/HANDOFF.md
// (regenerate with: node --experimental-strip-types scripts/gen-handoff.ts > docs/HANDOFF.md). Pure data, no imports.

export const COLORS: { group: string; tokens: { name: string; hex: string; use: string; contrast?: string }[] }[] = [
  { group: 'Texte (navy)', tokens: [
    { name: 'ink', hex: '#0B1F3A', use: 'Titres, texte principal, valeurs', contrast: '16.5:1' },
    { name: 'ink-2', hex: '#34465F', use: 'Texte courant, libellés de cellule', contrast: '9.6:1' },
    { name: 'ink-3', hex: '#5B6B82', use: 'Texte secondaire, en-têtes de tableau', contrast: '5.4:1' },
    { name: 'ink-4', hex: '#8492A6', use: 'Placeholders, indices non essentiels', contrast: '3.2:1 (non textuel)' },
  ] },
  { group: 'Surfaces & lignes', tokens: [
    { name: 'canvas', hex: '#F4F6F9', use: "Fond d'application" },
    { name: 'surface', hex: '#FFFFFF', use: 'Cartes, tableaux, modales' },
    { name: 'subtle', hex: '#F8FAFC', use: 'En-têtes de tableau, pieds de carte' },
    { name: 'line', hex: '#E3E8EF', use: 'Séparateurs, bordures de carte' },
    { name: 'line-strong', hex: '#C9D2DE', use: 'Bordures de champs et boutons secondaires' },
  ] },
  { group: 'Marque — bleu Sothema', tokens: [
    { name: 'brand-50', hex: '#EBF3FC', use: 'Fond actif (navigation, sélection)' },
    { name: 'brand-100', hex: '#D5E5F8', use: 'Anneau de focus, bordure de puce' },
    { name: 'brand-500', hex: '#1A6FD1', use: 'Contour de focus' },
    { name: 'brand-600', hex: '#0A5BB8', use: 'Bouton principal, liens, barres', contrast: '6.6:1' },
    { name: 'brand-700', hex: '#084A97', use: 'Survol du principal, liens actifs', contrast: '8.6:1' },
    { name: 'brand-800', hex: '#083B76', use: 'Texte sur fond brand-50', contrast: '11.1:1' },
  ] },
  { group: 'Accent — teal', tokens: [
    { name: 'sea-50', hex: '#E7F6F4', use: 'Fond de critères issus d\'un profil de poste' },
    { name: 'sea-500', hex: '#12998E', use: 'Point du logo, séries de graphiques' },
    { name: 'sea-600', hex: '#0D8178', use: 'Bouton « Marquer comme relue », avatar', contrast: '4.7:1' },
    { name: 'sea-700', hex: '#0A6760', use: 'Texte teal', contrast: '6.7:1' },
  ] },
  { group: 'Sémantique', tokens: [
    { name: 'ok-600 / ok-50', hex: '#12804F', use: 'Prêt, satisfait, score ≥ 75', contrast: '5.0:1' },
    { name: 'warn-600 / warn-50', hex: '#A35B00', use: 'Partiel, à relire, doublon, clé manquante, score < 50', contrast: '5.2:1' },
    { name: 'bad-600 / bad-50', hex: '#B42318', use: 'Erreur, faible confiance, suppression', contrast: '6.6:1' },
    { name: 'violet-600 / violet-50', hex: '#5B4BC4', use: 'Contenu généré par IA (recommandation)', contrast: '6.5:1' },
  ] },
]

export const TYPE_SCALE = [
  { name: 'Titre de page', spec: '22 / 28 · 600 · -0.01em', sample: 'CVthèque', cls: 'text-[22px] leading-7 font-semibold tracking-tight' },
  { name: 'Métrique', spec: '28 / 28 · 600 · chiffres tabulaires', sample: '1 284', cls: 'text-[28px] leading-none font-semibold tabular' },
  { name: 'Titre de carte', spec: '15 / 24 · 600', sample: 'État du traitement', cls: 'text-[15px] leading-6 font-semibold' },
  { name: 'Corps', spec: '14 / 20 · 400', sample: 'Pharmacienne assurance qualité, 8 ans d\'expérience.', cls: 'text-sm' },
  { name: 'Secondaire', spec: '13 / 18 · 400–500', sample: 'Rattachement déduit du poste visé', cls: 'text-[13px] text-ink-3' },
  { name: 'Légende', spec: '12 / 16 · 400–500', sample: 'Reçu il y a 2 heures', cls: 'text-xs text-ink-3' },
  { name: 'Surtitre', spec: '11 / 16 · 600 · MAJ · +0.06em', sample: 'COMPÉTENCES', cls: 'text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3' },
  { name: 'Mono', spec: 'IBM Plex Mono 12 / 16', sample: 'CAND-0007 · p. 1, l. 9', cls: 'font-mono text-xs text-ink-3' },
]

export const SPACING = [
  ['1', '4 px', 'Écart icône / texte compact'], ['2', '8 px', 'Écart entre puces, boutons groupés'], ['3', '12 px', 'Padding cellule, écart champ'],
  ['4', '16 px', 'Padding carte (tablette), gouttière'], ['5', '20 px', 'Padding carte (desktop)'], ['6', '24 px', 'Écart entre cartes / sections'], ['8', '32 px', 'Marge de page (desktop)'],
]

export const LAYOUT = [
  ['Desktop ≥ 1024 px (lg)', 'Barre latérale 240 px avec libellés · contenu max 1 480 px · marges 32 px · profil et analyse en 2 colonnes à partir de 1 280 px (xl)'],
  ['Tablette 768–1023 px (md)', 'Barre latérale en rail 64 px (icônes + info-bulles) · marges 24 px · colonnes empilées · tableaux à défilement horizontal avec colonne « Candidat » figée · colonnes Compétences / Statut RH / Date masquées'],
  ['Composants', 'Hauteur de contrôle 36 px (sm 32 px, lg 44 px) · rayon 6 px (contrôles), 10 px (cartes), 14 px (modales) · ombre « card » uniquement sur les cartes, « pop » sur menus et toasts'],
]

export const RADII_SHADOWS = [
  ['radius-sm', '4 px', 'Puces de compétences, squelettes'], ['radius-md', '6 px', 'Boutons, champs, badges'], ['radius-lg', '10 px', 'Cartes, zones de dépôt'], ['radius-xl', '14 px', 'Modales'],
  ['shadow-card', '0 1 2 / 5 % + 0 1 3 / 4 %', 'Cartes'], ['shadow-pop', '0 8 24 / 12 %', 'Menus, toasts, pages CV'], ['shadow-modal', '0 24 64 / 22 %', 'Modales'],
]

export const CONTROL_STATES = [
  ['Par défaut', 'Bordure line-strong, fond blanc'], ['Survol', 'Bordure ink-4 (champs) · fond subtle (secondaire) · brand-700 (principal)'],
  ['Focus clavier', 'Contour 2 px brand-500 + décalage 2 px ; champs : bordure brand-500 + halo 3 px brand-100'], ['Actif / pressé', 'brand-800 (principal), canvas (secondaire)'],
  ['Désactivé', 'Texte ink-4, fond brand-200 (principal), curseur not-allowed — utilisé quand l\'action est impossible (ex. rien à enregistrer)'],
  ['Chargement', 'Icône remplacée par un spinner, aria-busy, bouton non cliquable, libellé conservé ou précisé (« Analyse en cours… »)'],
  ['Verrouillé (non autorisé)', 'Icône cadenas + opacité 60 % ; reste cliquable et renvoie un toast « Action non autorisée » expliquant le rôle requis'],
  ['Invalide', 'Bordure bad-600 + message 12 px sous le champ, aria-invalid'],
]

export const STATES: { state: string; where: string; trigger: string; ui: string }[] = [
  { state: 'Vide', where: 'Tableau de bord, CVthèque, Analyses, Critères, file d\'import', trigger: 'Aucune ligne en base (Paramètres › Vider la base)', ui: 'EmptyState : icône, titre, explication, action principale (Importer des CV)' },
  { state: 'Chargement', where: 'Tous les écrans de lecture', trigger: 'Requête SELECT en cours (~400 ms)', ui: 'Squelettes à la forme du contenu (TableSkeleton, CardsSkeleton, DetailSkeleton), aria-busy' },
  { state: 'Traitement', where: 'Import, CVthèque, profil, barre latérale', trigger: 'processing ∈ received / extracting / analyzing / indexed', ui: 'Stepper 5 étapes + barre de progression, StatusBadge animé, bannière « Traitement en cours » sur le profil, compteur dans la barre latérale' },
  { state: 'Succès', where: 'Toute mutation', trigger: 'Promesse résolue', ui: 'Toast vert 4 s + mise à jour immédiate de la vue + entrée d\'audit' },
  { state: 'Erreur', where: 'Tous les écrans + mutations', trigger: 'Exception (SQLITE_BUSY, fichier illisible, délai fournisseur)', ui: 'ErrorState avec « Réessayer » pour les lectures ; toast rouge 7 s pour les mutations ; badge « Erreur » + bannière « Relancer » pour le traitement' },
  { state: 'Doublon', where: 'Import', trigger: 'Même SHA-256 (exact) ou même e-mail (probable)', ui: 'Exact : traitement suspendu, badge orange, actions Voir l\'existant / Ignorer / Importer quand même. Probable : avertissement non bloquant avec lien vers le dossier' },
  { state: 'Aucun résultat', where: 'CVthèque, Recherche, Analyses', trigger: 'Filtres ou critères sans correspondance', ui: 'NoResults + action pour retirer les filtres ; en recherche, nombre de profils masqués à score 0' },
  { state: 'Extraction faible confiance', where: 'Import, CVthèque, profil, analyse', trigger: 'confidence < 0,60 (PDF scanné, police encodée)', ui: 'Badge rouge « Faible confiance », icône dans la ligne du tableau, LowConfidenceBanner avec « Vérifier les champs », point de confiance par champ' },
  { state: 'Clé fournisseur manquante', where: 'Paramètres IA, Import, Analyse', trigger: 'keyStatus ≠ configured', ui: 'Badge « Clé manquante », MissingKeyBanner avec « Configurer », option « (clé manquante) » dans les listes, repli automatique sur l\'analyse locale' },
  { state: 'Action non autorisée', where: 'Boutons et menus soumis à permission', trigger: 'Rôle sans la permission (matrice Rôles & accès)', ui: 'Bouton verrouillé (cadenas) ; au clic, toast « Action non autorisée » précisant l\'action et le rôle ; bannière « Lecture seule » sur Paramètres IA' },
  { state: 'Critère protégé ignoré', where: 'Recherche', trigger: 'Requête mentionnant âge, genre, nationalité, situation familiale ou photo', ui: 'Bannière orange listant les termes ignorés et la raison ; jamais utilisés dans le score' },
  { state: 'Tablette', where: 'Global', trigger: 'Largeur 768–1023 px', ui: 'Rail d\'icônes, colonnes empilées, tableaux défilants à colonne figée, colonnes secondaires masquées' },
]

export interface Spec { screen: string; element: string; data: string; loading: string; success: string; error: string }
export const INTERACTIONS: Spec[] = [
  { screen: 'Global', element: 'Recherche de la barre supérieure', data: 'Navigue vers Recherche avec ?q=', loading: '—', success: 'Requête interprétée sur l\'écran Recherche', error: 'Requête vide : soumission ignorée' },
  { screen: 'Global', element: 'Sélecteur de rôle (démo)', data: 'settings.role ; audit « Changement de rôle »', loading: 'Instantané', success: 'Boutons verrouillés recalculés', error: '—' },
  { screen: 'Tableau de bord', element: 'Cartes métriques', data: 'COUNT(*) candidates ; AVG(score) ; filtres today / ready+a_examiner', loading: 'Squelettes', success: 'Lien vers CVthèque pré-filtrée', error: 'ErrorState + Réessayer' },
  { screen: 'Tableau de bord', element: 'Barres « CV par département »', data: 'GROUP BY department', loading: 'Squelettes', success: 'Clic → CVthèque ?department=', error: 'ErrorState' },
  { screen: 'Tableau de bord', element: 'Zone de dépôt rapide', data: 'pipeline.enqueue(files)', loading: 'Redirection vers Import', success: 'Toast « ajouté(s) à la file »', error: 'Rôle non autorisé : toast verrouillé' },
  { screen: 'CVthèque', element: 'Champ de filtrage', data: 'Filtre client sur nom, e-mail, ville, poste, compétences, ID (prod : FTS5)', loading: '—', success: 'Compteur de résultats', error: 'NoResults + « Effacer »' },
  { screen: 'CVthèque', element: 'Panneau de filtres', data: 'WHERE city / department / processing / review / skill / score ≥ / exp ≥', loading: '—', success: 'Puces de filtres actifs supprimables', error: 'NoResults' },
  { screen: 'CVthèque', element: 'En-têtes triables', data: 'ORDER BY nom, ville, poste, exp, score, date', loading: '—', success: 'Flèche et aria-sort', error: '—' },
  { screen: 'CVthèque', element: 'Pagination / lignes par page', data: 'LIMIT / OFFSET (10, 25, 50)', loading: '—', success: 'Plage « 1–10 sur N »', error: '—' },
  { screen: 'CVthèque', element: 'Sélection groupée → Statut RH', data: 'api.setReview(ids) → UPDATE candidates SET review', loading: 'Liste désactivée « Mise à jour… »', success: 'Toast + audit par dossier', error: 'Toast erreur / verrouillé' },
  { screen: 'CVthèque', element: 'Exporter CSV (tout / sélection)', data: 'api.exportCandidates(csv, ids)', loading: 'Spinner bouton', success: 'Téléchargement + toast + audit', error: 'Toast ; rôle manager : verrouillé' },
  { screen: 'CVthèque', element: 'Supprimer (groupé / ligne)', data: 'api.deleteCandidates → DELETE candidates, analyses, fichiers', loading: 'Spinner dans la modale', success: 'Toast + audit', error: 'Toast ; réservé admin ; saisie « SUPPRIMER » si plusieurs' },
  { screen: 'CVthèque', element: 'Menu ligne › Relancer le traitement', data: 'pipeline.retryProcessing(id)', loading: 'Badge repasse en « Reçu »', success: 'Pipeline complet', error: 'Fichier introuvable / protégé : toast' },
  { screen: 'Import', element: 'Zone de dépôt / Parcourir', data: 'Validation format, taille ; SHA-256 ; INSERT candidates ; fichier → data/cv_files', loading: 'Stepper + progression par fichier', success: 'Badge « Prêt pour revue » + « Ouvrir pour revue »', error: 'Refusé (format/taille/vide), Erreur d\'extraction, Doublon' },
  { screen: 'Import', element: 'Doublon exact › Ignorer / Importer quand même', data: 'Ignorer : aucun INSERT ; Importer : nouvelle version (hash suffixé)', loading: 'Reprise du stepper', success: 'Statut mis à jour', error: '—' },
  { screen: 'Import', element: 'Analyse automatique', data: 'api.updateSettings({autoAnalyze})', loading: 'Spinner du toggle', success: 'Toast', error: 'Toast / verrouillé' },
  { screen: 'Profil', element: 'Aperçu Original / Texte extrait', data: 'Blob local (PDF) ou cv_text paginé', loading: 'Squelette', success: 'Rendu', error: 'Aucun texte : message + action manuelle' },
  { screen: 'Profil', element: 'Télécharger', data: 'Fichier original ; sinon texte extrait .txt', loading: '—', success: 'Téléchargement + toast', error: 'Ni original ni texte : toast erreur' },
  { screen: 'Profil', element: 'Modifier les champs › Enregistrer', data: 'api.updateCandidate(id, patch) ; field_confidence = 1 pour les champs modifiés', loading: 'Spinner « Enregistrer »', success: 'Toast + audit listant les champs', error: 'Validation inline (nom, e-mail, téléphone, années) ; toast' },
  { screen: 'Profil', element: 'Statut RH', data: 'api.setReview([id])', loading: 'Liste désactivée', success: 'Toast', error: 'Toast / verrouillé' },
  { screen: 'Profil', element: 'Notes RH › Enregistrer la note', data: 'api.saveNotes(id, text) (≤ 4 000 car.)', loading: 'Spinner', success: 'Toast + audit (longueur seulement)', error: 'Toast' },
  { screen: 'Profil', element: 'Onglets Historique IA / Audit', data: 'analyses WHERE candidate_id ; audit WHERE entity_id', loading: '—', success: 'Liste', error: 'Vide : message' },
  { screen: 'Analyse', element: 'Fournisseur + critères › Lancer', data: 'api.runAnalysis(id, provider, offerId) → INSERT analyses', loading: '« Analyse en cours (fournisseur)… »', success: 'Nouvelle version affichée + toast', error: 'Clé manquante → MissingKeyBanner ; pas de texte ; délai fournisseur' },
  { screen: 'Analyse', element: 'Marquer comme relue', data: 'api.validateAnalysis → reviewed_by / reviewed_at', loading: 'Spinner', success: 'Badge « Relue par … »', error: 'Toast' },
  { screen: 'Analyse', element: 'Élément probant', data: 'evidence[].quote → surlignage dans l\'aperçu', loading: '—', success: 'Ligne surlignée', error: '—' },
  { screen: 'Recherche', element: 'Requête en langage naturel', data: 'parseQuery → critères ; rank() sur dossiers indexés ; audit « Recherche effectuée »', loading: 'Squelettes de cartes', success: 'Recherche interprétée + résultats classés', error: 'ErrorState + Réessayer ; aucun critère : message' },
  { screen: 'Recherche', element: 'Puces de critères (retrait)', data: 'Recalcul local du score', loading: '—', success: 'Classement mis à jour', error: 'Tous retirés : NoResults' },
  { screen: 'Recherche', element: 'Critères de poste', data: 'Fusion offer + requête ; poids de l\'offre', loading: 'Squelettes', success: 'Puces teal (issues du poste)', error: '—' },
  { screen: 'Recherche', element: 'Carte de correspondance › Détail', data: 'results[] : état + note + citation + localisation', loading: '—', success: 'Liens Profil / Analyse', error: '—' },
  { screen: 'Critères', element: 'Formulaire › Enregistrer', data: 'api.saveOffer → UPSERT offers', loading: 'Spinner', success: 'Toast + audit', error: 'Titre requis, poids > 0 ; toast' },
  { screen: 'Critères', element: 'Curseurs de pondération', data: 'weights normalisés à 100 %', loading: '—', success: 'Aperçu du classement en direct', error: 'Somme nulle : message' },
  { screen: 'Critères', element: 'Dupliquer / Supprimer / Rechercher', data: 'Brouillon copié ; DELETE offers ; navigation ?offer=', loading: 'Spinner dans la modale', success: 'Toast', error: 'Toast' },
  { screen: 'Paramètres IA', element: 'Ajouter / remplacer la clé', data: 'api.setProviderKey → trousseau OS ; seul key_status est stocké', loading: 'Spinner', success: 'Badge « Configurée » (valeur jamais affichée)', error: 'Format invalide : message inline, statut « Clé invalide »' },
  { screen: 'Paramètres IA', element: 'Tester la connexion', data: 'api.testProvider → appel models.list côté serveur', loading: '« Test en cours… »', success: 'Latence + horodatage', error: 'Délai dépassé / clé manquante : toast + ligne rouge' },
  { screen: 'Paramètres IA', element: 'Modèle / Activé / Par défaut / Pseudonymiser', data: 'UPDATE providers / settings', loading: 'Spinner ou liste désactivée', success: 'Toast', error: 'Activer sans clé : refus ; défaut indisponible : refus' },
  { screen: 'Données locales', element: 'Exporter CSV / JSON', data: 'api.exportCandidates', loading: 'Spinner', success: 'Téléchargement + date du dernier export', error: 'Toast / verrouillé' },
  { screen: 'Données locales', element: 'Sauvegarder / Restaurer', data: 'VACUUM INTO backup ; restauration avec saisie « RESTAURER »', loading: 'Spinner', success: 'Téléchargement / toast', error: 'Fichier incompatible : toast' },
  { screen: 'Données locales', element: 'Conservation › Appliquer la purge', data: 'DELETE WHERE updated_at < now − N mois', loading: 'Spinner', success: 'Toast avec nombre purgé + audit', error: 'Toast ; saisie « PURGER »' },
  { screen: 'Données locales', element: 'Simuler une indisponibilité', data: 'settings.simulateFailures (recette)', loading: '—', success: 'Tous les écrans passent en état d\'erreur', error: '—' },
  { screen: 'Audit', element: 'Filtres / pagination / export', data: 'SELECT audit ORDER BY at DESC LIMIT 20', loading: 'Squelettes', success: 'Tableau', error: 'ErrorState' },
]

export const SCHEMA: { table: string; columns: string; notes: string }[] = [
  { table: 'candidates', columns: 'id TEXT PK, first_name, last_name, email, phone, city, target_role, department, experience_years INT NULL, skills JSON, languages JSON, education JSON, experience JSON, certifications JSON, mobility, summary, notes, processing TEXT CHECK(received|extracting|analyzing|indexed|ready|error), processing_error, review TEXT CHECK(a_examiner|en_revue|retenu|en_attente|archive), score INT NULL, confidence REAL, field_confidence JSON, cv_text TEXT, created_at, updated_at', notes: 'Aucune colonne âge, genre, nationalité, situation familiale ou photo. Index sur email, processing, review, department.' },
  { table: 'cv_files', columns: 'candidate_id FK, file_name, type pdf|docx, size_kb, sha256 UNIQUE*, pages, path', notes: 'Binaire dans data/cv_files/<sha256>.<ext>. *Unicité levée si « Importer quand même ».' },
  { table: 'candidates_fts', columns: 'VIRTUAL fts5(full_name, target_role, skills, cv_text)', notes: 'Alimentée à l\'étape « Indexé ».' },
  { table: 'analyses', columns: 'id PK, candidate_id FK, provider local|openai|gemini|anthropic, model, created_at, score, confidence, summary, strengths JSON, attention JSON, detected_skills JSON, missing JSON, evidence JSON, offer_id NULL, reviewed_by NULL, reviewed_at NULL', notes: 'Historique conservé (jamais écrasé). candidates.score = dernière analyse.' },
  { table: 'offers', columns: 'id PK, title, department, required_skills JSON, preferred_skills JSON, min_experience, education, languages JSON, city, mobility_accepted BOOL, weights JSON, updated_at', notes: 'Critères de classement uniquement — pas de table de candidatures.' },
  { table: 'providers', columns: 'id PK, enabled BOOL, model, key_status configured|missing|invalid, key_updated_at, last_test JSON', notes: 'La clé vit dans le trousseau OS (keyring) ou .env — jamais en base.' },
  { table: 'audit_log', columns: 'id PK, at, actor, role, action, entity, entity_id, details', notes: 'Append-only. Les clés et contenus de notes ne sont jamais journalisés.' },
  { table: 'settings', columns: 'key PK, value JSON', notes: 'default_provider, retention_months, auto_analyze, anonymize_before_sending, last_backup_at, last_export_at.' },
]

export const STREAMLIT: [string, string][] = [
  ['Sidebar', 'st.sidebar + st.page_link (pages/ multipage) ; icônes Material via « :material/… »'],
  ['PageHeader', 'st.title + st.caption ; actions dans st.columns alignées à droite'],
  ['MetricCard', 'st.metric dans st.container(border=True)'],
  ['CandidateTable', 'st.dataframe(on_select="rerun", selection_mode="multi-row", column_config=ProgressColumn pour le score, LinkColumn pour le profil)'],
  ['FilterPanel', 'st.expander("Filtres") + st.selectbox / st.slider ; état dans st.session_state ; pagination LIMIT/OFFSET'],
  ['StatusBadge / ScoreBadge', 'Colonne texte + couleurs via Styler, ou st.badge (≥ 1.45) ; mêmes libellés et seuils (75 / 50)'],
  ['UploadDropZone', 'st.file_uploader(type=["pdf","docx"], accept_multiple_files=True) ; contrôle 10 Mo ; hashlib.sha256'],
  ['Pipeline', 'concurrent.futures.ThreadPoolExecutor ; st.status / st.progress ; UPDATE candidates.processing à chaque étape ; st.fragment(run_every=2) pour rafraîchir'],
  ['ProfileSection (édition)', 'st.form par section ; st.text_input / st.data_editor (expériences, formations) ; validation avant UPDATE'],
  ['CvPreview', 'st.pdf (≥ 1.49) ou streamlit-pdf-viewer ; repli st.text du cv_text paginé'],
  ['AICard / Analyse', 'st.container(border=True) + st.info « Recommandation IA — à valider par RH »'],
  ['MatchingCard', 'st.expander par candidat ; st.columns(critère, état, preuve)'],
  ['ConfirmModal', '@st.dialog avec st.text_input de confirmation pour les actions irréversibles'],
  ['Toast', 'st.toast(icon=…) succès / erreur ; st.error pour les erreurs bloquantes'],
  ['Empty / Loading / Error', 'st.info + st.button ; st.spinner / st.skeleton ; st.error + st.button("Réessayer")'],
  ['Permissions', 'Décorateur require(action) sur chaque fonction du dépôt ; boutons désactivés avec help="Réservé à …"'],
]

export const PRINCIPLES = [
  ['RH dans la boucle', 'Les scores et analyses sont des recommandations. Aucun rejet ni aucune invitation automatique ; chaque analyse peut être marquée « relue ».'],
  ['Transparence', 'Chaque critère indique satisfait / partiel / manquant avec la citation exacte et sa position dans le CV.'],
  ['Équité', 'Âge, genre, nationalité, situation familiale et photo ne sont ni extraits pour le scoring, ni utilisés en recherche ; les termes sont détectés et ignorés.'],
  ['Local d\'abord', 'SQLite et fichiers locaux ; fournisseurs externes optionnels, pseudonymisation par défaut, clés jamais affichées.'],
]

export const PROMPT_CONTRACT = `Système : Tu es un assistant RH. Tu analyses un CV pour aider un recruteur. Tu ne prends aucune décision.
N'utilise jamais l'âge, le genre, la nationalité, la situation familiale ou la photo.
Réponds en JSON strict : { score: 0-100, confidence: 0-1, summary, strengths[], attention[],
detected_skills[{name, evidence}], missing[], evidence[{claim, quote, location}] }.
Chaque "quote" doit être une citation exacte du CV fourni.`
