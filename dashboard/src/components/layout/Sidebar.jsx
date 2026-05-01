import React from "react";
import { ghostButtonStyle } from "../../theme/dashboardTheme";

export default function Sidebar({
  colors,
  section,
  navItems,
  onSectionChange,
  darkMode,
  onSetDarkMode,
  productName = "Funnel Pilot",
  adminName = "Jochen Kammerer",
  adminRole = "Admin",
}) {
  return (
    <aside
      style={{
        background: colors.sidebar,
        borderRight: `1px solid ${colors.border}`,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 20,
          }}
        >
          <span style={{ color: colors.accent }}>●</span>
          <span>{productName}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {navItems.map((item) => {
            const active = section === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSectionChange(item.key)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "11px 12px",
                  border: "none",
                  borderLeft: active
                    ? `2px solid ${colors.accent}`
                    : "2px solid transparent",
                  background: active ? colors.hover : "transparent",
                  color: colors.text,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div
          style={{
            borderTop: `1px solid ${colors.border}`,
            paddingTop: 12,
            marginTop: 12,
          }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => onSetDarkMode(false)}
              style={ghostButtonStyle(colors)}
              aria-pressed={!darkMode}
            >
              Hell
            </button>
            <button
              type="button"
              onClick={() => onSetDarkMode(true)}
              style={ghostButtonStyle(colors)}
              aria-pressed={darkMode}
            >
              Dunkel
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{adminName}</div>
              <div style={{ color: colors.sub, fontSize: 11 }}>{adminRole}</div>
            </div>

            <button type="button" style={ghostButtonStyle(colors)}>
              ⏻
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
