import React, { useEffect, useState } from "react";
import { ghostButtonStyle } from "../../theme/dashboardTheme";
import { DAILY_NAV, ADMIN_NAV, isAdminSection } from "../../navigation/dashboardNavigation";

export default function Sidebar({
  colors,
  section,
  onSectionChange,
  onOpenTestChat = () => {},
  darkMode,
  onSetDarkMode,
  productName = "Funnel Pilot",
  adminName = "Jochen Kammerer",
  adminRole = "Admin",
}) {
  // Advanced sections are reachable without hiding the currently open page.
  const [showAdvanced, setShowAdvanced] = useState(() => isAdminSection(section));
  useEffect(() => {
    if (isAdminSection(section)) setShowAdvanced(true);
  }, [section]);
  const advancedOpen = showAdvanced;

  function navButton(item) {
    const active = section === item.key;
    return (
      <button
        key={item.key}
        className="fp-sidebar-link"
        type="button"
        aria-current={active ? "page" : undefined}
        onClick={() => onSectionChange(item.key)}
        style={{
          border: "none",
          borderLeft: active ? `3px solid ${colors.accent}` : "3px solid transparent",
          borderRadius: 8,
          background: active ? colors.hover : "transparent",
          color: colors.text,
          fontWeight: active ? 750 : 500,
        }}
      >
        {item.label}
      </button>
    );
  }

  return (
    <aside className="fp-sidebar" style={{
      background: colors.sidebar,
      borderRight: `1px solid ${colors.border}`,
      color: colors.text,
    }}>
      <div className="fp-sidebar-brand">
        <span style={{ color: colors.accent, fontSize: 23 }} aria-hidden="true">●</span>
        <span title={productName} className="fp-brand-name">{productName}</span>
      </div>

      <nav aria-label="Hauptnavigation" className="fp-sidebar-nav">
        <div className="fp-nav-caption" style={{ color: colors.sub }}>ARBEITSPLATZ</div>
        {DAILY_NAV.map(navButton)}
        <button
          type="button"
          className="fp-sidebar-link fp-sidebar-test"
          onClick={onOpenTestChat}
          style={{ color: colors.text, border: `1px solid ${colors.border}`,
            background: colors.panelSoft, borderRadius: 8, fontWeight: 700 }}
        >
          Pete testen <span style={{ fontWeight: 400, color: colors.sub }}>↗</span>
        </button>
        <button
          className="fp-sidebar-link fp-advanced-toggle"
          type="button"
          aria-controls="fp-advanced-navigation"
          aria-expanded={advancedOpen}
          onClick={() => setShowAdvanced(value => !value)}
          style={{ color: colors.sub, background: "transparent", border: "none",
            borderTop: `1px solid ${colors.border}` }}
        >
          Verwaltung & Einrichtung <span aria-hidden="true">{advancedOpen ? "⌃" : "⌄"}</span>
        </button>
        {advancedOpen && (
          <div id="fp-advanced-navigation" className="fp-advanced-navigation">
            {ADMIN_NAV.map(navButton)}
          </div>
        )}
      </nav>

      <div className="fp-sidebar-footer" style={{ borderTop: `1px solid ${colors.border}` }}>
        <div className="fp-theme-controls" role="group" aria-label="Darstellung">
          <button type="button" onClick={() => onSetDarkMode(false)}
            style={ghostButtonStyle(colors)} aria-pressed={!darkMode}>Hell</button>
          <button type="button" onClick={() => onSetDarkMode(true)}
            style={ghostButtonStyle(colors)} aria-pressed={darkMode}>Dunkel</button>
        </div>
        <div className="fp-operator">
          <strong>{adminName}</strong>
          <span style={{ color: colors.sub }}>{adminRole}</span>
        </div>
      </div>
    </aside>
  );
}
