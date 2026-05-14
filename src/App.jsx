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

  function connectGmail() {
    window.location.href = `${API_BASE_URL}/gmail/auth/`;
  }

  async function loadEmails() {
    setError("");
    setLoadingEmails(true);

    try {
      const response = await fetch(`${API_BASE_URL}/gmail/messages/`, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao buscar e-mails.");
      }

      setEmails(data.messages || []);
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

    try {
      const response = await fetch(
        `${API_BASE_URL}/gmail/messages/${messageId}/summarize/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            force_refresh: force,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao analisar e-mail.");
      }

      setAnalysis(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAnalysis(false);
    }
  }

  async function confirmLabel() {
    if (!analysis?.gmail_message_id || !analysis?.suggested_label) return;

    setError("");

    try{
      const response = await fetch(
        `${API_BASE_URL}/gmail/messages/${analysis.gmail_message_id}/apply-label/`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            label_name: analysis.suggested_label,
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
            <span className="eyebrow">TCC · LLM + Gmail API</span>
            <h2>Organização inteligente de e-mails</h2>
            <p>Classifique, resuma e aplique marcadores automaticamente.</p>
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

            <button onClick={loadEmails} disabled={!isGmailConnected || loadingEmails}>
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
          </section>

          <section className="panel analysis-panel">
            <div className="panel-header">
              <div>
                <h3>Análise inteligente</h3>
                <p>Resumo, categoria, urgência e marcador aplicado.</p>
              </div>
            </div>

            {loadingAnalysis && (
              <div className="empty-state">Analisando e-mail com Gemini...</div>
            )}

            {!loadingAnalysis && !analysis && (
              <div className="empty-state">
                Selecione um e-mail para visualizar a análise.
              </div>
            )}

            {analysis && (
              <div className="analysis-card">
                <h4>{analysis.subject}</h4>

                <div className="badges">
                  <span className="badge">{analysis.analysis.categoria}</span>
                  <span
                    className={`badge ${analysis.analysis.urgente ? "urgent" : "calm"
                      }`}
                  >
                    {analysis.analysis.urgente ? "Urgente" : "Não urgente"}
                  </span>
                  <span className="badge label">
                    Sugestão de marcador: {analysis.suggested_label}
                  </span>
                </div>

                <div className="analysis-section">
                  <span>Resumo</span>
                  <p>{analysis.analysis.resumo}</p>
                </div>

                <div className="analysis-section">
                  <span>Motivo da urgência</span>
                  <p>{analysis.analysis.motivo_urgencia}</p>
                </div>

                <div className="metadata">
                  <span>ID salvo: #{analysis.id}</span>
                  <span>{analysis.from_cache ? "Resultado em cache" : "Nova análise"}</span>
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
                  className="cancel-button"
                  onClick={() => {
                    setAnalysis(null);
                    setSelectedEmailId(null);
                  }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

export default App;