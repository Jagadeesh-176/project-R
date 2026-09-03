import Icon from "./Icon.jsx";
import ThemeSwitcher from "./ThemeSwitcher.jsx";

const ACCEPTED_TYPES = ".txt,.md,.pdf,.docx";

export default function Sidebar({
  open,
  onClose,
  backendUp,
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
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">
            <Icon name="bot" size={20} />
          </div>
          <div>
            <div className="brand-name">RAG Studio</div>
            <div className="brand-tagline">Ask your documents anything</div>
          </div>
          <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div
          className={`status-pill ${
            backendUp === null ? "status-checking" : backendUp ? "status-ok" : "status-down"
          }`}
        >
          <span className="status-dot" />
          {backendUp === null
            ? "Checking backend…"
            : backendUp
            ? "Backend connected"
            : "Backend unreachable"}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-head">
            <Icon name="book" size={14} />
            <span>Knowledge base</span>
            <span className="doc-count">{documents.length}</span>
          </div>

          <div className="documents-actions">
            <button onClick={onUploadClick} disabled={uploading} className="btn btn-primary">
              <Icon name="upload" size={14} />
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <button onClick={onRebuild} disabled={rebuilding} className="btn btn-ghost">
              <Icon name="refresh" size={14} />
              {rebuilding ? "…" : "Rebuild"}
            </button>
          </div>
          <p className="documents-hint">Supports {ACCEPTED_TYPES.replaceAll(".", " ").trim()}</p>

          <ul className="documents-list">
            {documents.map((doc) => (
              <li key={doc.filename}>
                <Icon name="file" size={14} className="doc-icon" />
                <span className="doc-name" title={doc.filename}>
                  {doc.filename}
                </span>
                <span className="doc-chunks">{doc.chunks}</span>
                {doc.is_sample ? (
                  <span className="doc-badge">sample</span>
                ) : (
                  <button
                    className="doc-delete"
                    onClick={() => onDelete(doc.filename)}
                    disabled={deletingFilename === doc.filename}
                    aria-label={`Remove ${doc.filename}`}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {hasUploads && (
            <button onClick={onClearUploads} disabled={clearing} className="btn btn-danger-ghost">
              <Icon name="trash" size={13} />
              {clearing ? "Clearing…" : "Clear uploads"}
            </button>
          )}
        </div>

        <div className="sidebar-footer">
          <ThemeSwitcher />
        </div>
      </aside>
    </>
  );
}
