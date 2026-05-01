import React from "react";
import {
  primaryButtonStyle,
  secondaryButtonStyle,
  ghostButtonStyle,
} from "../theme/dashboardTheme";
import InfoHint from "../components/layout/common/InfoHint";
import FieldLabelWithInfo from "../components/layout/common/FieldLabelWithInfo";

function inputStyle(colors) {
  return {
    width: "100%",
    background: colors.panel,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
  };
}

function textareaStyle(colors) {
  return {
    ...inputStyle(colors),
    minHeight: 110,
    resize: "vertical",
    lineHeight: 1.45,
    fontFamily: "inherit",
  };
}

export default function SettingsGhostingPanel({
  colors,
  ghostingConfig,
  ghostingMessage = "",
  onGhostingSlotChange,
  onGhostingMessageChange,
  onAddGhostingSlot,
  onRemoveGhostingSlot,
  onSaveGhostingConfig,
  onReloadGhostingConfig,
  onResetGhostingConfig,
}) {
  const schedules = ghostingConfig?.schedules || [];
  const messages = ghostingConfig?.messages || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {ghostingMessage ? (
        <div
          style={{
            background: colors.panelSoft,
            border: `1px solid ${colors.border}`,
            padding: 12,
            fontSize: 12,
            color: colors.text,
          }}
        >
          {ghostingMessage}
        </div>
      ) : null}

      {schedules.length === 0 ? (
        <div
          style={{
            background: colors.panel,
            border: `1px solid ${colors.border}`,
            padding: 14,
            color: colors.sub,
            fontSize: 13,
          }}
        >
          Keine Ghosting-Slots geladen.
        </div>
      ) : null}

      {schedules.map((schedule, scheduleIndex) => (
        <div
          key={`cycle_${schedule.cycle}`}
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
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                Zyklus {schedule.cycle}
              </div>
              <div style={{ color: colors.sub, fontSize: 12, marginTop: 4 }}>
                Stages, Offset, Uhrzeiten und Texte für diesen Zyklus
              </div>
            </div>

            <button
              type="button"
              onClick={() => onAddGhostingSlot(scheduleIndex)}
              style={secondaryButtonStyle(colors)}
            >
              Slot hinzufügen
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px, 2fr) repeat(3, minmax(120px, 1fr)) auto",
              gap: 10,
              marginBottom: 10,
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: colors.sub,
                fontWeight: 700,
              }}
            >
              Stage
              <InfoHint
                title="Stage"
                text="Interner Name dieser Follow-up-Stufe. Hilft dem System zu erkennen, welche Nachricht gerade dran ist."
                placement="right"
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: colors.sub,
                fontWeight: 700,
              }}
            >
              Offset Stunden
              <InfoHint
                title="Offset Stunden"
                text="Wie viele Stunden nach der letzten relevanten Nachricht diese Follow-up-Stufe frühestens aktiv wird."
                placement="right"
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: colors.sub,
                fontWeight: 700,
              }}
            >
              Stunde
              <InfoHint
                title="Stunde"
                text="Zu dieser Uhrzeit darf die Nachricht vorbereitet oder gesendet werden."
                placement="right"
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: colors.sub,
                fontWeight: 700,
              }}
            >
              Minute
              <InfoHint
                title="Minute"
                text="Minute der geplanten Sendezeit."
                placement="right"
              />
            </div>

            <div
              style={{
                fontSize: 11,
                color: colors.sub,
                fontWeight: 700,
              }}
            >
              Aktion
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: colors.sub,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Nachricht
            <InfoHint
              title="Nachricht"
              text="Der Text, der als Follow-up vorbereitet oder gesendet wird."
              placement="right"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(schedule.slots || []).map((slot, slotIndex) => (
              <div
                key={`${slot.stage}_${slotIndex}`}
                style={{
                  border: `1px solid ${colors.border}`,
                  background: colors.panelSoft,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(220px, 2fr) repeat(3, minmax(120px, 1fr)) auto",
                    gap: 10,
                    alignItems: "end",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: colors.sub,
                        marginBottom: 6,
                        fontWeight: 700,
                      }}
                    >
                      Stage
                    </div>
                    <input
                      value={slot.stage || ""}
                      onChange={(event) =>
                        onGhostingSlotChange(
                          scheduleIndex,
                          slotIndex,
                          "stage",
                          event.target.value,
                        )
                      }
                      style={inputStyle(colors)}
                    />
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: colors.sub,
                        marginBottom: 6,
                        fontWeight: 700,
                      }}
                    >
                      Offset Stunden
                    </div>
                    <input
                      type="number"
                      value={slot.dayOffsetHours ?? 0}
                      onChange={(event) =>
                        onGhostingSlotChange(
                          scheduleIndex,
                          slotIndex,
                          "dayOffsetHours",
                          event.target.value,
                        )
                      }
                      style={inputStyle(colors)}
                    />
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: colors.sub,
                        marginBottom: 6,
                        fontWeight: 700,
                      }}
                    >
                      Stunde
                    </div>
                    <input
                      type="number"
                      value={slot.sendHour ?? 0}
                      onChange={(event) =>
                        onGhostingSlotChange(
                          scheduleIndex,
                          slotIndex,
                          "sendHour",
                          event.target.value,
                        )
                      }
                      style={inputStyle(colors)}
                    />
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: colors.sub,
                        marginBottom: 6,
                        fontWeight: 700,
                      }}
                    >
                      Minute
                    </div>
                    <input
                      type="number"
                      value={slot.sendMinute ?? 0}
                      onChange={(event) =>
                        onGhostingSlotChange(
                          scheduleIndex,
                          slotIndex,
                          "sendMinute",
                          event.target.value,
                        )
                      }
                      style={inputStyle(colors)}
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        onRemoveGhostingSlot(scheduleIndex, slotIndex)
                      }
                      style={ghostButtonStyle(colors)}
                    >
                      Löschen
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: colors.sub,
                      marginBottom: 6,
                      fontWeight: 700,
                    }}
                  >
                    Nachricht für {slot.stage || "ohne Stage"}
                  </div>
                  <textarea
                    value={messages[slot.stage] || ""}
                    onChange={(event) =>
                      onGhostingMessageChange(slot.stage, event.target.value)
                    }
                    style={textareaStyle(colors)}
                    placeholder="Ghosting-Text eingeben..."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onSaveGhostingConfig}
          style={primaryButtonStyle(colors)}
        >
          Ghosting speichern
        </button>

        <button
          type="button"
          onClick={onReloadGhostingConfig}
          style={secondaryButtonStyle(colors)}
        >
          Neu laden
        </button>

        <button
          type="button"
          onClick={onResetGhostingConfig}
          style={ghostButtonStyle(colors)}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
