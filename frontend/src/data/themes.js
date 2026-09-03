// Six themes: "system" follows the OS preference (see index.css's
// prefers-color-scheme block); every other value is a fixed palette applied
// via a data-theme attribute on <html>. Swatches are shown in the theme
// switcher dropdown so you can preview a theme before picking it.
export const THEME_OPTIONS = [
  { value: "system", label: "System", swatch: "#94a3b8" },
  { value: "light", label: "Light", swatch: "#4f46e5" },
  { value: "dark", label: "Dark", swatch: "#818cf8" },
  { value: "ocean", label: "Ocean", swatch: "#0891b2" },
  { value: "sunset", label: "Sunset", swatch: "#f97316" },
  { value: "forest", label: "Forest", swatch: "#16a34a" },
];

export const DEFAULT_THEME = "system";
