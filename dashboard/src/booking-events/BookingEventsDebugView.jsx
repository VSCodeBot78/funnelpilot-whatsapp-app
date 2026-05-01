import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getBookingEvents } from "../services/bookingEventsApi";
import InfoHint from "../components/layout/common/InfoHint";

const STATUS_LABELS = {
  processed: "Verarbeitet",
  ignored_duplicate: "Duplikat",
  failed: "Fehlgeschlagen",
};

const STATUS_COLORS = {
  processed: "#227C2A",
  ignored_duplicate: "#9366CC",
  failed: "#C0392B",
};

const FILTER_OPTIONS = [
  { value: "all", label: "Alle" },
  { value: "processed", label: "Verarbeitet" },
  { value: "ignored_duplicate", label: "Duplikat" },
  { value: "failed", label: "Fehlgeschlagen" },
];

export default function BookingEventsDebugView({ colors, apiBaseUrl }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState({});

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getBookingEvents(apiBaseUrl);
      setEvents(data.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    if (filter === "all") {
      return events;
    }

    return events.filter((event) => event.status === filter);
  }, [events, filter]);

  function togglePayload(id) {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  return (
    <div style={{ width: "100%", minHeight: 600 }}>
      <div
        style={{
          background: colors.panel,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: 18,
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          Booking Event Debug View
          <InfoHint
            title="Was zeigt diese Ansicht?"
            text="Hier sehen Sie, ob eingehende Booking-Events verarbeitet, als Duplikat erkannt oder mit Fehler abgelehnt wurden."
          />
        </div>
        <div style={{ color: colors.sub, lineHeight: 1.6, fontSize: 13 }}>
          Diese Ansicht zeigt eingehende Booking/Webhook Events. Sie hilft beim Prüfen,
          ob Calendly-/Provider-Events verarbeitet, ignoriert oder mit Fehler abgelehnt wurden.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={loadEvents}
          style={{
            padding: "10px 16px",
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text,
            cursor: "pointer",
            borderRadius: 8,
          }}
        >
          {loading ? "Lade..." : "Events neu laden"}
        </button>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: colors.sub, fontSize: 13 }}>Filter</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text,
            }}
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div style={{ color: colors.sub, fontSize: 13 }}>
          Zeige {filteredEvents.length} von {events.length} Events.
        </div>
      </div>

      {error ? (
        <div
          style={{
            padding: 14,
            background: "#ffe6e6",
            color: "#a70000",
            borderRadius: 10,
            border: "1px solid #f5c2c2",
          }}
        >
          Fehler beim Laden der Events: {error}
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 950,
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
              <th
                style={{
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Status
                <InfoHint
                  title="Status"
                  text="Zeigt, ob ein eingegangenes Booking-Event verarbeitet, als Duplikat erkannt oder mit Fehler abgelehnt wurde."
                  placement="top"
                />
              </th>
              <th style={{ padding: "10px 12px" }}>Provider</th>
              <th style={{ padding: "10px 12px" }}>EventType</th>
              <th style={{ padding: "10px 12px" }}>LeadId</th>
              <th style={{ padding: "10px 12px" }}>CampaignId</th>
              <th style={{ padding: "10px 12px" }}>ExternalBookingId</th>
              <th style={{ padding: "10px 12px" }}>CalendarEventId</th>
              <th style={{ padding: "10px 12px" }}>ReceivedAt</th>
              <th style={{ padding: "10px 12px" }}>ProcessedAt</th>
              <th style={{ padding: "10px 12px" }}>Error</th>
              <th style={{ padding: "10px 12px" }}>Raw</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((event) => (
              <React.Fragment key={event.id}>
                <tr
                  style={{
                    borderBottom: `1px solid ${colors.border}`,
                    background: colors.surface,
                  }}
                >
                  <td style={{ padding: "10px 12px", position: "relative", overflow: "visible" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: `${STATUS_COLORS[event.status] ?? colors.hover}22`,
                        color: STATUS_COLORS[event.status] ?? colors.text,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {STATUS_LABELS[event.status] ?? event.status}
                    {event.status === "processed" ? (
                      <InfoHint
                        title="Verarbeitet"
                        text="Das Event wurde erfolgreich verarbeitet und hat Lead oder Termin aktualisiert."
                        placement="right"
                      />
                    ) : event.status === "ignored_duplicate" ? (
                      <InfoHint
                        title="Duplikat"
                        text="Dieses Event kam schon einmal an. Es wurde erkannt und nicht erneut verarbeitet."
                        placement="right"
                      />
                    ) : event.status === "failed" ? (
                      <InfoHint
                        title="Fehler"
                        text="Das Event konnte nicht verarbeitet werden. Prüfe Fehlermeldung, Lead-ID oder Provider-Daten."
                        placement="right"
                      />
                    ) : null}
                  </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{event.provider}</td>
                  <td style={{ padding: "10px 12px" }}>{event.eventType}</td>
                  <td style={{ padding: "10px 12px" }}>{event.leadId || "-"}</td>
                  <td style={{ padding: "10px 12px" }}>{event.campaignId || "-"}</td>
                  <td style={{ padding: "10px 12px" }}>{event.externalBookingId || "-"}</td>
                  <td style={{ padding: "10px 12px" }}>{event.calendarEventId || "-"}</td>
                  <td style={{ padding: "10px 12px" }}>{event.receivedAt || "-"}</td>
                  <td style={{ padding: "10px 12px" }}>{event.processedAt || "-"}</td>
                  <td style={{ padding: "10px 12px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {event.error || "-"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {event.rawPayload ? (
                      <button
                        type="button"
                        onClick={() => togglePayload(event.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: `1px solid ${colors.border}`,
                          background: colors.surface,
                          color: colors.text,
                          cursor: "pointer",
                        }}
                      >
                        {expanded[event.id] ? "Ausblenden" : "Anzeigen"}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
                {expanded[event.id] ? (
                  <tr>
                    <td colSpan={11} style={{ padding: "12px 16px", background: colors.panel }}>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          fontFamily: "Menlo, Monaco, monospace",
                          fontSize: 12,
                          color: colors.text,
                        }}
                      >
                        {JSON.stringify(event.rawPayload, null, 2)}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            ))}
            {filteredEvents.length === 0 && (
              <tr>
                <td colSpan={11} style={{ padding: 20, color: colors.sub }}>
                  {loading ? "Lade Events..." : "Keine Events gefunden."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
