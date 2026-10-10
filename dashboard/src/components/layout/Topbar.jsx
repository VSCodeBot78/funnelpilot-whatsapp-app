import React from "react";
import { inputStyle } from "../../theme/dashboardTheme";
import { getSectionLabel } from "../../navigation/dashboardNavigation";

export default function Topbar({
  colors,
  section,
  search,
  onSearchChange,
  userInitial = "J",
}) {
  const showSearch = section === "dashboard" || section === "leads";
  return (
    <header className="fp-topbar"
      style={{ borderBottom: `1px solid ${colors.border}` }}>
      <div>
        <div className="fp-topbar-title" style={{ color: colors.text }}>
          {getSectionLabel(section)}
        </div>
        <div style={{ color: colors.sub, marginTop: 4, fontSize: 12 }}>
          {section === "inbox" ? "Gespräche und persönliche Übernahme" :
           section === "dashboard" ? "Tagesübersicht · lokale Testumgebung" :
           "Funnel Pilot · Arbeitsbereich"}
        </div>
      </div>
      <div className="fp-topbar-tools">
        {showSearch && (
          <label className="fp-search-label" style={{ color: colors.sub }}>
            <span className="fp-sr-only">Leads durchsuchen</span>
            <input
              aria-label="Leads durchsuchen"
              placeholder="Leads durchsuchen …"
              value={search}
              onChange={event => onSearchChange(event.target.value)}
              style={{ ...inputStyle(colors), width: "100%", borderRadius: 8 }}
            />
          </label>
        )}
        <div className="fp-user-initial" aria-label="Angemeldeter Arbeitsbereich"
          style={{ border: `1px solid ${colors.border}`, background: colors.panel,
            color: colors.text }}>
          {userInitial}
        </div>
      </div>
    </header>
  );
}
