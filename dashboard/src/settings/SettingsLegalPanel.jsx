import React from "react";
import { inputStyle } from "../theme/dashboardTheme";
import FieldLabelWithInfo from "../components/layout/common/FieldLabelWithInfo";
import InfoHint from "../components/layout/common/InfoHint";

function isInvalidOptionalUrl(value) {
  const url = String(value || "").trim();
  return Boolean(url) && !url.startsWith("http://") && !url.startsWith("https://");
}

export default function SettingsLegalPanel({
  colors,
  settings = {},
  onSettingsChange = () => {},
}) {
  const safeSettings = {
    privacyPolicyUrl: "",
    imprintUrl: "",
    ...settings,
  };

  const privacyInvalid = isInvalidOptionalUrl(safeSettings.privacyPolicyUrl);
  const imprintInvalid = isInvalidOptionalUrl(safeSettings.imprintUrl);

  function updateField(key, value) {
    onSettingsChange((prev) => ({ ...(prev || {}), [key]: value }));
  }

  function legalInputStyle(invalid) {
    return {
      ...inputStyle(colors),
      border: invalid ? `1px solid ${colors.warning}` : inputStyle(colors).border,
    };
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
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>Rechtliches</div>
        <InfoHint
          title="Rechtliches"
          text="Diese Angaben dienen der Betreiberzuordnung und sollten vor produktiver Nutzung vollständig sein."
        />
      </div>

      <div style={{ padding: 14 }}>
        <div style={{ color: colors.sub, fontSize: 12, lineHeight: 1.5 }}>
          Diese Links gehören zum jeweiligen Betreiber dieses FunnelPilot-Systems.
          Wenn FunnelPilot später für andere Nutzer verwendet wird, müssen diese
          ihre eigenen rechtlichen Links hinterlegen.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          <div>
            <FieldLabelWithInfo
              label="Datenschutzerklärung URL"
              title="Datenschutzerklärung URL"
              text="Link zur Datenschutzerklärung des jeweiligen Betreibers. Für externe Nutzer muss hier deren eigene Datenschutzerklärung hinterlegt werden."
            />
            <input
              style={legalInputStyle(privacyInvalid)}
              value={safeSettings.privacyPolicyUrl}
              onChange={(event) =>
                updateField("privacyPolicyUrl", event.target.value)
              }
              placeholder="https://..."
            />
            {privacyInvalid ? (
              <div style={{ color: colors.warning, fontSize: 11, marginTop: 6 }}>
                Muss leer sein oder mit http:// bzw. https:// beginnen.
              </div>
            ) : null}
          </div>

          <div>
            <FieldLabelWithInfo
              label="Impressum URL"
              title="Impressum URL"
              text="Link zum Impressum des jeweiligen Betreibers. Für externe Nutzer muss hier deren eigenes Impressum hinterlegt werden."
            />
            <input
              style={legalInputStyle(imprintInvalid)}
              value={safeSettings.imprintUrl}
              onChange={(event) =>
                updateField("imprintUrl", event.target.value)
              }
              placeholder="https://..."
            />
            {imprintInvalid ? (
              <div style={{ color: colors.warning, fontSize: 11, marginTop: 6 }}>
                Muss leer sein oder mit http:// bzw. https:// beginnen.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
