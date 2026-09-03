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
import ChatMessage from "./components/ChatMessage.jsx";
import Composer from "./components/Composer.jsx";
import Icon from "./components/Icon.jsx";
import Sidebar from "./components/Sidebar.jsx";

const SUGGESTIONS = [
  "How many PTO days do Acme employees get?",
  "What gripper design did Project Apollo choose?",
  "How many devices can the Acme Home Hub support?",
];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendUp, setBackendUp] = useState(null); // null = checking
  const [rebuilding, setRebuilding] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [deletingFilename, setDeletingFilename] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer only
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

  return (
    <div className="app-shell">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        backendUp={backendUp}
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
      <input
        type="file"
        ref={fileInputRef}
        accept=".txt,.md,.pdf,.docx"
        onChange={handleFileChosen}
        hidden
      />

      <div className="main">
        <div className="topbar">
          <button
            className="topbar-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" size={20} />
          </button>
          <span className="topbar-title">RAG Studio</span>
        </div>

        <main className="messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                <Icon name="bot" size={28} />
              </div>
              <h2>Ask your documents anything</h2>
              <p>
                Answers are grounded in the sample documents and anything you upload —
                open <strong>the sidebar</strong> to add your own.
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
            <ChatMessage key={i} role={m.role} text={m.text} sources={m.sources} />
          ))}

          {loading && (
            <div className="message-row assistant">
              <div className="avatar avatar-bot">
                <Icon name="bot" size={16} />
              </div>
              <div className="bubble assistant thinking">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}
        </main>

        <Composer
          value={input}
          onChange={setInput}
          onSubmit={() => send(input)}
          onAttachClick={() => fileInputRef.current?.click()}
          loading={loading}
          uploading={uploading}
        />
      </div>
    </div>
  );
}
