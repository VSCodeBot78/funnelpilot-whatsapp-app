import React from "react";
import {
  inputStyle,
  primaryButtonStyle,
  ghostButtonStyle,
} from "../theme/dashboardTheme";
import InfoHint from "../components/layout/common/InfoHint";
import {
  AVAILABILITY_DAY_KEYS,
  AVAILABILITY_DAY_LABELS,
} from "../utils/dashboardHelpers";

export default function AvailabilityPanel({
  colors,
  availabilityForm,
  availabilityLoading,
  availabilitySaving,
  availabilityMessage,
  onAvailabilityFormChange,
  onReload,
  onSave,
  onReset,
}) {
  function updateField(key, value) {
    onAvailabilityFormChange((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateWeeklySlot(dayKey, value) {
    onAvailabilityFormChange((prev) => ({
      ...prev,
      weeklySlotsText: {
        ...prev.weeklySlotsText,
        [dayKey]: value,
      },
    }));
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
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14 }}>Slots / Availability</div>
        <button
          type="button"
          onClick={onReload}
          disabled={availabilityLoading || availabilitySaving}
          style={ghostButtonStyle(colors)}
        >
          {availabilityLoading ? "Lädt..." : "Neu laden"}
        </button>
      </div>

      <div style={{ padding: 14 }}>
        <div style={{ color: colors.sub, fontSize: 12, marginBottom: 12 }}>
          Hier steuerst du jetzt die echte Backend-Slot-Quelle.
        </div>

        {availabilityMessage ? (
          <div
            style={{
              marginBottom: 12,
              padding: 10,
              border: `1px solid ${colors.border}`,
              background: colors.panelSoft,
              color: colors.text,
              fontSize: 12,
            }}
          >
            {availabilityMessage}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 12 }}>
                Source Mode
              </div>
              <InfoHint
                title="Source Mode"
                text="Wählt die Slot-Quelle: static, dashboard oder calendar. So steuert das System, woher Termine geladen werden."
                placement="right"
              />
            </div>
            <select
              style={inputStyle(colors)}
              value={availabilityForm.sourceMode}
              onChange={(e) => updateField("sourceMode", e.target.value)}
            >
              <option value="static">static</option>
              <option value="dashboard">dashboard</option>
              <option value="calendar">calendar</option>
            </select>
          </div>

          <div>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
              Max. Vorschläge
            </div>
            <input
              type="number"
              min="1"
              max="10"
              style={inputStyle(colors)}
              value={availabilityForm.maxSuggestions}
              onChange={(e) => updateField("maxSuggestions", e.target.value)}
            />
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${colors.border}`,
            background: colors.panelSoft,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10 }}>
            Wochenslots
          </div>
          <div style={{ color: colors.sub, fontSize: 11, marginBottom: 12 }}>
            Format: Zeiten komma getrennt, z. B. 09:00, 10:00, 14:30
          </div>

          {AVAILABILITY_DAY_KEYS.map((dayKey) => (
            <div key={dayKey} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                {AVAILABILITY_DAY_LABELS[dayKey]}
              </div>
              <input
                style={inputStyle(colors)}
                value={availabilityForm.weeklySlotsText[dayKey]}
                onChange={(e) => updateWeeklySlot(dayKey, e.target.value)}
                placeholder="z. B. 09:00, 10:00, 11:00"
              />
            </div>
          ))}
        </div>

        <div style={{ color: colors.sub, fontSize: 11, marginBottom: 12 }}>
          Letztes Update:{" "}
          {availabilityForm.updatedAt
            ? new Date(availabilityForm.updatedAt).toLocaleString("de-DE")
            : "-"}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onSave}
            disabled={availabilitySaving || availabilityLoading}
            style={primaryButtonStyle(colors)}
          >
            {availabilitySaving ? "Speichert..." : "Slots speichern"}
          </button>

          <button
            type="button"
            onClick={onReset}
            disabled={availabilitySaving || availabilityLoading}
            style={ghostButtonStyle(colors)}
          >
            Reset auf Standard
          </button>
        </div>
      </div>
    </div>
  );
}
