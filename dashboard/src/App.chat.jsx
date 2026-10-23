import React, { useMemo, useRef, useState } from "react";
import { buildApiUrl } from "./services/apiBase";
import { describePeteReplySource } from "./utils/peteReplySource";

function makeTestLeadId() {
  return `lab_desktop_${Date.now()}_${Math.floor(Math.random() * 1000000000).toString(36)}`;
}

function getCurrentTime() {
  return new Date().toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLinkLabel(url) {
  const lower = String(url).toLowerCase();

  if (lower.includes("calendly.com")) {
    return "Strategiegespräch buchen";
  }

  if (lower.includes("calendar.google.com")) {
    return "Termin in Google Kalender speichern";
  }

  return url;
}

function renderTextWithLinks(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = String(text).split(urlRegex);

  return parts.map((part, index) => {
    const isUrl = /^https?:\/\/[^\s]+$/.test(part);

    if (isUrl) {
      return (
        <a
          key={`link_${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            marginTop: 6,
            color: "#2563eb",
            textDecoration: "underline",
            fontWeight: 600,
            wordBreak: "break-word",
          }}
        >
          {getLinkLabel(part)}
        </a>
      );
    }

    return <React.Fragment key={`text_${index}`}>{part}</React.Fragment>;
  });
}

function mapStateMessagesToUi(stateMessages = []) {
  return stateMessages.map((msg, index) => ({
    id: msg.id || `${msg.role}_${index}_${msg.createdAt || Date.now()}`,
    role: msg.role === "assistant" ? "bot" : msg.role,
    text: msg.text || "",
    syntheticAutomation: msg.syntheticAutomation === true || msg.transport === "lab_scripted_automation",
    time: msg.createdAt
      ? new Date(msg.createdAt).toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : getCurrentTime(),
  }));
}

export default function ChatTest() {
  const initialLeadRef = useRef(makeTestLeadId());

  const [leadId, setLeadId] = useState(initialLeadRef.current);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [debug, setDebug] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [entrySource, setEntrySource] = useState("instagram_dm");
  const [entryNotice, setEntryNotice] = useState("");

  const campaignId = "eltern-vital-fit";

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function startCampaignSimulation(keyword) {
    if (loading || refreshing) return;
    const nextLeadId = makeTestLeadId();
    setLeadId(nextLeadId);
    setMessages([]);
    setInput("");
    setEntryNotice("");
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/test-chat/simulate-entry"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: nextLeadId, keyword, source: entrySource }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Kampagnenstart fehlgeschlagen");
      setDebug(data);
      setMessages(mapStateMessagesToUi(data.state?.messages || []));
      setEntryNotice(`${entrySource === "instagram_reel_comment" ? "Reel-Kommentar" :
        entrySource === "instagram_story_reply" ? "Story-Antwort" : "Instagram-DM"} · ${keyword}: ${data.note}`);
    } catch (error) {
      setDebug({ error: error instanceof Error ? error.message : "Kampagnenstart fehlgeschlagen" });
      setEntryNotice("Simulation nicht gestartet. Prüfe lokalen Desktop-Modus und deaktivierte Meta-Sendeflags.");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      text,
      time: getCurrentTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(buildApiUrl("/test-chat/message"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          campaignId,
          messageText: text,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data;

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const rawText = await res.text();
        throw new Error(`Backend liefert kein JSON. Response: ${rawText.slice(0, 200)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || "Unbekannter Fehler");
      }

      setDebug(data);

      if (data?.state?.messages) {
        setMessages(mapStateMessagesToUi(data.state.messages));
      } else {
        const botMessage = {
          id: `bot_${Date.now()}`,
          role: "bot",
          text: data?.reply || "Keine Bot-Antwort erhalten.",
          time: getCurrentTime(),
        };

        setMessages((prev) => [...prev, botMessage]);
      }
    } catch (error) {
      const errorMessage = {
        id: `bot_error_${Date.now()}`,
        role: "bot",
        text: "Fehler beim Verbinden mit dem Backend.",
        time: getCurrentTime(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      setDebug({
        error: error instanceof Error ? error.message : "Backend nicht erreichbar",
      });
    } finally {
      setLoading(false);
    }
  }

  async function reloadChatState() {
    if (refreshing) return;

    setRefreshing(true);

    try {
      const res = await fetch(buildApiUrl(`/test-chat/state/${campaignId}/${leadId}`));
      const contentType = res.headers.get("content-type") || "";
      let data;

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const rawText = await res.text();
        throw new Error(`Backend liefert kein JSON. Response: ${rawText.slice(0, 200)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || "State konnte nicht geladen werden.");
      }

      setDebug(data);

      if (data?.state?.messages) {
        setMessages(mapStateMessagesToUi(data.state.messages));
      }
    } catch (error) {
      setDebug({
        error: error instanceof Error ? error.message : "State konnte nicht geladen werden",
      });
    } finally {
      setRefreshing(false);
    }
  }

  function resetTest() {
    const newLeadId = makeTestLeadId();
    setLeadId(newLeadId);
    setMessages([]);
    setInput("");
    setEntryNotice("");
    setDebug({
      info: "Neuer Testkontakt erstellt",
      leadId: newLeadId,
      campaignId,
    });
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1020",
        color: "#fff",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            fontSize: 32,
            marginBottom: 20,
          }}
        >
          Pete im Testchat
        </h1>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              background: "#111827",
              border: "1px solid #2a3348",
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 14,
              color: "#cbd5e1",
            }}
          >
            Testkontakt: <strong style={{ color: "#fff" }}>{leadId}</strong>
          </div>

          <div
            style={{
              background: "#111827",
              border: "1px solid #2a3348",
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 14,
              color: "#cbd5e1",
            }}
          >
            Kampagne: <strong style={{ color: "#fff" }}>{campaignId}</strong>
          </div>

          <button
            onClick={resetTest}
            type="button"
            style={{
              background: "#f59e0b",
              color: "#111",
              border: "none",
              borderRadius: 10,
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Neuer Testkontakt
          </button>

          <button
            onClick={reloadChatState}
            type="button"
            disabled={refreshing}
            style={{
              background: refreshing ? "#94a3b8" : "#22c55e",
              color: "#111",
              border: "none",
              borderRadius: 10,
              padding: "10px 14px",
              cursor: refreshing ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {refreshing ? "Lädt..." : "Chat neu laden"}
          </button>
        </div>

        <div style={{ background: "#111827", border: "1px solid #2a3348",
          borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            Kampagnenstart simulieren (nur Testdaten)
          </div>
          <div style={{ color: "#cbd5e1", fontSize: 13, marginBottom: 12 }}>
            CHECK, KETO oder BULLSHIT starten einen eigenen Testkontakt.
            Die erste Bot-Nachricht ist eine simulierte Kampagnen-Automatik, keine Pete-KI.
            Danach schreibst du frei mit Pete. Kein Meta-Versand.
          </div>
          <label htmlFor="pete-entry-source" style={{ fontSize: 13, marginRight: 8 }}>
            Herkunft:
          </label>
          <select id="pete-entry-source" value={entrySource}
            onChange={e => setEntrySource(e.target.value)}
            disabled={loading || refreshing}
            style={{ padding: 8, background: "#fff", color: "#111827", borderRadius: 6 }}>
            <option value="instagram_dm">Instagram-DM</option>
            <option value="instagram_story_reply">Story-Antwort</option>
            <option value="instagram_reel_comment">Reel-Kommentar (private Erstantwort)</option>
          </select>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {["CHECK", "KETO", "BULLSHIT"].map(keyword => (
              <button key={keyword} type="button" onClick={() => startCampaignSimulation(keyword)}
                disabled={loading || refreshing}
                style={{ padding: "10px 16px", borderRadius: 8, border: "none",
                  background: "#ff914d", color: "#111827", fontWeight: 700,
                  cursor: loading ? "wait" : "pointer" }}>
                {keyword}
              </button>
            ))}
          </div>
          {entryNotice && <p role="status" style={{ color: "#f8fafc", fontSize: 13,
            marginTop: 10, marginBottom: 0 }}>{entryNotice}</p>}
          {entrySource === "instagram_reel_comment" &&
            <p style={{ color: "#cbd5e1", fontSize: 12, marginTop: 8 }}>
              Ein Kommentar eröffnet noch kein reguläres DM-Nachrichtenfenster.
              Erst deine anschließende Antwort an Pete zählt als eingehende DM.
            </p>}
        </div>

        {debug?.replySource ? (
          <div
            role="status"
            style={{
              marginBottom: 12,
              background: "#111827",
              border: "1px solid #2a3348",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 13,
              color: "#e2e8f0",
            }}
          >
            <strong>Antwortquelle der letzten Nachricht:</strong>{" "}
            {describePeteReplySource(debug.replySource)}
          </div>
        ) : null}

        <div
          style={{
            background: "#ffffff",
            borderRadius: 20,
            minHeight: 420,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            overflowY: "auto",
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                color: "#999",
                textAlign: "center",
                marginTop: 40,
                fontSize: 22,
              }}
            >
              Noch keine Nachrichten.
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === "user";

              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: isUser ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "72%",
                      background: isUser ? "#d9fdd3" : "#f8fafc",
                      color: "#222",
                      border: "1px solid #e5e7eb",
                      borderRadius: 16,
                      padding: "14px 16px",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.45,
                      fontSize: 16,
                    }}
                  >
                    <strong>{isUser ? "Du" : msg.syntheticAutomation ? "Kampagnen-Automatik (Simulation)" : "Pete"}:</strong>{" "}
                    {isUser ? msg.text : renderTextWithLinks(msg.text)}
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                        color: "#6b7280",
                        textAlign: "center",
                      }}
                    >
                      {msg.time}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {(loading || refreshing) && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "72%",
                  background: "#f8fafc",
                  color: "#555",
                  border: "1px solid #e5e7eb",
                  borderRadius: 16,
                  padding: "14px 16px",
                  fontSize: 16,
                }}
              >
                <strong>Bot:</strong> {loading ? "schreibt..." : "lädt Chat..."}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 14,
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht eingeben..."
            style={{
              flex: 1,
              borderRadius: 12,
              border: "2px solid #d1d5db",
              padding: "14px 16px",
              fontSize: 16,
              outline: "none",
            }}
          />

          <button
            onClick={sendMessage}
            disabled={!canSend}
            type="button"
            style={{
              minWidth: 110,
              border: "none",
              borderRadius: 12,
              padding: "14px 18px",
              fontSize: 16,
              fontWeight: 700,
              cursor: canSend ? "pointer" : "not-allowed",
              background: canSend ? "#ffffff" : "#d1d5db",
              color: "#111827",
            }}
          >
            Senden
          </button>
        </div>

        <h3
          style={{
            textAlign: "center",
            marginTop: 26,
            marginBottom: 10,
            fontSize: 34,
          }}
        >
          Debug
        </h3>

        <pre
          style={{
            background: "#05070d",
            color: "#39ff14",
            padding: 18,
            borderRadius: 16,
            overflowX: "auto",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {debug ? JSON.stringify(debug, null, 2) : "Noch keine Response"}
        </pre>
      </div>
    </div>
  );
}
