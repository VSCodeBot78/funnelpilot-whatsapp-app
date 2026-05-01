import React from "react";
import { inputStyle } from "../theme/dashboardTheme";

export default function SettingsGeneralPanel({
  colors,
  settings = {},
  onSettingsChange = () => {},
}) {
  const safeSettings = {
    productName: "",
    adminName: "",
    adminRole: "",
    defaultTheme: "dark",
    brandHint: "",
    topbarSubtitle: "",
    footerText: "",
    ...settings,
  };

  function updateField(key, value) {
    onSettingsChange((prev) => ({ ...(prev || {}), [key]: value }));
  }

  return (
    <div
      style={{
        background: colors.panel,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${colors.border}`,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Allgemein
      </div>

      <div style={{ padding: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
              Produktname
            </div>
            <input
              style={inputStyle(colors)}
              value={safeSettings.productName}
              onChange={(e) => updateField("productName", e.target.value)}
            />
          </div>

          <div>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
              Admin-Name
            </div>
            <input
              style={inputStyle(colors)}
              value={safeSettings.adminName}
              onChange={(e) => updateField("adminName", e.target.value)}
            />
          </div>

          <div>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
              Rolle
            </div>
            <input
              style={inputStyle(colors)}
              value={safeSettings.adminRole}
              onChange={(e) => updateField("adminRole", e.target.value)}
            />
          </div>

          <div>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
              Standard Theme
            </div>
            <select
              style={inputStyle(colors)}
              value={safeSettings.defaultTheme}
              onChange={(e) => updateField("defaultTheme", e.target.value)}
            >
              <option value="dark">dark</option>
              <option value="light">light</option>
              <option value="system">system</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
            Logo / Brand-Hinweis
          </div>
          <input
            style={inputStyle(colors)}
            value={safeSettings.brandHint}
            onChange={(e) => updateField("brandHint", e.target.value)}
            placeholder="z. B. Funnel Pilot / White Label später"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
            Topbar-Subtitle
          </div>
          <input
            style={inputStyle(colors)}
            value={safeSettings.topbarSubtitle}
            onChange={(e) => updateField("topbarSubtitle", e.target.value)}
            placeholder="z. B. Produktstruktur mit Sidebar, Topbar und getrennten Modulen"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
            Footer-Text
          </div>
          <input
            style={inputStyle(colors)}
            value={safeSettings.footerText}
            onChange={(e) => updateField("footerText", e.target.value)}
            placeholder="z. B. copyright Jochen Kammerer"
          />
        </div>
      </div>
    </div>
  );
}
