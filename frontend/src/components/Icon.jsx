// Small inline-SVG icon set — no icon-library dependency, just the handful
// of glyphs this app actually uses. Every icon is a 24x24 viewBox stroke
// icon so they line up regardless of which one is used where.
const PATHS = {
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6L6 18",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z",
  paperclip:
    "M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49",
  upload: "M12 3v12m0-12 4.5 4.5M12 3 7.5 7.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  sun: "M12 3v2m0 14v2m9-9h-2M5 12H3m15.36 6.36-1.42-1.42M7.05 7.05 5.64 5.64m12.72 0-1.42 1.42M7.05 16.95l-1.42 1.42M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z",
  palette:
    "M12 21a9 9 0 1 1 0-18c4.97 0 9 3.5 9 7.5 0 2.49-2.01 3.5-4 3.5h-1.7c-1 0-1.3 1.3-.5 1.9.8.6.5 2.1-.8 2.1H12Zm-4.5-9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm3-3.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm4.5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  chevronDown: "m6 9 6 6 6-6",
  check: "M20 6 9 17l-5-5",
  trash: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z M14 2v6h6",
  bot: "M12 8V4H8m8 0h-4m-6 8v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6M4 12h1m14 0h1M9 16h.01M15 16h.01M4 8h16v4H4z",
  refresh: "M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z",
};

export default function Icon({ name, size = 18, className = "", ...rest }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
