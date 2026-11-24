"""
Sothema AI Recruiter Agent (Copilot).
Implements tool-augmented reasoning over the ATS candidate pool using Groq Cloud (llama-3.3-70b-versatile)
or OpenAI / Gemini via the standard OpenAI-compatible interface.
"""
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from dotenv import load_dotenv

from utils import ats_tools

# Load environment from utils/.env and root .env
_ENV_PATH = Path(__file__).resolve().parent / ".env"
if _ENV_PATH.exists():
    load_dotenv(_ENV_PATH)
load_dotenv()


# Available tools specification for Groq / OpenAI function calling
TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "get_ats_overview",
            "description": "Obtenir une vue d'ensemble du vivier de recrutement : nombre total de candidats, distribution des statuts RH (à examiner, retenu, etc.), score ATS moyen et principaux métiers recherchés.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_candidates",
            "description": "Rechercher et filtrer des candidats dans la CVthèque par mot-clé, intitulé de poste cible, score minimum ou statut RH.",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {
                        "type": "string",
                        "description": "Mot-clé technique ou métier (ex: 'Python', 'SEO', 'maintenance industrielle', 'comptabilité').",
                    },
                    "target_role": {
                        "type": "string",
                        "description": "Poste ou fonction visée (ex: 'agronome', 'électromécanicien', 'juriste').",
                    },
                    "min_score": {
                        "type": "integer",
                        "description": "Score ATS minimum requis (entre 0 et 100).",
                    },
                    "review_status": {
                        "type": "string",
                        "description": "Statut RH ('a_examiner', 'retenu', 'rejete', 'vivier', 'en_cours').",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Nombre maximum de profils à retourner (défaut: 10, max: 25).",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_candidate_profile",
            "description": "Consulter la fiche détaillée d'un candidat précis via son identifiant numérique (ID) : compétences extraites, parcours, formation, coordonnées, score et notes RH.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_id": {
                        "type": "integer",
                        "description": "Identifiant unique (ID) du candidat dans la base ATS.",
                    },
                },
                "required": ["candidate_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_candidate_cv_text",
            "description": "Obtenir l'intégralité du texte extrait du CV d'un candidat (ID) pour analyser les détails, détecter des zones d'ombre ou préparer des questions d'entretien pointues.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_id": {
                        "type": "integer",
                        "description": "Identifiant unique (ID) du candidat.",
                    },
                },
                "required": ["candidate_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_candidates",
            "description": "Comparer directement 2 à 4 candidats côte à côte sur leurs compétences, parcours et scores ATS pour arbitrer un choix de sélection.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_ids": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "Liste de 2 à 4 identifiants (IDs) de candidats à comparer.",
                    },
                },
                "required": ["candidate_ids"],
            },
        },
    },
]

TOOL_FUNCTIONS = {
    "get_ats_overview": ats_tools.get_ats_overview,
    "search_candidates": ats_tools.search_candidates,
    "get_candidate_profile": ats_tools.get_candidate_profile,
    "get_candidate_cv_text": ats_tools.get_candidate_cv_text,
    "compare_candidates": ats_tools.compare_candidates,
}

SYSTEM_PROMPT = """Tu es SothemIA, l'Assistant IA Recruteur officiel des Laboratoires Pharmaceutiques SOTHEMA.
Ton rôle est d'assister les chargés de recrutement et les managers RH dans l'analyse de la CVthèque, la sélection de profils qualifiés, la comparaison objective des candidats et la préparation structurée d'entretiens d'embauche.

Règles de déontologie et d'action :
1. Objectivité et éthique : Fonde toujours tes analyses exclusivement sur les compétences, diplômes, savoir-faire et expériences vérifiables extraits des CV. Ne discrimine jamais sur des critères personnels (âge, genre, situation familiale, etc.).
2. Utilisation active des outils : Quand l'utilisateur te pose une question sur les candidats ou demande une recherche, utilise TOUJOURS les outils mis à disposition (get_ats_overview, search_candidates, get_candidate_profile, get_candidate_cv_text, compare_candidates). N'invente jamais de profils.
3. Préparation d'entretien : Lorsque l'on te demande de préparer un entretien pour un candidat, consulte son CV (via get_candidate_cv_text ou get_candidate_profile), puis génère :
   - Des questions de validation technique / métier.
   - Des questions comportementales basées sur la méthode STAR (Situation, Tâche, Action, Résultat).
   - Les points d'attention ou zones d'ombre du parcours à éclaircir.
4. Style de communication : Professionnel, clair, synthétique, structuré avec des listes à puces et du gras pour faciliter la lecture rapide par un recruteur. Réponds toujours en français soigné.
"""


class SothemaHRAgent:
    """Agent conversationnel RH autonome doté d'outils d'interrogation ATS."""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        # 1. Check Groq specific key, then OpenAI key
        self.api_key = (
            api_key
            or os.getenv("GROQ_API_KEY")
            or os.getenv("OPENAI_API_KEY")
            or ""
        ).strip()

        # 2. Base URL (defaults to Groq Cloud endpoint if key starts with gsk_ or if configured)
        env_base = os.getenv("OPENAI_BASE_URL", "").strip()
        if base_url:
            self.base_url = base_url
        elif env_base:
            self.base_url = env_base
        elif self.api_key.startswith("gsk_"):
            self.base_url = "https://api.groq.com/openai/v1"
        else:
            self.base_url = "https://api.groq.com/openai/v1"

        # 3. Model selection
        env_model = os.getenv("OPENAI_MODEL", "").strip()
        if model:
            self.model = model
        elif env_model:
            self.model = env_model
        else:
            self.model = "openai/gpt-oss-120b"

        self._client = None
        if self.api_key:
            try:
                from openai import OpenAI
                self._client = OpenAI(
                    api_key=self.api_key,
                    base_url=self.base_url,
                    timeout=45.0,
                    max_retries=1,
                )
            except Exception as e:
                print(f"[HRAgent] Failed to initialize OpenAI client: {e}")

    @property
    def is_configured(self) -> bool:
        return bool(self._client and self.api_key)

    def run_conversation(
        self,
        messages: List[Dict[str, str]],
        max_tool_iterations: int = 5,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Executes a conversation turn with tool-calling resolution.
        Returns:
            (final_reply_text, list_of_tool_calls_executed)
        """
        if not self.is_configured:
            return (
                "⚠️ **Clé API Groq non configurée.**\n\n"
                "Pour activer l'Assistant IA Recruteur, obtenez une clé gratuite sur [console.groq.com](https://console.groq.com) "
                "et renseignez-la dans `utils/.env` sous `GROQ_API_KEY=gsk_...`.",
                [],
            )

        # Prepare messages payload with system prompt
        formatted_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for m in messages:
            formatted_messages.append({"role": m["role"], "content": m["content"]})

        tools_executed: List[Dict[str, Any]] = []

        for _ in range(max_tool_iterations):
            try:
                response = self._client.chat.completions.create(
                    model=self.model,
                    messages=formatted_messages,
                    tools=TOOLS_SCHEMA,
                    tool_choice="auto",
                    temperature=0.2,
                )
            except Exception as err:
                return (f"❌ Erreur lors de l'appel à l'API LLM ({self.model}) : {str(err)}", tools_executed)

            response_msg = response.choices[0].message

            # If the model didn't ask for any tools, return its text
            if not response_msg.tool_calls:
                return (response_msg.content or "", tools_executed)

            # Append the assistant's tool-call request to the conversation history
            formatted_messages.append(response_msg)

            # Execute all requested tools in this turn
            for tool_call in response_msg.tool_calls:
                func_name = tool_call.function.name
                func_args_str = tool_call.function.arguments or "{}"
                try:
                    func_args = json.loads(func_args_str)
                except Exception:
                    func_args = {}

                tool_fn = TOOL_FUNCTIONS.get(func_name)
                if tool_fn:
                    try:
                        tool_result = tool_fn(**func_args)
                    except Exception as ex:
                        tool_result = {"error": f"Tool execution failed: {str(ex)}"}
                else:
                    tool_result = {"error": f"Unknown tool: {func_name}"}

                tools_executed.append({
                    "tool": func_name,
                    "arguments": func_args,
                    "result_summary": f"Exécuté avec succès ({len(str(tool_result))} octets)",
                })

                # Append tool result to messages
                formatted_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": func_name,
                    "content": json.dumps(tool_result, ensure_ascii=False),
                })

        # If max tool iterations reached, make one final call without tools
        try:
            final_res = self._client.chat.completions.create(
                model=self.model,
                messages=formatted_messages,
                temperature=0.2,
            )
            return (final_res.choices[0].message.content or "", tools_executed)
        except Exception as e:
            return (f"Erreur de finalisation : {str(e)}", tools_executed)
