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
  const [replySuggestion, setReplySuggestion] = useState(null);
  const [loadingReply, setLoadingReply] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [repliedMessages, setRepliedMessages] = useState({});
  const [activeProvider, setActiveProvider] = useState("gemini");
  const [categoryFeedback, setCategoryFeedback] = useState(null);
  const [replyFeedback, setReplyFeedback] = useState(null);

  function connectGmail() {
    window.location.href = `${API_BASE_URL}/gmail/auth/`;
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
        }
      )

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
    setReplySuggestion(null);
    setCategoryFeedback(null);
    setReplyFeedback(null);
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

      setActiveProvider("gemini");
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

    setError("");

    try{
      await fetch(`${API_BASE_URL}/llm/register-preference/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
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

      setAnalysis({
        ...analysis,
        gmail_label: data.gmail_label,
        label_applied: true,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function suggestReply() {
    if (!analysis?.gmail_message_id) return;

    setError("");
    setLoadingReply(true);
    setReplySuggestion(null);
    setSendingReply(false);

    try{
      const response = await fetch(
        `${API_BASE_URL}/gmail/messages/${analysis.gmail_message_id}/suggest-reply/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
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

      setReplySuggestion(data);
    } catch(err) {
      setError(err.message);
    } finally {
      setLoadingReply(false);
    }
  }

  async function sendReply() {
    if (!analysis?.gmail_message_id || !replySuggestion?.suggested_reply) return;

    setError("");
    setSendingReply(true);

    if (repliedMessages[analysis.gmail_message_id]) {
      const confirmSendAgain = window.confirm(
        "Você já enviou uma resposta para este e-mail. Deseja enviar uma nova resposta mesmo assim?"
      );

      if (!confirmSendAgain) return;
    }

    try{
      const response = await fetch(
        `${API_BASE_URL}/gmail/messages/${analysis.gmail_message_id}/send-reply/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reply: replySuggestion.suggested_reply,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar resposta.");
      }

      setReplySuggestion({
        ...replySuggestion,
        sent: true,
      });

      setRepliedMessages((prev) => ({
        ...prev,
        [analysis.gmail_message_id]: true,
      }));

      await fetch(`${API_BASE_URL}/llm/register-preference/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
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
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao desconectar Gmail.");
      }

      setIsGmailConnected(false);
      setEmails([]);
      setAnalysis(null);
      setSelectedEmailId(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function registerFeedback(action) {
    if (!analysis?.gmail_message_id) return;

    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/llm/register-preference/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
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
        setCategoryFeedback(action);
      }

      if (action.startsWith("reply_")) {
        setReplyFeedback(action);
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
        });

        const data = await response.json();

        setIsGmailConnected(data.connected);
      } catch (error) {
        setIsGmailConnected(false);
      }
    }

    const params = new URLSearchParams(window.location.search);

    if (params.get("gmail_connected") === "true") {
      window.history.replaceState({}, "", window.location.pathname);
    }

    checkGmailStatus();
  }, []);

  const currentAnalysis = analysis?.results?.[activeProvider];

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
                      ? "Llama indisponível no momento. Verifique se o Ollama e o túnel estão ativos."
                      : "Gemini indisponível no momento. Tente novamente mais tarde ou use a aba Llama."}
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
                        disabled={analysis.label_applied}
                      >
                        {analysis.label_applied ? "Marcador aplicado" : "Confirmar marcador"}
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
                          setReplySuggestion(null);
                          setSendingReply(false);
                          setLoadingReply(false);
                          setCategoryFeedback(null);
                          setReplyFeedback(null);
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
                        setReplySuggestion({
                          ...replySuggestion,
                          suggested_reply: event.target.value,
                        })
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
                        : repliedMessages[analysis.gmail_message_id]
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