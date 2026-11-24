# Plan d'Intégration Révisé : Agent IA Recruteur (Sothema ATS)

Ce document est le guide complet, pas à pas, pour comprendre le fonctionnement de l'application, configurer un fournisseur d'IA gratuit, et développer l'**Agent Conversationnel RH** de manière incrémentale avec une **validation à chaque étape**.

---

## 1. Comprendre l'Architecture : Que se passe-t-il exactement ?

Avant d'écrire la moindre ligne de code, voici comment les données circulent dans l'application :

```text
[CV Téléchargé : PDF/DOCX] 
       │
       ▼ (utils/document_extractor.py : OCR & parsing)
[Texte Brut (raw_text)] 
       │
       ▼ (utils/resume_analyzer.py : extraction de compétences, score ATS)
[Analyse Structurée (local_analysis_json)]
       │
       ▼ (ats_store.py)
[Base de données SQLite Locale : resume_data.db]
       │
       ├─ Table 'ats_candidates' (id, nom, email, score, statut RH, compétences, texte brut)
       └─ Table 'ats_audit_log'  (historique des actions RH)
```

### Pourquoi cela fonctionne 100% en local et sans friction pour vos collègues ?
1. **Zéro serveur de base de données à installer :** Python intègre nativement SQLite. L'application crée automatiquement le fichier `resume_data.db` et ses tables au lancement si elles n'existent pas.
2. **Couche d'abstraction prête pour la production :** `ats_store.py` gère automatiquement la bascule entre SQLite (en local) et Supabase (si l'application est hébergée sur le cloud).
3. **Zéro migration SQL requise :** Notre agent vient uniquement **lire et raisonner** sur les données déjà présentes (`raw_text`, `local_analysis_json`, `score`, `review`). Votre collègue n'aura qu'à faire un `git pull` pour profiter de la fonctionnalité.

---

## 2. Choix du Fournisseur LLM Gratuit

Pour développer et tester l'agent gratuitement avec support complet du **Function / Tool Calling** :

### Option A : Groq Cloud (Recommandé pour sa rapidité & compatibilité OpenAI)
- **Modèle :** `llama-3.3-70b-versatile`
- **Coût :** 100% gratuit (aucun moyen de paiement demandé).
- **Avantage :** Utilise exactement la bibliothèque standard `openai` déjà configurée dans le projet en modifiant simplement le `base_url`.
- **Obtention :** Inscription sur [console.groq.com](https://console.groq.com) $\rightarrow$ *API Keys* $\rightarrow$ *Create API Key*.

### Option B : Google Gemini (Google AI Studio)
- **Modèle :** `gemini-1.5-flash` ou `gemini-2.0-flash`
- **Coût :** 100% gratuit (jusqu'à 15 requêtes/minute et 1 500 requêtes/jour).
- **Avantage :** La bibliothèque `google-generativeai` est déjà présente dans `requirements.txt`.
- **Obtention :** Inscription sur [aistudio.google.com](https://aistudio.google.com) $\rightarrow$ *Get API key*.

---

## 3. Plan Pas-à-Pas avec Vérification à Chaque Étape

Chaque étape est conçue pour être développée puis validée immédiatement avant de passer à la suivante.

---

### Étape 1 : Préparation de l'Environnement et de la Clé API
**Objectif :** Disposer d'un environnement Python fonctionnel et d'une clé API valide.

1. **Actions :**
   - Créer un environnement virtuel Python (`python3 -m venv .venv`).
   - Installer les dépendances (`pip install -r requirements.txt`).
   - Créer le fichier `utils/.env` contenant votre clé API gratuite :
     ```ini
     # Si utilisation de Groq :
     OPENAI_API_KEY=gsk_votre_cle_groq_ici
     OPENAI_BASE_URL=https://api.groq.com/openai/v1
     OPENAI_MODEL=llama-3.3-70b-versatile

     # OU si utilisation de Google Gemini :
     GOOGLE_API_KEY=votre_cle_gemini_ici
     ```
2. **Vérification (Test) :**
   - Exécuter un script simple de validation d'appel LLM (`scratch/test_llm_connection.py`).
   - **Critère de succès :** Le modèle répond un message de confirmation avec succès.

---

### Étape 2 : Création de la Boîte à Outils ATS (`utils/ats_tools.py`)
**Objectif :** Créer les fonctions Python sécurisées que l'agent IA va utiliser pour interroger la base de données.

1. **Fonctions à développer :**
   - `get_ats_overview()` : Statistiques du pipeline (nombre total de candidats, répartition par statut `a_examiner`, `retenu`, etc., et par poste cible).
   - `search_candidates(keyword, target_role, min_score, review_status)` : Recherche filtrée dans la base de données.
   - `get_candidate_profile(candidate_id)` : Fiche complète d'un candidat (compétences, parcours, formations, score, notes RH).
   - `get_candidate_cv_text(candidate_id)` : Récupère le texte brut du CV (indispensable pour l'analyse approfondie et la préparation d'entretien).
   - `compare_candidates(candidate_ids)` : Récupère les profils de plusieurs candidats pour comparaison directe.
2. **Vérification (Test) :**
   - Créer et exécuter `scratch/test_tools.py` qui appelle chaque fonction sur la base SQLite locale.
   - **Critère de succès :** Toutes les fonctions renvoient des dictionnaires JSON propres sans erreur, même si la base est vide ou contient des données.

---

### Étape 3 : Développement du Moteur de l'Agent IA (`utils/hr_agent.py`)
**Objectif :** Implémenter l'agent capable de décider quand appeler ces outils et de répondre aux questions RH.

1. **Composants à développer :**
   - **Prompt Système :** Persona "Assistant RH Sothema", expert en recrutement, bienveillant, objectif, respectant l'éthique (ne discrimine jamais sur l'âge, genre, etc.) et ancré sur les preuves des CV.
   - **Définition des Outils (Tool Schemas) :** Description JSON des fonctions de `ats_tools.py` transmise au LLM.
   - **Boucle Agentique :**
     1. L'utilisateur pose une question.
     2. Le LLM analyse la question : a-t-il besoin d'une info en base ?
     3. Si oui $\rightarrow$ Le LLM émet un `tool_call`.
     4. Le code exécute la fonction Python locale et renvoie le résultat au LLM.
     5. Le LLM formule la réponse finale enrichie des données réelles.
2. **Vérification (Test) :**
   - Exécuter un script interactif en ligne de commande (`scratch/test_agent_cli.py`).
   - Poser des questions comme : *"Combien de candidats avons-nous ?"*, *"Y a-t-il un candidat qui connaît Python ?"*, *"Prépare un entretien pour le candidat #1"*.
   - **Critère de succès :** L'agent active les bons outils, récupère les données de la base et formule des réponses claires et pertinentes.

---

### Étape 4 : Création de l'Interface de Chat Streamlit (`sothema_assistant.py`)
**Objectif :** Offrir une interface graphique de chat moderne et élégante pour les recruteurs.

1. **Composants à développer :**
   - Utilisation de `st.chat_message()` et `st.chat_input()`.
   - Maintien de l'historique dans `st.session_state.messages`.
   - Boutons de suggestions rapides en haut de l'écran :
     - 📊 *Faire le point sur les recrutements*
     - 🔍 *Rechercher un profil spécifique*
     - 🎙️ *Préparer un guide d'entretien*
     - ⚖️ *Comparer deux candidats*
   - Intégration de la page dans la navigation active de [app.py](file:///home/ziyadhoxha/Desktop/ATS/app.py) sous la section "Recrutement".
2. **Vérification (Test) :**
   - Lancer l'application avec `streamlit run app.py`.
   - Se connecter à l'interface RH.
   - Tester l'interaction dans le navigateur et vérifier l'affichage fluide des messages.
   - **Critère de succès :** L'agent répond correctement dans l'interface graphique avec le thème visuel Sothema.

---

### Étape 5 : Fonctionnalité Contextuelle "Préparer l'entretien en 1 clic"
**Objectif :** Permettre au recruteur, depuis la fiche d'un candidat ([Dossier Candidat](file:///home/ziyadhoxha/Desktop/ATS/sothema_views.py#L1215)), de lancer directement la préparation d'entretien.

1. **Actions :**
   - Ajouter un bouton *"🎙️ Préparer l'entretien avec l'IA"* dans l'onglet IA du dossier candidat.
   - Ce bouton bascule automatiquement vers la page de l'Assistant en pré-remplissant le contexte avec le profil du candidat sélectionné.
2. **Vérification (Test) :**
   - Ouvrir un dossier candidat, cliquer sur le bouton et vérifier que l'assistant génère immédiatement les questions comportementales (STAR), techniques et de mise en situation.
   - **Critère de succès :** Le guide d'entretien est instantanément généré et personnalisé selon le CV du candidat.

---

## 4. Synthèse des Livrables

À la fin de ce plan, vous aurez ajouté au dépôt :
1. `utils/ats_tools.py` : Module réutilisable d'interrogation de l'ATS.
2. `utils/hr_agent.py` : Moteur de l'agent avec Tool Calling.
3. `sothema_assistant.py` : Vue de chat Streamlit.
4. Une mise à jour mineure de [app.py](file:///home/ziyadhoxha/Desktop/ATS/app.py) (ajout d'une ligne pour enregistrer la page) et de [sothema_views.py](file:///home/ziyadhoxha/Desktop/ATS/sothema_views.py) (bouton raccourci dossier).

Ce code sera propre, testé, 100% compatible avec la base existante de vos collègues, et sans aucun coût d'API grâce au fournisseur gratuit configuré.
