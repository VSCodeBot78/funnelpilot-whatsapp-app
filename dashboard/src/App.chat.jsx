import React, { useMemo, useRef, useState } from "react";

function makeTestLeadId() {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `lead_${rand}`;
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
    return "Termin final über Calendly eintragen";
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

  const backendMessageUrl = "http://localhost:3001/test-chat/message";
  const backendStateBaseUrl = "http://localhost:3001/test-chat/state";
  const campaignId = "eltern-vital-fit";

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

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
      const res = await fetch(backendMessageUrl, {
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
      const res = await fetch(`${backendStateBaseUrl}/${campaignId}/${leadId}`);
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
            fontSize: 56,
            marginBottom: 20,
          }}
        >
          WhatsApp Funnel Chat Test
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
                    <strong>{isUser ? "Du" : "Bot"}:</strong>{" "}
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
