import React from "react";

const paths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  inbox: "M4 4h16v13H4z M4 17l4-5h3l1 2h3l1-2h4",
  leads:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  appointments: "M4 5h16v16H4z M16 3v4 M8 3v4 M4 11h16",
  ghosting: "M3 12a9 9 0 1 0 3-6 M3 3v6h6 M12 7v5l3 2",
  campaigns: "M3 10v4l12 4V6z M7 15l1 6h3l-1-5 M19 8l2-2 M19 16l2 2 M19 12h3",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  onboarding: "M4 4h16v17H4z M8 4V2h8v2 M8 10l2 2 5-5 M8 17h8",
  "booking-events": "M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5",
  search: "M21 21l-5-5 M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  chevron: "M9 5l7 7-7 7",
  lock: "M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1",
  moon: "M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  close: "M6 6l12 12 M6 18L18 6",
  refresh: "M20 7a9 9 0 1 0 1 8 M20 2v6h-6",
  check: "M5 12l4 4L19 6",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 10v6 M12 7h.01",
  human: "M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M5 21v-3a7 7 0 0 1 14 0v3",
  spark: "M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
};
export function Icon({ name, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.info} />
    </svg>
  );
}
export function Badge({ children, tone = "neutral" }) {
  return (
    <span className={`v2-badge v2-badge-${tone}`}>
      <span className="v2-dot" />
      {children}
    </span>
  );
}
export function Avatar({ name, large = false }) {
  const initials = String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`v2-avatar${large ? " v2-avatar-large" : ""}`}
    >
      {initials}
    </span>
  );
}
export function EmptyState({
  title = "Noch keine Daten",
  children,
  icon = "inbox",
  action,
}) {
  return (
    <div className="v2-empty">
      <span className="v2-empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Panel({ title, caption, children, action, className = "" }) {
  return (
    <section className={`v2-panel ${className}`}>
      {title && (
        <header className="v2-panel-heading">
          <div>
            <h2>{title}</h2>
            {caption && <p>{caption}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
export function LockedAction({ children, primary = false }) {
  return (
    <button
      type="button"
      className={`v2-button${primary ? " v2-button-primary" : ""}`}
      disabled
      title="In der Vorschau deaktiviert: Es werden keine Änderungen gespeichert oder Nachrichten gesendet."
    >
      <Icon name="lock" size={15} />
      {children}
    </button>
  );
}
export function DefinitionList({ rows }) {
  return (
    <dl className="v2-definitions">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            {value == null || value === "" ? "Nicht hinterlegt" : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
