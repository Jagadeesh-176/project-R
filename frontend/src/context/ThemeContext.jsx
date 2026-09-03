import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME } from "../data/themes.js";

const STORAGE_KEY = "rag-app-theme";
const ThemeContext = createContext(null);

function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME; // localStorage can throw in some private-browsing modes
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  // Apply the choice to <html> so index.css's [data-theme="..."] rules can
  // react to it. "system" removes the attribute entirely so the
  // prefers-color-scheme media query takes over instead of a fixed palette.
  useEffect(() => {
    const root = document.documentElement;
    if (theme && theme !== "system") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }
  }, [theme]);

  function setTheme(next) {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal — the theme still applies for this session, it just won't
      // be remembered on the next visit.
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
