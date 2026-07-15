import { useEffect, useState } from "react";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function App() {
  const [emails, setEmails] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [selectedEmailId, setSelectedEmailId] = useState(null);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState("");
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [nextPageToken, setNextPageToken] = useState(null)
  const [replySuggestionsByProvider, setReplySuggestionsByProvider] = useState({});
  const [loadingReply, setLoadingReply] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [repliedMessages, setRepliedMessages] = useState({});
  const [labelAppliedByProvider, setLabelAppliedByProvider] = useState({});
  const [activeProvider, setActiveProvider] = useState("gemini");
  const [categoryFeedbackByProvider, setCategoryFeedbackByProvider] = useState({});
  const [replyFeedbackByProvider, setReplyFeedbackByProvider] = useState({});

  function connectGmail() {
    window.location.href = `${API_BASE_URL}/gmail/auth/`;
  }

  function getAuthHeaders() {
    const sessionKey = localStorage.getItem("safira_session_key");

    return sessionKey
      ? { "X-Safira-Session-Key": sessionKey }
      : {};
  }

  async function loadEmails(pageToken = null) {
    setError("");
    setLoadingEmails(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/gmail/messages/${
          pageToken ? `?page_token=${pageToken}` : ""
        }`,
        {
          credentials: "include",
          headers: {
            ...getAuthHeaders(),
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao buscar e-mails.");
      }

      setNextPageToken(data.next_page_token)
      
      if (pageToken) {
        setEmails((prev) => [...prev, ...data.messages])
      } else {
        setEmails(data.messages)
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingEmails(false);
    }
  }

  async function analyzeEmail(messageId, force = false) {
    setError("");
    setAnalysis(null);
    setSelectedEmailId(messageId);
    setLoadingAnalysis(true);

    const email = emails.find((item) => item.id === messageId);

    try {
      const response = await fetch(
        `${API_BASE_URL}/llm/compare-email/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            subject: email?.subject || "",
            body: email?.snippet || "",
            existing_labels: ["Academico", "Trabalho", "Financeiro"],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao analisar e-mail.");
      }

      setAnalysis({
        gmail_message_id: messageId,
        subject: email?.subject || "Sem assunto",
        results: data.results,
        errors: data.errors,
      });

      if (data.results?.gemini) {
        setActiveProvider("gemini");
      } else if (data.results?.llama) {
        setActiveProvider("llama");
      } else {
        setActiveProvider("gemini");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAnalysis(false);
    }
  }

  async function confirmLabel() {
    const currentAnalysis = analysis?.results?.[activeProvider];
    const labelName = currentAnalysis?.gmail_label;

    if (!analysis?.gmail_message_id || !labelName) return;

    const providerActionKey = `${analysis.gmail_message_id}:${activeProvider}`;

    setError("");

    try{
      await fetch(`${API_BASE_URL}/llm/register-preference/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          email_id: analysis.gmail_message_id,
          provider: activeProvider,
          action: "apply_label",
        }),
      });

      const response = await fetch(
        `${API_BASE_URL}/gmail/messages/${analysis.gmail_message_id}/apply-label/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            label_name: labelName,
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao aplicar marcador.");
      }

      setLabelAppliedByProvider((prev) => ({
        ...prev,
        [providerActionKey]: true,
      }));

      setAnalysis({
        ...analysis,
        gmail_label: data.gmail_label,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function suggestReply() {
    if (!analysis?.gmail_message_id) return;

    setError("");
    setLoadingReply(true);
    setSendingReply(false);

    const providerActionKey = `${analysis.gmail_message_id}:${activeProvider}`;

    setReplySuggestionsByProvider((prev) => ({
      ...prev,
      [providerActionKey]: null,
    }));

    try{
      const response = await fetch(
        `${API_BASE_URL}/gmail/messages/${analysis.gmail_message_id}/suggest-reply/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            provider: activeProvider,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao sugerir resposta.");
      }

      setReplySuggestionsByProvider((prev) => ({
        ...prev,
        [providerActionKey]: data,
      }));
    } catch(err) {
      setError(err.message);
    } finally {
      setLoadingReply(false);
    }
  }

  async function sendReply() {
    if (!analysis?.gmail_message_id) return;

    const providerActionKey = `${analysis.gmail_message_id}:${activeProvider}`;
    const currentReplySuggestion = replySuggestionsByProvider[providerActionKey];

    if (!currentReplySuggestion?.suggested_reply) return;

    setError("");
    setSendingReply(true);

    if (repliedMessages[providerActionKey]) {
      const confirmSendAgain = window.confirm(
        "Você já enviou uma resposta com este provedor para este e-mail. Deseja enviar uma nova resposta mesmo assim?"
      );

      if (!confirmSendAgain) {
        setSendingReply(false);
        return;
      }
    }

    try{
      const response = await fetch(
        `${API_BASE_URL}/gmail/messages/${analysis.gmail_message_id}/send-reply/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            reply: currentReplySuggestion.suggested_reply,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar resposta.");
      }

      setReplySuggestionsByProvider((prev) => ({
        ...prev,
        [providerActionKey]: {
          ...currentReplySuggestion,
          sent: true,
        },
      }));

      setRepliedMessages((prev) => ({
        ...prev,
        [providerActionKey]: true,
      }));

      await fetch(`${API_BASE_URL}/llm/register-preference/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          email_id: analysis.gmail_message_id,
          provider: activeProvider,
          action: "send_reply",
        }),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingReply(false);
    }
  }

  async function disconnectGmail() {
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/gmail/disconnect/`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...getAuthHeaders(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao desconectar Gmail.");
      }

      localStorage.removeItem("safira_session_key");

      setIsGmailConnected(false);
      setEmails([]);
      setAnalysis(null);
      setSelectedEmailId(null);
      setReplySuggestionsByProvider({});
      setLabelAppliedByProvider({});
      setCategoryFeedbackByProvider({});
      setReplyFeedbackByProvider({});
    } catch (err) {
      setError(err.message);
    }
  }

  async function registerFeedback(action) {
    if (!analysis?.gmail_message_id) return;

    const providerActionKey = `${analysis.gmail_message_id}:${activeProvider}`;

    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/llm/register-preference/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          email_id: analysis.gmail_message_id,
          provider: activeProvider,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao registrar feedback.");
      }

      if (action.startsWith("category_")) {
        setCategoryFeedbackByProvider((prev) => ({
          ...prev,
          [providerActionKey]: action,
        }));
      }

      if (action.startsWith("reply_")) {
        setReplyFeedbackByProvider((prev) => ({
          ...prev,
          [providerActionKey]: action,
        }));
      }
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    async function checkGmailStatus() {
      try {
        const response = await fetch(`${API_BASE_URL}/gmail/status/`, {
          credentials: "include",
          headers: {
            ...getAuthHeaders(),
          },
        });

        const data = await response.json();

        setIsGmailConnected(data.connected);
      } catch (error) {
        setIsGmailConnected(false);
      }
    }

    const params = new URLSearchParams(window.location.search);

    const safiraSessionKey = params.get("safira_session_key");

    if (safiraSessionKey) {
      localStorage.setItem("safira_session_key", safiraSessionKey);
    }

    if (params.get("gmail_connected") === "true") {
      window.history.replaceState({}, "", window.location.pathname);
    }

    checkGmailStatus();
  }, []);

  const currentAnalysis = analysis?.results?.[activeProvider];
  const providerActionKey = analysis?.gmail_message_id
    ? `${analysis.gmail_message_id}:${activeProvider}`
    : null;
  const categoryFeedback = providerActionKey
    ? categoryFeedbackByProvider[providerActionKey]
    : null;
  const replyFeedback = providerActionKey
    ? replyFeedbackByProvider[providerActionKey]
    : null;
  const labelApplied = providerActionKey
    ? labelAppliedByProvider[providerActionKey]
    : false;
  const replySuggestion = providerActionKey
    ? replySuggestionsByProvider[providerActionKey]
    : null;
  const alreadyRepliedWithProvider = providerActionKey
    ? repliedMessages[providerActionKey]
    : false;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-badge">S</div>
          <h1>Safira</h1>
          <p>Assistente inteligente para Gmail.</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">LLM + Gmail API</span>
            <h2>Organização inteligente de e-mails</h2>
            <p>Classifique, resuma, aplique marcadores e responda automaticamente.</p>
          </div>

          <div className="actions">
            <div
              className={`connection-status ${
                isGmailConnected || emails.length > 0 ? "connected" : "disconnected"
              }`}
            >
              <span className="status-dot" />
              {isGmailConnected || emails.length > 0
                ? "Gmail conectado"
                : "Gmail desconectado"}
            </div>

            {isGmailConnected ? (
              <button className="disconnect-button" onClick={disconnectGmail}>
                Desconectar Gmail
              </button>
            ) : (
              <button onClick={connectGmail}>
                Conectar Gmail
              </button>
            )}

            <button onClick={() => loadEmails()} disabled={!isGmailConnected || loadingEmails}>
              {loadingEmails ? "Carregando..." : "Listar e-mails"}
            </button>
          </div>
        </header>

        {error && <div className="error">{error}</div>}

        <section className="dashboard-grid">
          <section className="panel email-panel">
            <div className="panel-header">
              <div>
                <h3>Caixa de entrada</h3>
                <p>{emails.length} e-mails carregados</p>
              </div>
            </div>

            {loadingEmails && <div className="empty-state">Buscando e-mails...</div>}

            {!loadingEmails && emails.length === 0 && (
              <div className="empty-state">
                Clique em <strong>Listar e-mails</strong> para carregar sua caixa de entrada.
              </div>
            )}

            <div className="email-list">
              {emails.map((email) => (
                <article
                  className={`email-item ${selectedEmailId === email.id ? "selected" : ""}`}
                  key={email.id}
                  onClick={() => analyzeEmail(email.id)}
                >
                  <div className="email-topline">
                    <span className="sender">{email.from}</span>
                    <span className="date">{email.date}</span>
                  </div>

                  <h4>{email.subject || "Sem assunto"}</h4>
                  <p>{email.snippet}</p>

                </article>
              ))}
            </div>

            {nextPageToken && (
              <button
                className="load-more-button"
                onClick={() => loadEmails(nextPageToken)}
                disabled={loadingEmails}
              >
                {loadingEmails ? "Carregando..." : "Carregar mais e-mails"}
              </button>
            )}
          </section>

          <section className="panel analysis-panel">
            <div className="panel-header">
              <div>
                <h3>Análise inteligente</h3>
                <p>Resumo, categoria, urgência, marcador e sugestão de resposta.</p>
              </div>
            </div>

            {loadingAnalysis && (
              <div className="empty-state">Analisando e-mail...</div>
            )}

            {!loadingAnalysis && !analysis && (
              <div className="empty-state">
                Selecione um e-mail para visualizar a análise.
              </div>
            )}

            {analysis && (
              <div className="analysis-card">
                <h4>{analysis.subject}</h4>
                <div className="llm-tabs">
                  <button
                    className={activeProvider === "gemini" ? "llm-tab active" : "llm-tab"}
                    onClick={() => setActiveProvider("gemini")}
                  >
                    Gemini
                  </button>

                  <button
                    className={activeProvider === "llama" ? "llm-tab active" : "llm-tab"}
                    onClick={() => setActiveProvider("llama")}
                  >
                    Llama
                  </button>
                </div>
                {!currentAnalysis && (
                  <div className="empty-state">
                    {activeProvider === "llama"
                      ? "Llama indisponível no momento. Tente novamente mais tarde."
                      : "Gemini indisponível no momento. Tente novamente mais tarde."}
                  </div>
                )}

                {currentAnalysis && (
                  <>
                    <div className="badges">
                      <span className="badge">{currentAnalysis.categoria}</span>
                      <span
                        className={`badge ${currentAnalysis.urgente ? "urgent" : "calm"}`}
                      >
                        {currentAnalysis.urgente ? "Urgente" : "Não urgente"}
                      </span>
                      <span className="badge label">
                        Sugestão de marcador: {currentAnalysis.gmail_label}
                      </span>
                    </div>

                    <div className="feedback-row">
                      <span>Categoria sugerida:</span>

                      <button
                        onClick={() => registerFeedback("category_ok")}
                        disabled={!!categoryFeedback}
                      >
                        OK
                      </button>

                      <button
                        onClick={() => registerFeedback("category_not_ok")}
                        disabled={!!categoryFeedback}
                      >
                        Não
                      </button>
                    </div>

                    <div className="analysis-section">
                      <span>Resumo</span>
                      <p>{currentAnalysis.resumo}</p>
                    </div>

                    <div className="analysis-section">
                      <span>Motivo da urgência</span>
                      <p>{currentAnalysis.motivo_urgencia}</p>
                    </div>

                    <div className="analysis-actions">
                      <button
                        onClick={confirmLabel}
                        disabled={!!labelApplied}
                      >
                        {labelApplied ? "Marcador aplicado" : "Confirmar marcador"}
                      </button>

                      <button
                        className="secondary"
                        onClick={() => analyzeEmail(selectedEmailId, true)}
                      >
                        Refazer análise
                      </button>

                      <button
                        className="secondary"
                        onClick={suggestReply}
                        disabled={loadingReply}
                      >
                        {loadingReply ? "Gerando..." : "Sugerir resposta"}
                      </button>

                      <button
                        className="cancel-button"
                        onClick={() => {
                          setAnalysis(null);
                          setSelectedEmailId(null);
                          if (providerActionKey) {
                            setReplySuggestionsByProvider((prev) => ({
                              ...prev,
                              [providerActionKey]: null,
                            }));
                          }
                          setSendingReply(false);
                          setLoadingReply(false);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                )}

                {replySuggestion && (
                  <div className="reply-suggestion">
                    <span>Resposta sugerida</span>

                    <textarea
                      value={replySuggestion.suggested_reply}
                      onChange={(event) =>
                        setReplySuggestionsByProvider((prev) => ({
                          ...prev,
                          [providerActionKey]: {
                            ...replySuggestion,
                            suggested_reply: event.target.value,
                          },
                        }))
                      }
                    />

                    <p>
                      {replySuggestion.needs_reply
                        ? "A Safira identificou que este e-mail pode precisar de resposta."
                        : "A Safira identificou que este e-mail talvez não precise de resposta."}
                    </p>

                    <div className="feedback-row">
                      <span>Resposta sugerida:</span>

                      <button
                        onClick={() => registerFeedback("reply_good")}
                        disabled={!!replyFeedback}
                      >
                        Boa
                      </button>

                      <button
                        onClick={() => registerFeedback("reply_medium")}
                        disabled={!!replyFeedback}
                      >
                        Média
                      </button>

                      <button
                        onClick={() => registerFeedback("reply_bad")}
                        disabled={!!replyFeedback}
                      >
                        Ruim
                      </button>
                    </div>

                    <button
                      className="send-reply-button"
                      onClick={sendReply}
                      disabled={sendingReply}
                    >
                      {sendingReply
                        ? "Enviando..."
                        : alreadyRepliedWithProvider
                          ? "Enviar nova resposta"
                          : "Enviar resposta"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

export default App;