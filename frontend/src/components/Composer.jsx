import Icon from "./Icon.jsx";

export default function Composer({ value, onChange, onSubmit, onAttachClick, loading, uploading }) {
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <button
        type="button"
        className="composer-attach"
        onClick={onAttachClick}
        disabled={uploading}
        aria-label="Upload a document"
        title="Upload a document"
      >
        <Icon name="paperclip" size={18} />
      </button>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question…"
        disabled={loading}
        rows={1}
      />
      <button type="submit" disabled={loading || !value.trim()} aria-label="Send" className="composer-send">
        <Icon name="send" size={17} />
      </button>
    </form>
  );
}
