import React from "react";
import { inputStyle } from "../../theme/dashboardTheme";

export default function Topbar({
  colors,
  section,
  navItems,
  search,
  onSearchChange,
  subtitle = "Produktstruktur mit Sidebar, Topbar und getrennten Modulen",
  userInitial = "J",
}) {
  const activeLabel =
    navItems.find((n) => n.key === section)?.label || "Dashboard";

  return (
    <div
      style={{
        borderBottom: `1px solid ${colors.border}`,
        padding: "10px 16px",
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
          {activeLabel}
        </div>
        <div style={{ color: colors.sub, marginTop: 4, fontSize: 12 }}>
          {subtitle}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          placeholder="Suchen..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            ...inputStyle(colors),
            width: 280,
            maxWidth: "40vw",
          }}
        />
        <div
          style={{
            width: 34,
            height: 34,
            border: `1px solid ${colors.border}`,
            background: colors.panel,
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {userInitial}
        </div>
      </div>
    </div>
  );
}