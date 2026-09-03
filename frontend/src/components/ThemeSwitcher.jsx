import { useEffect, useRef, useState } from "react";
import { THEME_OPTIONS } from "../data/themes.js";
import { useTheme } from "../context/ThemeContext.jsx";
import Icon from "./Icon.jsx";

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const current = THEME_OPTIONS.find((t) => t.value === theme) || THEME_OPTIONS[0];

  // Close on outside click and on Escape — a dropdown that only closes by
  // re-clicking its own button feels broken.
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function choose(value) {
    setTheme(value);
    setOpen(false);
  }

  return (
    <div className="theme-switcher" ref={containerRef}>
      <button
        type="button"
        className="theme-switcher-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}`}
      >
        <Icon name="palette" size={16} />
        <span className="theme-swatch" style={{ background: current.swatch }} />
        <span className="theme-switcher-label">{current.label}</span>
        <Icon name="chevronDown" size={14} />
      </button>

      {open ? (
        <ul className="theme-switcher-menu" role="listbox" aria-label="Choose theme">
          {THEME_OPTIONS.map((opt) => (
            <li key={opt.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={theme === opt.value}
                className={`theme-switcher-option${theme === opt.value ? " active" : ""}`}
                onClick={() => choose(opt.value)}
              >
                <span className="theme-swatch" style={{ background: opt.swatch }} />
                <span>{opt.label}</span>
                {theme === opt.value ? <Icon name="check" size={14} /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
