import { useEffect, useRef, useState } from "react";
import {
  askQuestion,
  checkHealth,
  clearUploads,
  deleteDocument,
  listDocuments,
  rebuildIndex,
  uploadDocument,
} from "./api.js";

const SUGGESTIONS = [
  "How many PTO days do Acme employees get?",
  "What gripper design did Project Apollo choose?",
  "How many devices can the Acme Home Hub support?",
];

const ACCEPTED_TYPES = ".txt,.md,.pdf,.docx";

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

function DocumentsPanel({
  documents,
  uploading,
  deletingFilename,
  rebuilding,
  clearing,
  onUploadClick,
  onDelete,
  onRebuild,
  onClearUploads,
}) {
  const hasUploads = documents.some((d) => !d.is_sample);

  return (
    <div className="documents-panel">
      <div className="documents-actions">
        <button onClick={onUploadClick} disabled={uploading} className="upload-btn">
          {uploading ? "Uploading…" : "+ Upload document"}
        </button>
        <button onClick={onRebuild} disabled={rebuilding} className="rebuild-btn">
          {rebuilding ? "Rebuilding…" : "Rebuild index"}
        </button>
        {hasUploads && (
          <button onClick={onClearUploads} disabled={clearing} className="clear-btn">
            {clearing ? "Clearing…" : "Clear uploads"}
          </button>
        )}
      </div>
      <p className="documents-hint">Supports {ACCEPTED_TYPES.replaceAll(".", " ").trim()} files.</p>

      <ul className="documents-list">
        {documents.map((doc) => (
          <li key={doc.filename}>
            <span className="doc-name">{doc.filename}</span>
            <span className="doc-chunks">{doc.chunks} chunk(s)</span>
            {doc.is_sample ? (
              <span className="doc-badge">sample</span>
            ) : (
              <button
                className="doc-delete"
                onClick={() => onDelete(doc.filename)}
                disabled={deletingFilename === doc.filename}
                aria-label={`Remove ${doc.filename}`}
              >
                {deletingFilename === doc.filename ? "…" : "✕"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendUp, setBackendUp] = useState(null); // null = checking
  const [rebuilding, setRebuilding] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [docsOpen, setDocsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingFilename, setDeletingFilename] = useState(null);
  const [clearing, setClearing] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  function refreshDocuments() {
    listDocuments()
      .then(setDocuments)
      .catch(() => {}); // best-effort — a stale/missing list isn't worth surfacing an error for
  }

  useEffect(() => {
    checkHealth().then((ok) => {
      setBackendUp(ok);
      if (ok) refreshDocuments();
    });
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
      refreshDocuments();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", text: err.message || "Rebuild failed." },
      ]);
    } finally {
      setRebuilding(false);
    }
  }

  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so choosing the same file again still fires onChange
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadDocument(file);
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `Uploaded "${result.filename}" → ${result.chunks} chunk(s) added. You can ask about it now.`,
        },
      ]);
      refreshDocuments();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", text: err.message || "Upload failed." },
      ]);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDoc(filename) {
    setDeletingFilename(filename);
    try {
      await deleteDocument(filename);
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `Removed "${filename}" from the knowledge base.` },
      ]);
      refreshDocuments();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", text: err.message || "Couldn't remove that document." },
      ]);
    } finally {
      setDeletingFilename(null);
    }
  }

  async function handleClearUploads() {
    if (!window.confirm("Remove all uploaded documents? Sample docs will stay.")) return;

    setClearing(true);
    try {
      const result = await clearUploads();
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `Cleared ${result.count} uploaded document(s).` },
      ]);
      refreshDocuments();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", text: err.message || "Couldn't clear uploads." },
      ]);
    } finally {
      setClearing(false);
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
        <button onClick={() => setDocsOpen((v) => !v)} className="docs-toggle-btn">
          📚 Documents ({documents.length}) {docsOpen ? "▲" : "▼"}
        </button>
      </header>

      {docsOpen && (
        <DocumentsPanel
          documents={documents}
          uploading={uploading}
          deletingFilename={deletingFilename}
          rebuilding={rebuilding}
          clearing={clearing}
          onUploadClick={() => fileInputRef.current?.click()}
          onDelete={handleDeleteDoc}
          onRebuild={handleRebuild}
          onClearUploads={handleClearUploads}
        />
      )}
      <input
        type="file"
        ref={fileInputRef}
        accept={ACCEPTED_TYPES}
        onChange={handleFileChosen}
        hidden
      />

      <main className="messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty-state">
            <p>
              Ask a question about the sample documents, or upload your own via{" "}
              <strong>📚 Documents</strong> above.
            </p>
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
