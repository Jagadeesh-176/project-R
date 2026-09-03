import { useEffect, useRef, useState } from "react";
import { askQuestion, checkHealth, rebuildIndex } from "./api.js";

const SUGGESTIONS = [
  "How many PTO days do Acme employees get?",
  "What gripper design did Project Apollo choose?",
  "How many devices can the Acme Home Hub support?",
];

function SourceList({ sources }) {
  if (!sources || sources.length === 0) return null;
  return (
    <details className="sources">
      <summary>{sources.length} source(s)</summary>
      <ul>
        {sources.map((s, i) => (
          <li key={i}>
            <span className="source-name">
              {s.source} <span className="source-meta">#{s.chunk_index}</span>
            </span>
            <p className="source-preview">{s.preview}…</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendUp, setBackendUp] = useState(null); // null = checking
  const [rebuilding, setRebuilding] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    checkHealth().then(setBackendUp);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(question) {
    const text = question.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const result = await askQuestion(text);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: result.answer, sources: result.sources },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", text: err.message || "Something went wrong." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRebuild() {
    setRebuilding(true);
    try {
      const result = await rebuildIndex(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `Index rebuilt: ${result.documents} document(s) → ${result.chunks} chunk(s).`,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", text: err.message || "Rebuild failed." },
      ]);
    } finally {
      setRebuilding(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>RAG Demo</h1>
          <p className={`status ${backendUp ? "status-ok" : "status-down"}`}>
            {backendUp === null
              ? "Checking backend…"
              : backendUp
              ? "Backend connected"
              : "Backend unreachable — is uvicorn running?"}
          </p>
        </div>
        <button onClick={handleRebuild} disabled={rebuilding} className="rebuild-btn">
          {rebuilding ? "Rebuilding…" : "Rebuild index"}
        </button>
      </header>

      <main className="messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty-state">
            <p>Ask a question about the sample documents in backend/data/sample_docs.</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="suggestion-chip">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`bubble-row ${m.role}`}>
            <div className={`bubble ${m.role}`}>
              <p>{m.text}</p>
              {m.role === "assistant" && <SourceList sources={m.sources} />}
            </div>
          </div>
        ))}

        {loading && (
          <div className="bubble-row assistant">
            <div className="bubble assistant thinking">Thinking…</div>
          </div>
        )}
      </main>

      <form className="composer" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
