import React from "react";
import {
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  ghostButtonStyle,
} from "../theme/dashboardTheme";

export default function LeadEditor({
  colors,
  leadForm,
  leadMessage,
  campaigns = [],
  onLeadFormChange,
  onCreateNewLead,
  onSaveLead,
  onDeleteLead,
}) {
  function updateField(key, value) {
    onLeadFormChange((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div
      style={{
        background: colors.panel,
        border: `1px solid ${colors.border}`,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14 }}>Lead bearbeiten</div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onCreateNewLead}
            style={primaryButtonStyle(colors)}
          >
            Lead manuell anlegen
          </button>
          <button type="button" style={ghostButtonStyle(colors)}>
            Leads importieren
          </button>
        </div>
      </div>

      {leadMessage ? (
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
          {leadMessage}
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
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
            Vorname
          </div>
          <input
            style={inputStyle(colors)}
            value={leadForm.name}
            onChange={(e) => updateField("name", e.target.value)}
          />
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
            Telefon
          </div>
          <input
            style={inputStyle(colors)}
            value={leadForm.phone}
            onChange={(e) => updateField("phone", e.target.value)}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
            Quelle
          </div>
          <input
            style={inputStyle(colors)}
            value={leadForm.source}
            onChange={(e) => updateField("source", e.target.value)}
          />
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
            Kampagne
          </div>
          <select
            style={inputStyle(colors)}
            value={leadForm.campaignId}
            onChange={(e) => updateField("campaignId", e.target.value)}
          >
            {campaigns.map((camp) => (
              <option key={camp.id} value={camp.id}>
                {camp.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
          Notiz
        </div>
        <textarea
          style={{ ...inputStyle(colors), minHeight: 110, resize: "vertical" }}
          value={leadForm.note}
          onChange={(e) => updateField("note", e.target.value)}
        />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
          <input
            type="checkbox"
            checked={leadForm.botEnabled}
            onChange={(e) => updateField("botEnabled", e.target.checked)}
          />
          Bot aktiv
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
          <input
            type="checkbox"
            checked={leadForm.excluded}
            onChange={(e) => updateField("excluded", e.target.checked)}
          />
          Kontakt ausschließen
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
          <input
            type="checkbox"
            checked={leadForm.booked}
            onChange={(e) => updateField("booked", e.target.checked)}
          />
          Termin gebucht
        </label>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
          Gebuchter Slot
        </div>
        <input
          style={inputStyle(colors)}
          value={leadForm.bookingData?.selectedSlot || ""}
          onChange={(e) =>
            onLeadFormChange((prev) => ({
              ...prev,
              bookingData: {
                ...(prev.bookingData || {}),
                selectedSlot: e.target.value,
              },
            }))
          }
        />
      </div>

      <div
        style={{
          borderTop: `1px solid ${colors.border}`,
          paddingTop: 12,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button type="button" onClick={onSaveLead} style={primaryButtonStyle(colors)}>
          Lead speichern
        </button>

        <button type="button" onClick={onDeleteLead} style={secondaryButtonStyle(colors)}>
          Lead löschen
        </button>
      </div>
    </div>
  );
}
