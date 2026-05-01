import React from "react";
import {
  primaryButtonStyle,
  secondaryButtonStyle,
  ghostButtonStyle,
} from "../theme/dashboardTheme";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStageLabel(stage) {
  const map = {
    inactive: "Inaktiv",
    dead: "Lead tot",
    cycle1_day1_0700: "Zyklus 1 · Tag 1 · morgens 07:00",
    cycle1_day1_1400: "Zyklus 1 · Tag 1 · mittags 14:00",
    cycle1_day1_2100: "Zyklus 1 · Tag 1 · abends 21:00",
    cycle2_day2_0900: "Zyklus 2 · Tag 2 · morgens 09:00",
    cycle2_day2_1800: "Zyklus 2 · Tag 2 · abends 18:00",
    cycle3_day3_1700: "Zyklus 3 · Tag 3 · 17:00",
  };
  return map[stage] || stage || "-";
}

function getSlotHumanLabel(slot) {
  return `Tag ${Math.floor((slot.dayOffsetHours || 0) / 24)} · ${String(
    slot.sendHour,
  ).padStart(2, "0")}:${String(slot.sendMinute).padStart(2, "0")}`;
}

function getStatusLabel(row) {
  if (!row.hasState) return "Kein Backend-State";
  if (row.isDead) return "Tot";
  if (row.dueNow) return "Jetzt fällig";
  if (row.active) return "Aktiv";
  return "Inaktiv";
}

function getStatusColor(row, colors) {
  if (!row.hasState) return colors.sub;
  if (row.isDead) return colors.warning;
  if (row.dueNow) return colors.success;
  if (row.active) return colors.text;
  return colors.sub;
}

function getActionReason(row) {
  if (!row.hasState) return "Kein echter Conversation State im Backend.";
  if (row.isDead) return "Lead ist im Ghosting bereits als tot markiert.";
  if (!row.dueNow) return "Aktuell ist noch keine Ghosting-Nachricht fällig.";
  return "";
}

export default function GhostingView({
  colors,
  schedules = [],
  rows = [],
  loading = false,
  message = "",
  onReload,
  onSendDue,
  onMarkSent,
  onOpenLead,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          background: colors.panel,
          border: `1px solid ${colors.border}`,
          padding: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Ghosting</div>
          <div style={{ color: colors.sub, fontSize: 12, marginTop: 4 }}>
            Echte Preview- und Sendelogik aus dem Backend. Die Tabelle zeigt klar, was fällig ist und warum etwas nicht ausführbar ist.
          </div>
        </div>
        <button type="button" onClick={onReload} style={ghostButtonStyle(colors)}>
          {loading ? "Lädt..." : "Neu laden"}
        </button>
      </div>

      {message ? (
        <div
          style={{
            background: colors.panelSoft,
            border: `1px solid ${colors.border}`,
            padding: 12,
            fontSize: 12,
            color: colors.text,
          }}
        >
          {message}
        </div>
      ) : null}

      <div
        style={{
          background: colors.panel,
          border: `1px solid ${colors.border}`,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
          Ghosting-Zyklen
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {schedules.map((schedule) => (
            <div
              key={schedule.cycle}
              style={{
                border: `1px solid ${colors.border}`,
                background: colors.panelSoft,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                Zyklus {schedule.cycle}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(schedule.slots || []).map((slot) => (
                  <div
                    key={slot.stage}
                    style={{
                      border: `1px solid ${colors.border}`,
                      background: colors.panel,
                      padding: 10,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 12 }}>
                      {getStageLabel(slot.stage)}
                    </div>
                    <div style={{ color: colors.sub, fontSize: 11, marginTop: 4 }}>
                      {getSlotHumanLabel(slot)} · Offset {slot.dayOffsetHours}h
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

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
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Lead-Preview</div>
            <div style={{ color: colors.sub, fontSize: 12, marginTop: 4 }}>
              Nur Leads mit echtem Backend-State sind vollständig ausführbar.
            </div>
          </div>
          <div style={{ color: colors.sub, fontSize: 12 }}>{rows.length} Leads geprüft</div>
        </div>

        {rows.length === 0 ? (
          <div
            style={{
              padding: 18,
              color: colors.sub,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Noch keine Ghosting-Daten geladen.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 1380,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: colors.panelSoft,
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  {[
                    "Lead",
                    "Kampagne",
                    "Status",
                    "Zyklus",
                    "Aktuelle Stufe",
                    "Nächste Fälligkeit",
                    "Letzte Bot-Nachricht",
                    "Letzte User-Nachricht",
                    "Nachrichtenvorschau",
                    "Hinweis",
                    "Aktionen",
                  ].map((label) => (
                    <th
                      key={label}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: colors.sub,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const actionReason = getActionReason(row);
                  const canExecute = row.hasState && row.dueNow && !row.isDead;
                  const stableKey = `${row.campaignId || "no_campaign"}_${row.leadId || row.contactId || index}_${index}`;

                  return (
                    <tr
                      key={stableKey}
                      style={{
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      <td style={{ padding: 12, verticalAlign: "top" }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{row.name}</div>
                        <div style={{ color: colors.sub, fontSize: 11, marginTop: 4 }}>
                          {row.phone}
                        </div>
                      </td>
                      <td style={{ padding: 12, verticalAlign: "top", fontSize: 12 }}>
                        {row.campaignName}
                      </td>
                      <td style={{ padding: 12, verticalAlign: "top" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 8px",
                            border: `1px solid ${colors.border}`,
                            background: colors.panelSoft,
                            fontSize: 11,
                            fontWeight: 700,
                            color: getStatusColor(row, colors),
                          }}
                        >
                          {getStatusLabel(row)}
                        </span>
                      </td>
                      <td style={{ padding: 12, verticalAlign: "top", fontSize: 12 }}>
                        {row.hasState ? row.cycle : "-"}
                      </td>
                      <td style={{ padding: 12, verticalAlign: "top", fontSize: 12 }}>
                        {row.hasState ? getStageLabel(row.stage) : "-"}
                      </td>
                      <td style={{ padding: 12, verticalAlign: "top", fontSize: 12 }}>
                        {row.hasState ? formatDateTime(row.nextDueAt) : "-"}
                      </td>
                      <td style={{ padding: 12, verticalAlign: "top", fontSize: 12 }}>
                        {formatDateTime(row.lastAssistantMessageAt)}
                      </td>
                      <td style={{ padding: 12, verticalAlign: "top", fontSize: 12 }}>
                        {formatDateTime(row.lastUserMessageAt)}
                      </td>
                      <td
                        style={{
                          padding: 12,
                          verticalAlign: "top",
                          fontSize: 12,
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                          minWidth: 260,
                        }}
                      >
                        {row.messagePreview || "-"}
                      </td>
                      <td
                        style={{
                          padding: 12,
                          verticalAlign: "top",
                          fontSize: 12,
                          color: colors.sub,
                          lineHeight: 1.5,
                          minWidth: 260,
                        }}
                      >
                        {row.reason || actionReason || "-"}
                      </td>
                      <td style={{ padding: 12, verticalAlign: "top" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => onOpenLead(row.contactId)}
                            style={secondaryButtonStyle(colors)}
                          >
                            Lead öffnen
                          </button>
                          <button
                            type="button"
                            onClick={() => onSendDue(row)}
                            disabled={!canExecute}
                            title={actionReason}
                            style={primaryButtonStyle(colors)}
                          >
                            Jetzt senden
                          </button>
                          <button
                            type="button"
                            onClick={() => onMarkSent(row)}
                            disabled={!canExecute}
                            title={actionReason}
                            style={ghostButtonStyle(colors)}
                          >
                            Als gesendet markieren
                          </button>
                        </div>
                        {!canExecute && actionReason ? (
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 11,
                              color: colors.sub,
                              lineHeight: 1.4,
                              maxWidth: 220,
                            }}
                          >
                            {actionReason}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
