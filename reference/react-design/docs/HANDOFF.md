# Sothema HR Intelligence — Notes de handoff développeur

> Généré depuis `src/lib/handoff.ts`. Le prototype interactif (React) sert de référence visuelle et comportementale pour l'implémentation Streamlit + SQLite locale. Écran correspondant : **Design & handoff** (`#/design`).

## Principes

| Principe | Règle |
| --- | --- |
| RH dans la boucle | Les scores et analyses sont des recommandations. Aucun rejet ni aucune invitation automatique ; chaque analyse peut être marquée « relue ». |
| Transparence | Chaque critère indique satisfait / partiel / manquant avec la citation exacte et sa position dans le CV. |
| Équité | Âge, genre, nationalité, situation familiale et photo ne sont ni extraits pour le scoring, ni utilisés en recherche ; les termes sont détectés et ignorés. |
| Local d'abord | SQLite et fichiers locaux ; fournisseurs externes optionnels, pseudonymisation par défaut, clés jamais affichées. |

## Couleurs

### Texte (navy)

| Token | Hex | Usage | Contraste / blanc |
| --- | --- | --- | --- |
| `ink` | #0B1F3A | Titres, texte principal, valeurs | 16.5:1 |
| `ink-2` | #34465F | Texte courant, libellés de cellule | 9.6:1 |
| `ink-3` | #5B6B82 | Texte secondaire, en-têtes de tableau | 5.4:1 |
| `ink-4` | #8492A6 | Placeholders, indices non essentiels | 3.2:1 (non textuel) |

### Surfaces & lignes

| Token | Hex | Usage | Contraste / blanc |
| --- | --- | --- | --- |
| `canvas` | #F4F6F9 | Fond d'application | — |
| `surface` | #FFFFFF | Cartes, tableaux, modales | — |
| `subtle` | #F8FAFC | En-têtes de tableau, pieds de carte | — |
| `line` | #E3E8EF | Séparateurs, bordures de carte | — |
| `line-strong` | #C9D2DE | Bordures de champs et boutons secondaires | — |

### Marque — bleu Sothema

| Token | Hex | Usage | Contraste / blanc |
| --- | --- | --- | --- |
| `brand-50` | #EBF3FC | Fond actif (navigation, sélection) | — |
| `brand-100` | #D5E5F8 | Anneau de focus, bordure de puce | — |
| `brand-500` | #1A6FD1 | Contour de focus | — |
| `brand-600` | #0A5BB8 | Bouton principal, liens, barres | 6.6:1 |
| `brand-700` | #084A97 | Survol du principal, liens actifs | 8.6:1 |
| `brand-800` | #083B76 | Texte sur fond brand-50 | 11.1:1 |

### Accent — teal

| Token | Hex | Usage | Contraste / blanc |
| --- | --- | --- | --- |
| `sea-50` | #E7F6F4 | Fond de critères issus d'un profil de poste | — |
| `sea-500` | #12998E | Point du logo, séries de graphiques | — |
| `sea-600` | #0D8178 | Bouton « Marquer comme relue », avatar | 4.7:1 |
| `sea-700` | #0A6760 | Texte teal | 6.7:1 |

### Sémantique

| Token | Hex | Usage | Contraste / blanc |
| --- | --- | --- | --- |
| `ok-600 / ok-50` | #12804F | Prêt, satisfait, score ≥ 75 | 5.0:1 |
| `warn-600 / warn-50` | #A35B00 | Partiel, à relire, doublon, clé manquante, score < 50 | 5.2:1 |
| `bad-600 / bad-50` | #B42318 | Erreur, faible confiance, suppression | 6.6:1 |
| `violet-600 / violet-50` | #5B4BC4 | Contenu généré par IA (recommandation) | 6.5:1 |

## Typographie

Inter (UI) · IBM Plex Mono (identifiants, localisations). Chiffres tabulaires dans les tableaux et métriques.

| Rôle | Spécification | Exemple |
| --- | --- | --- |
| Titre de page | 22 / 28 · 600 · -0.01em | CVthèque |
| Métrique | 28 / 28 · 600 · chiffres tabulaires | 1 284 |
| Titre de carte | 15 / 24 · 600 | État du traitement |
| Corps | 14 / 20 · 400 | Pharmacienne assurance qualité, 8 ans d'expérience. |
| Secondaire | 13 / 18 · 400–500 | Rattachement déduit du poste visé |
| Légende | 12 / 16 · 400–500 | Reçu il y a 2 heures |
| Surtitre | 11 / 16 · 600 · MAJ · +0.06em | COMPÉTENCES |
| Mono | IBM Plex Mono 12 / 16 | CAND-0007 · p. 1, l. 9 |

## Espacements (base 4 px)

| Token | Valeur | Usage |
| --- | --- | --- |
| 1 | 4 px | Écart icône / texte compact |
| 2 | 8 px | Écart entre puces, boutons groupés |
| 3 | 12 px | Padding cellule, écart champ |
| 4 | 16 px | Padding carte (tablette), gouttière |
| 5 | 20 px | Padding carte (desktop) |
| 6 | 24 px | Écart entre cartes / sections |
| 8 | 32 px | Marge de page (desktop) |

## Mise en page & responsive

| Contexte | Règle |
| --- | --- |
| Desktop ≥ 1024 px (lg) | Barre latérale 240 px avec libellés · contenu max 1 480 px · marges 32 px · profil et analyse en 2 colonnes à partir de 1 280 px (xl) |
| Tablette 768–1023 px (md) | Barre latérale en rail 64 px (icônes + info-bulles) · marges 24 px · colonnes empilées · tableaux à défilement horizontal avec colonne « Candidat » figée · colonnes Compétences / Statut RH / Date masquées |
| Composants | Hauteur de contrôle 36 px (sm 32 px, lg 44 px) · rayon 6 px (contrôles), 10 px (cartes), 14 px (modales) · ombre « card » uniquement sur les cartes, « pop » sur menus et toasts |

## Rayons & ombres

| Token | Valeur | Usage |
| --- | --- | --- |
| radius-sm | 4 px | Puces de compétences, squelettes |
| radius-md | 6 px | Boutons, champs, badges |
| radius-lg | 10 px | Cartes, zones de dépôt |
| radius-xl | 14 px | Modales |
| shadow-card | 0 1 2 / 5 % + 0 1 3 / 4 % | Cartes |
| shadow-pop | 0 8 24 / 12 % | Menus, toasts, pages CV |
| shadow-modal | 0 24 64 / 22 % | Modales |

## États des contrôles

| État | Traitement visuel |
| --- | --- |
| Par défaut | Bordure line-strong, fond blanc |
| Survol | Bordure ink-4 (champs) · fond subtle (secondaire) · brand-700 (principal) |
| Focus clavier | Contour 2 px brand-500 + décalage 2 px ; champs : bordure brand-500 + halo 3 px brand-100 |
| Actif / pressé | brand-800 (principal), canvas (secondaire) |
| Désactivé | Texte ink-4, fond brand-200 (principal), curseur not-allowed — utilisé quand l'action est impossible (ex. rien à enregistrer) |
| Chargement | Icône remplacée par un spinner, aria-busy, bouton non cliquable, libellé conservé ou précisé (« Analyse en cours… ») |
| Verrouillé (non autorisé) | Icône cadenas + opacité 60 % ; reste cliquable et renvoie un toast « Action non autorisée » expliquant le rôle requis |
| Invalide | Bordure bad-600 + message 12 px sous le champ, aria-invalid |

## Catalogue des états

| État | Écrans | Déclencheur | Interface |
| --- | --- | --- | --- |
| Vide | Tableau de bord, CVthèque, Analyses, Critères, file d'import | Aucune ligne en base (Paramètres › Vider la base) | EmptyState : icône, titre, explication, action principale (Importer des CV) |
| Chargement | Tous les écrans de lecture | Requête SELECT en cours (~400 ms) | Squelettes à la forme du contenu (TableSkeleton, CardsSkeleton, DetailSkeleton), aria-busy |
| Traitement | Import, CVthèque, profil, barre latérale | processing ∈ received / extracting / analyzing / indexed | Stepper 5 étapes + barre de progression, StatusBadge animé, bannière « Traitement en cours » sur le profil, compteur dans la barre latérale |
| Succès | Toute mutation | Promesse résolue | Toast vert 4 s + mise à jour immédiate de la vue + entrée d'audit |
| Erreur | Tous les écrans + mutations | Exception (SQLITE_BUSY, fichier illisible, délai fournisseur) | ErrorState avec « Réessayer » pour les lectures ; toast rouge 7 s pour les mutations ; badge « Erreur » + bannière « Relancer » pour le traitement |
| Doublon | Import | Même SHA-256 (exact) ou même e-mail (probable) | Exact : traitement suspendu, badge orange, actions Voir l'existant / Ignorer / Importer quand même. Probable : avertissement non bloquant avec lien vers le dossier |
| Aucun résultat | CVthèque, Recherche, Analyses | Filtres ou critères sans correspondance | NoResults + action pour retirer les filtres ; en recherche, nombre de profils masqués à score 0 |
| Extraction faible confiance | Import, CVthèque, profil, analyse | confidence < 0,60 (PDF scanné, police encodée) | Badge rouge « Faible confiance », icône dans la ligne du tableau, LowConfidenceBanner avec « Vérifier les champs », point de confiance par champ |
| Clé fournisseur manquante | Paramètres IA, Import, Analyse | keyStatus ≠ configured | Badge « Clé manquante », MissingKeyBanner avec « Configurer », option « (clé manquante) » dans les listes, repli automatique sur l'analyse locale |
| Action non autorisée | Boutons et menus soumis à permission | Rôle sans la permission (matrice Rôles & accès) | Bouton verrouillé (cadenas) ; au clic, toast « Action non autorisée » précisant l'action et le rôle ; bannière « Lecture seule » sur Paramètres IA |
| Critère protégé ignoré | Recherche | Requête mentionnant âge, genre, nationalité, situation familiale ou photo | Bannière orange listant les termes ignorés et la raison ; jamais utilisés dans le score |
| Tablette | Global | Largeur 768–1023 px | Rail d'icônes, colonnes empilées, tableaux défilants à colonne figée, colonnes secondaires masquées |

## Spécification des interactions

Chaque élément interactif est relié à une fonction du dépôt de données (`src/lib/db.ts` → module `repository.py` en production).

| Écran | Élément | Données | Chargement | Succès | Erreur |
| --- | --- | --- | --- | --- | --- |
| Global | Recherche de la barre supérieure | Navigue vers Recherche avec ?q= | — | Requête interprétée sur l'écran Recherche | Requête vide : soumission ignorée |
| Global | Sélecteur de rôle (démo) | settings.role ; audit « Changement de rôle » | Instantané | Boutons verrouillés recalculés | — |
| Tableau de bord | Cartes métriques | COUNT(*) candidates ; AVG(score) ; filtres today / ready+a_examiner | Squelettes | Lien vers CVthèque pré-filtrée | ErrorState + Réessayer |
| Tableau de bord | Barres « CV par département » | GROUP BY department | Squelettes | Clic → CVthèque ?department= | ErrorState |
| Tableau de bord | Zone de dépôt rapide | pipeline.enqueue(files) | Redirection vers Import | Toast « ajouté(s) à la file » | Rôle non autorisé : toast verrouillé |
| CVthèque | Champ de filtrage | Filtre client sur nom, e-mail, ville, poste, compétences, ID (prod : FTS5) | — | Compteur de résultats | NoResults + « Effacer » |
| CVthèque | Panneau de filtres | WHERE city / department / processing / review / skill / score ≥ / exp ≥ | — | Puces de filtres actifs supprimables | NoResults |
| CVthèque | En-têtes triables | ORDER BY nom, ville, poste, exp, score, date | — | Flèche et aria-sort | — |
| CVthèque | Pagination / lignes par page | LIMIT / OFFSET (10, 25, 50) | — | Plage « 1–10 sur N » | — |
| CVthèque | Sélection groupée → Statut RH | api.setReview(ids) → UPDATE candidates SET review | Liste désactivée « Mise à jour… » | Toast + audit par dossier | Toast erreur / verrouillé |
| CVthèque | Exporter CSV (tout / sélection) | api.exportCandidates(csv, ids) | Spinner bouton | Téléchargement + toast + audit | Toast ; rôle manager : verrouillé |
| CVthèque | Supprimer (groupé / ligne) | api.deleteCandidates → DELETE candidates, analyses, fichiers | Spinner dans la modale | Toast + audit | Toast ; réservé admin ; saisie « SUPPRIMER » si plusieurs |
| CVthèque | Menu ligne › Relancer le traitement | pipeline.retryProcessing(id) | Badge repasse en « Reçu » | Pipeline complet | Fichier introuvable / protégé : toast |
| Import | Zone de dépôt / Parcourir | Validation format, taille ; SHA-256 ; INSERT candidates ; fichier → data/cv_files | Stepper + progression par fichier | Badge « Prêt pour revue » + « Ouvrir pour revue » | Refusé (format/taille/vide), Erreur d'extraction, Doublon |
| Import | Doublon exact › Ignorer / Importer quand même | Ignorer : aucun INSERT ; Importer : nouvelle version (hash suffixé) | Reprise du stepper | Statut mis à jour | — |
| Import | Analyse automatique | api.updateSettings({autoAnalyze}) | Spinner du toggle | Toast | Toast / verrouillé |
| Profil | Aperçu Original / Texte extrait | Blob local (PDF) ou cv_text paginé | Squelette | Rendu | Aucun texte : message + action manuelle |
| Profil | Télécharger | Fichier original ; sinon texte extrait .txt | — | Téléchargement + toast | Ni original ni texte : toast erreur |
| Profil | Modifier les champs › Enregistrer | api.updateCandidate(id, patch) ; field_confidence = 1 pour les champs modifiés | Spinner « Enregistrer » | Toast + audit listant les champs | Validation inline (nom, e-mail, téléphone, années) ; toast |
| Profil | Statut RH | api.setReview([id]) | Liste désactivée | Toast | Toast / verrouillé |
| Profil | Notes RH › Enregistrer la note | api.saveNotes(id, text) (≤ 4 000 car.) | Spinner | Toast + audit (longueur seulement) | Toast |
| Profil | Onglets Historique IA / Audit | analyses WHERE candidate_id ; audit WHERE entity_id | — | Liste | Vide : message |
| Analyse | Fournisseur + critères › Lancer | api.runAnalysis(id, provider, offerId) → INSERT analyses | « Analyse en cours (fournisseur)… » | Nouvelle version affichée + toast | Clé manquante → MissingKeyBanner ; pas de texte ; délai fournisseur |
| Analyse | Marquer comme relue | api.validateAnalysis → reviewed_by / reviewed_at | Spinner | Badge « Relue par … » | Toast |
| Analyse | Élément probant | evidence[].quote → surlignage dans l'aperçu | — | Ligne surlignée | — |
| Recherche | Requête en langage naturel | parseQuery → critères ; rank() sur dossiers indexés ; audit « Recherche effectuée » | Squelettes de cartes | Recherche interprétée + résultats classés | ErrorState + Réessayer ; aucun critère : message |
| Recherche | Puces de critères (retrait) | Recalcul local du score | — | Classement mis à jour | Tous retirés : NoResults |
| Recherche | Critères de poste | Fusion offer + requête ; poids de l'offre | Squelettes | Puces teal (issues du poste) | — |
| Recherche | Carte de correspondance › Détail | results[] : état + note + citation + localisation | — | Liens Profil / Analyse | — |
| Critères | Formulaire › Enregistrer | api.saveOffer → UPSERT offers | Spinner | Toast + audit | Titre requis, poids > 0 ; toast |
| Critères | Curseurs de pondération | weights normalisés à 100 % | — | Aperçu du classement en direct | Somme nulle : message |
| Critères | Dupliquer / Supprimer / Rechercher | Brouillon copié ; DELETE offers ; navigation ?offer= | Spinner dans la modale | Toast | Toast |
| Paramètres IA | Ajouter / remplacer la clé | api.setProviderKey → trousseau OS ; seul key_status est stocké | Spinner | Badge « Configurée » (valeur jamais affichée) | Format invalide : message inline, statut « Clé invalide » |
| Paramètres IA | Tester la connexion | api.testProvider → appel models.list côté serveur | « Test en cours… » | Latence + horodatage | Délai dépassé / clé manquante : toast + ligne rouge |
| Paramètres IA | Modèle / Activé / Par défaut / Pseudonymiser | UPDATE providers / settings | Spinner ou liste désactivée | Toast | Activer sans clé : refus ; défaut indisponible : refus |
| Données locales | Exporter CSV / JSON | api.exportCandidates | Spinner | Téléchargement + date du dernier export | Toast / verrouillé |
| Données locales | Sauvegarder / Restaurer | VACUUM INTO backup ; restauration avec saisie « RESTAURER » | Spinner | Téléchargement / toast | Fichier incompatible : toast |
| Données locales | Conservation › Appliquer la purge | DELETE WHERE updated_at < now − N mois | Spinner | Toast avec nombre purgé + audit | Toast ; saisie « PURGER » |
| Données locales | Simuler une indisponibilité | settings.simulateFailures (recette) | — | Tous les écrans passent en état d'erreur | — |
| Audit | Filtres / pagination / export | SELECT audit ORDER BY at DESC LIMIT 20 | Squelettes | Tableau | ErrorState |

## Schéma SQLite

| Table | Colonnes | Notes |
| --- | --- | --- |
| `candidates` | id TEXT PK, first_name, last_name, email, phone, city, target_role, department, experience_years INT NULL, skills JSON, languages JSON, education JSON, experience JSON, certifications JSON, mobility, summary, notes, processing TEXT CHECK(received\|extracting\|analyzing\|indexed\|ready\|error), processing_error, review TEXT CHECK(a_examiner\|en_revue\|retenu\|en_attente\|archive), score INT NULL, confidence REAL, field_confidence JSON, cv_text TEXT, created_at, updated_at | Aucune colonne âge, genre, nationalité, situation familiale ou photo. Index sur email, processing, review, department. |
| `cv_files` | candidate_id FK, file_name, type pdf\|docx, size_kb, sha256 UNIQUE*, pages, path | Binaire dans data/cv_files/<sha256>.<ext>. *Unicité levée si « Importer quand même ». |
| `candidates_fts` | VIRTUAL fts5(full_name, target_role, skills, cv_text) | Alimentée à l'étape « Indexé ». |
| `analyses` | id PK, candidate_id FK, provider local\|openai\|gemini\|anthropic, model, created_at, score, confidence, summary, strengths JSON, attention JSON, detected_skills JSON, missing JSON, evidence JSON, offer_id NULL, reviewed_by NULL, reviewed_at NULL | Historique conservé (jamais écrasé). candidates.score = dernière analyse. |
| `offers` | id PK, title, department, required_skills JSON, preferred_skills JSON, min_experience, education, languages JSON, city, mobility_accepted BOOL, weights JSON, updated_at | Critères de classement uniquement — pas de table de candidatures. |
| `providers` | id PK, enabled BOOL, model, key_status configured\|missing\|invalid, key_updated_at, last_test JSON | La clé vit dans le trousseau OS (keyring) ou .env — jamais en base. |
| `audit_log` | id PK, at, actor, role, action, entity, entity_id, details | Append-only. Les clés et contenus de notes ne sont jamais journalisés. |
| `settings` | key PK, value JSON | default_provider, retention_months, auto_analyze, anonymize_before_sending, last_backup_at, last_export_at. |

## Correspondance Streamlit

| Composant | Implémentation Streamlit |
| --- | --- |
| Sidebar | st.sidebar + st.page_link (pages/ multipage) ; icônes Material via « :material/… » |
| PageHeader | st.title + st.caption ; actions dans st.columns alignées à droite |
| MetricCard | st.metric dans st.container(border=True) |
| CandidateTable | st.dataframe(on_select="rerun", selection_mode="multi-row", column_config=ProgressColumn pour le score, LinkColumn pour le profil) |
| FilterPanel | st.expander("Filtres") + st.selectbox / st.slider ; état dans st.session_state ; pagination LIMIT/OFFSET |
| StatusBadge / ScoreBadge | Colonne texte + couleurs via Styler, ou st.badge (≥ 1.45) ; mêmes libellés et seuils (75 / 50) |
| UploadDropZone | st.file_uploader(type=["pdf","docx"], accept_multiple_files=True) ; contrôle 10 Mo ; hashlib.sha256 |
| Pipeline | concurrent.futures.ThreadPoolExecutor ; st.status / st.progress ; UPDATE candidates.processing à chaque étape ; st.fragment(run_every=2) pour rafraîchir |
| ProfileSection (édition) | st.form par section ; st.text_input / st.data_editor (expériences, formations) ; validation avant UPDATE |
| CvPreview | st.pdf (≥ 1.49) ou streamlit-pdf-viewer ; repli st.text du cv_text paginé |
| AICard / Analyse | st.container(border=True) + st.info « Recommandation IA — à valider par RH » |
| MatchingCard | st.expander par candidat ; st.columns(critère, état, preuve) |
| ConfirmModal | @st.dialog avec st.text_input de confirmation pour les actions irréversibles |
| Toast | st.toast(icon=…) succès / erreur ; st.error pour les erreurs bloquantes |
| Empty / Loading / Error | st.info + st.button ; st.spinner / st.skeleton ; st.error + st.button("Réessayer") |
| Permissions | Décorateur require(action) sur chaque fonction du dépôt ; boutons désactivés avec help="Réservé à …" |

## Contrat de prompt (fournisseurs IA)

```text
Système : Tu es un assistant RH. Tu analyses un CV pour aider un recruteur. Tu ne prends aucune décision.
N'utilise jamais l'âge, le genre, la nationalité, la situation familiale ou la photo.
Réponds en JSON strict : { score: 0-100, confidence: 0-1, summary, strengths[], attention[],
detected_skills[{name, evidence}], missing[], evidence[{claim, quote, location}] }.
Chaque "quote" doit être une citation exacte du CV fourni.
```

## Limites du prototype

- Le stockage (localStorage + IndexedDB) remplace SQLite et `data/cv_files/` ; les signatures de `api.*` reprennent celles du dépôt Python.
- L'extraction PDF/DOCX est réelle mais simplifiée (pas d'OCR) : les PDF scannés produisent volontairement l'état « faible confiance ».
- Les appels OpenAI / Gemini / Claude ne sont pas émis depuis le navigateur (aucune clé n'y transite) : le moteur local produit le résultat, étiqueté avec le fournisseur choisi. En production, le backend applique le contrat ci-dessus.
- Le sélecteur de rôle et le mode « Simuler une indisponibilité » sont des outils de recette.

