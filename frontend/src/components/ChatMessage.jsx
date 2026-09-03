import Markdown from "react-markdown";
import Icon from "./Icon.jsx";

function SourceList({ sources }) {
  if (!sources || sources.length === 0) return null;
  return (
    <details className="sources">
      <summary>
        <Icon name="book" size={13} />
        {sources.length} source{sources.length === 1 ? "" : "s"}
      </summary>
      <ul>
        {sources.map((s, i) => (
          <li key={i}>
            <div className="source-head">
              <Icon name="file" size={13} />
              <span className="source-name">{s.source}</span>
              <span className="source-meta">chunk #{s.chunk_index}</span>
            </div>
            <p className="source-preview">{s.preview}…</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Avatar({ role }) {
  if (role === "user") {
    return <div className="avatar avatar-user">You</div>;
  }
  return (
    <div className="avatar avatar-bot">
      <Icon name="bot" size={16} />
    </div>
  );
}

export default function ChatMessage({ role, text, sources }) {
  // system/error messages are slim inline notices, not full chat bubbles
  if (role === "system" || role === "error") {
    return (
      <div className={`notice notice-${role}`}>
        <span>{text}</span>
      </div>
    );
  }

  return (
    <div className={`message-row ${role}`}>
      <Avatar role={role} />
      <div className={`bubble ${role}`}>
        {role === "assistant" ? (
          <div className="markdown">
            <Markdown>{text}</Markdown>
          </div>
        ) : (
          <p>{text}</p>
        )}
        {role === "assistant" && <SourceList sources={sources} />}
      </div>
    </div>
  );
}
