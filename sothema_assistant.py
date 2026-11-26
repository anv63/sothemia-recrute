"""
Sothema AI Recruiter Assistant — Streamlit Chat Page.
Provides an interactive conversation interface with the tool-augmented SothemaHRAgent.
"""
import streamlit as st
from utils.hr_agent import SothemaHRAgent
import ats_store
import sothema_ui as ui


def render_assistant_page(app_instance=None):
    """Renders the AI Recruiter Agent conversation interface."""
    st.markdown("""
        <div style="margin-bottom: 1.5rem;">
            <h1 style="margin: 0; font-size: 1.8rem; font-weight: 700; color: #1e293b;">
                🎙️ SothemIA — Copilote Recruteur SOTHEMA
            </h1>
            <p style="margin: 0.25rem 0 0; color: #64748b; font-size: 0.95rem;">
                Assistant RH connecté à la CVthèque de l'application.
            </p>
        </div>
    """, unsafe_allow_html=True)

    # Initialize chat history with a live count rather than a hard-coded total.
    if "agent_messages" not in st.session_state:
        try:
            candidate_total = ats_store.candidate_count()
            opening = (
                f"La CVthèque contient actuellement **{candidate_total} dossier(s)**. "
                "Je peux rechercher des profils, résumer des compétences, comparer des candidatures "
                "ou préparer des guides d'entretien pour aider votre revue RH.\n\n"
            )
        except Exception:
            opening = "Je peux vous aider à interroger la CVthèque et à préparer votre revue RH.\n\n"
        st.session_state.agent_messages = [{
            "role": "assistant",
            "content": (
                "Bonjour ! Je suis **SothemIA**, votre copilote RH.\n\n"
                + opening
                + "Toutes les analyses sont consultatives et doivent être vérifiées par une personne. "
                "Comment puis-je vous aider aujourd'hui ?"
            ),
        }]

    agent = SothemaHRAgent()

    # Groq is configured by the server operator, never written from this page.
    if not agent.is_configured:
        with st.container(border=True):
            st.info("Le copilote IA n'est pas configuré sur ce serveur.")
            st.caption(
                "Un administrateur peut définir GROQ_API_KEY et, si nécessaire, "
                "GROQ_MODEL dans l'environnement du serveur ou les secrets Streamlit "
                "([groq] avec api_key/model). Ne saisissez pas de clé API dans cette page."
            )

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
            prompt_to_send = "Recherche un profil de responsable ressources humaines et prépare un guide d'entretien avec des questions comportementales STAR."

    if st.session_state.get("_agent_prefill_prompt"):
        prompt_to_send = st.session_state.pop("_agent_prefill_prompt")

    for msg in st.session_state.agent_messages:
        with st.chat_message(msg["role"], avatar="assets/sothema-logo.png" if msg["role"] == "assistant" else None):
            st.markdown(msg["content"])
            if msg.get("tools"):
                with st.expander(f"🔍 Outils ATS exécutés ({len(msg['tools'])})", expanded=False):
                    for tool in msg["tools"]:
                        st.markdown(f"**`{tool['tool']}`**")
                        st.json(tool.get("arguments", {}))

    st.columns([6, 1])
    user_input = st.chat_input("Posez une question sur vos candidats, demandez une recherche ou un guide d'entretien...")
    actual_prompt = prompt_to_send or user_input

    if actual_prompt:
        st.session_state.agent_messages.append({"role": "user", "content": actual_prompt})
        with st.chat_message("user"):
            st.markdown(actual_prompt)

        with st.chat_message("assistant", avatar="assets/sothema-logo.png"):
            with st.spinner("L'Assistant analyse la CVthèque et consulte la base ATS..."):
                reply, tools_run = agent.run_conversation(st.session_state.agent_messages)
                st.markdown(reply)
                if tools_run:
                    with st.expander(f"🔍 Outils ATS exécutés ({len(tools_run)})", expanded=False):
                        for tool in tools_run:
                            st.markdown(f"**`{tool['tool']}`**")
                            st.json(tool.get("arguments", {}))

        st.session_state.agent_messages.append({
            "role": "assistant",
            "content": reply,
            "tools": tools_run,
        })
        st.rerun()

    with st.sidebar:
        st.divider()
        if st.button("🗑️ Réinitialiser la discussion", use_container_width=True):
            st.session_state.agent_messages = [{
                "role": "assistant",
                "content": "Discussion réinitialisée. En quoi SothemIA peut-il vous assister aujourd'hui ?",
            }]
            st.rerun()
