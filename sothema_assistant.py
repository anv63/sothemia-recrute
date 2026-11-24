"""
Sothema AI Recruiter Assistant — Streamlit Chat Page.
Provides an interactive conversation interface with the tool-augmented SothemaHRAgent.
"""
import os
import streamlit as st
from utils.hr_agent import SothemaHRAgent
import sothema_ui as ui


def render_assistant_page(app_instance=None):
    """Renders the AI Recruiter Agent conversation interface."""
    st.markdown("""
        <div style="margin-bottom: 1.5rem;">
            <h1 style="margin: 0; font-size: 1.8rem; font-weight: 700; color: #1e293b;">
                🎙️ SothemIA — Copilote Recruteur SOTHEMA
            </h1>
            <p style="margin: 0.25rem 0 0; color: #64748b; font-size: 0.95rem;">
                Intelligence Artificielle connectée en direct aux 400 dossiers de votre CVthèque.
            </p>
        </div>
    """, unsafe_allow_html=True)

    # Initialize chat history
    if "agent_messages" not in st.session_state:
        st.session_state.agent_messages = [
            {
                "role": "assistant",
                "content": (
                    "Bonjour ! Je suis **SothemIA**, votre Copilote IA Recruteur SOTHEMA.\n\n"
                    "Je suis connecté en direct à votre base de données de **400 candidats**. "
                    "Je peux rechercher des profils pointus, analyser les compétences, comparer des candidatures "
                    "ou préparer des guides d'entretien sur-mesure (méthode STAR).\n\n"
                    "Comment puis-je vous aider aujourd'hui ?"
                ),
            }
        ]

    # Initialize Agent
    agent = SothemaHRAgent()

    # API Key Configuration Card if missing
    if not agent.is_configured:
        with st.container(border=True):
            st.warning("⚠️ **Clé API Groq Cloud requise pour activer le Copilote IA**")
            st.markdown("""
                L'agent utilise **Groq Cloud (SothemIA 120B)**, un modèle de pointe **100% gratuit** et ultra-rapide.
                
                1. Créez un compte gratuit sur [console.groq.com](https://console.groq.com).
                2. Cliquez sur **API Keys** $\\rightarrow$ **Create API Key**.
                3. Renseignez votre clé ci-dessous (ou dans `utils/.env`) :
            """)
            col_k, col_btn = st.columns([3, 1])
            with col_k:
                input_key = st.text_input("Clé API Groq (commence par gsk_...)", type="password", key="groq_key_input")
            with col_btn:
                st.write("")
                st.write("")
                if st.button("Enregistrer la clé", type="primary", use_container_width=True):
                    if input_key.strip():
                        # Save in runtime environment & in utils/.env
                        os.environ["GROQ_API_KEY"] = input_key.strip()
                        os.environ["OPENAI_API_KEY"] = input_key.strip()
                        env_file = os.path.join(os.path.dirname(__file__), "utils", ".env")
                        try:
                            lines = []
                            if os.path.exists(env_file):
                                with open(env_file, "r") as f:
                                    lines = f.readlines()
                            new_lines = []
                            for line in lines:
                                if line.startswith("GROQ_API_KEY="):
                                    new_lines.append(f"GROQ_API_KEY={input_key.strip()}\n")
                                elif line.startswith("OPENAI_API_KEY="):
                                    new_lines.append(f"OPENAI_API_KEY={input_key.strip()}\n")
                                else:
                                    new_lines.append(line)
                            with open(env_file, "w") as f:
                                f.writelines(new_lines)
                        except Exception:
                            pass
                        st.success("Clé enregistrée avec succès !")
                        st.rerun()

    # Quick prompt shortcuts bar
    st.markdown("<p style='font-size:0.85rem; font-weight:600; color:#475569; margin-bottom:0.5rem;'>⚡ Suggestions rapides :</p>", unsafe_allow_html=True)
    c1, c2, c3, c4 = st.columns(4)

    prompt_to_send = None

    with c1:
        if st.button("📊 Synthèse du vivier", use_container_width=True):
            prompt_to_send = "Fais-moi un état des lieux complet du vivier de recrutement : nombre de candidats, métiers les plus représentés et scores moyens."
    with c2:
        if st.button("⚙️ Électromécanique", use_container_width=True):
            prompt_to_send = "Recherche les candidats qualifiés en électromécanique ou maintenance industrielle et présente leurs points forts."
    with c3:
        if st.button("🌾 Ingénieurs Agronomes", use_container_width=True):
            prompt_to_send = "Quels candidats avons-nous pour le poste d'Ingénieur agronome ? Présente leurs profils et leurs atouts."
    with c4:
        if st.button("🎙️ Guide d'entretien", use_container_width=True):
            prompt_to_send = "Prends le premier profil de responsable ressources humaines et prépare un guide d'entretien complet avec des questions comportementales STAR."

    # Check if a contextual prompt was requested from another page (e.g. Dossier Candidat)
    if st.session_state.get("_agent_prefill_prompt"):
        prompt_to_send = st.session_state.pop("_agent_prefill_prompt")

    # Display conversation messages
    for msg in st.session_state.agent_messages:
        with st.chat_message(msg["role"], avatar="assets/sothema-logo.png" if msg["role"] == "assistant" else None):
            st.markdown(msg["content"])
            if msg.get("tools"):
                with st.expander(f"🔍 Outils ATS exécutés ({len(msg['tools'])})", expanded=False):
                    for t in msg["tools"]:
                        st.markdown(f"**`{t['tool']}`**")
                        st.json(t.get("arguments", {}))

    # Controls row (Reset chat)
    col_chat_input, col_reset = st.columns([6, 1])

    # Chat user input
    user_input = st.chat_input("Posez une question sur vos candidats, demandez une recherche ou un guide d'entretien...")

    actual_prompt = prompt_to_send or user_input

    if actual_prompt:
        # Append user message
        st.session_state.agent_messages.append({"role": "user", "content": actual_prompt})
        with st.chat_message("user"):
            st.markdown(actual_prompt)

        # Generate response from agent
        with st.chat_message("assistant", avatar="assets/sothema-logo.png"):
            with st.spinner("L'Assistant analyse la CVthèque et consulte la base ATS..."):
                reply, tools_run = agent.run_conversation(st.session_state.agent_messages)
                st.markdown(reply)
                if tools_run:
                    with st.expander(f"🔍 Outils ATS exécutés ({len(tools_run)})", expanded=False):
                        for t in tools_run:
                            st.markdown(f"**`{t['tool']}`**")
                            st.json(t.get("arguments", {}))

        # Save assistant message to session state
        st.session_state.agent_messages.append({
            "role": "assistant",
            "content": reply,
            "tools": tools_run,
        })
        st.rerun()

    # Reset chat button
    with st.sidebar:
        st.divider()
        if st.button("🗑️ Réinitialiser la discussion", use_container_width=True):
            st.session_state.agent_messages = [
                {
                    "role": "assistant",
                    "content": (
                        "Discussion réinitialisée. En quoi SothemIA peut-il vous assister aujourd'hui ?"
                    ),
                }
            ]
            st.rerun()
