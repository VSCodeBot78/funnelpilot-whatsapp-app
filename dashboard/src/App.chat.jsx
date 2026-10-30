import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildApiUrl } from "./services/apiBase";
import { describePeteReplySource } from "./utils/peteReplySource";
import { createPeteDesktopClient, desktopBlockReason, formatDesktopUsd } from "./services/peteDesktopLab";

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
  const desktopClient = useRef(null);
  desktopClient.current ??= createPeteDesktopClient();
  const [leadId, setLeadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [debug, setDebug] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [entrySource, setEntrySource] = useState("instagram_dm");
  const [entryNotice, setEntryNotice] = useState("");
  const [calendlyDiagnostic, setCalendlyDiagnostic] = useState(null);
  const [calendlyChecking, setCalendlyChecking] = useState(false);
  const [aiDiagnostic, setAiDiagnostic] = useState(null);
  const [aiChecking, setAiChecking] = useState(false);
  const [budgetChoice, setBudgetChoice] = useState("0.25");
  const [ownerManagedCostsAcknowledged, setOwnerManagedCostsAcknowledged] = useState(false);

  const campaignId = "eltern-vital-fit";

  const canSend = useMemo(() => Boolean(leadId) && input.trim().length > 0 && !loading && !aiChecking && !aiDiagnostic?.error,
    [leadId, input, loading, aiChecking, aiDiagnostic]);
  const budget = aiDiagnostic?.budget;
  const aiBlock = desktopBlockReason(aiDiagnostic, ownerManagedCostsAcknowledged);

  useEffect(() => {
    let cancelled = false;
    Promise.all([desktopClient.current.status(), desktopClient.current.newLead()])
      .then(([status, lead]) => {
        if (cancelled) return;
        setAiDiagnostic(status);
        setLeadId(lead.leadId);
      }).catch(error => { if (!cancelled) setAiDiagnostic({ error: error.message }); });
    return () => { cancelled = true; };
  }, []);

  async function startCampaignSimulation(keyword) {
    if (loading || refreshing) return;
    setMessages([]);
    setInput("");
    setEntryNotice("");
    setLoading(true);
    try {
      const data = await desktopClient.current.entry(keyword, entrySource);
      setLeadId(data.leadId);
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
    if (!text || !canSend) return;

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
      const data = await desktopClient.current.message(leadId, campaignId, text);
      setAiDiagnostic(previous => ({ ...previous, budget: data.budget }));

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
      checkPeteKiReadOnly();
    }
  }

  async function reloadChatState() {
    if (refreshing) return;

    setRefreshing(true);

    try {
      if (!leadId) return;
      const data = await desktopClient.current.state(leadId);

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

  async function checkCalendlyReadOnly() {
    if (calendlyChecking || loading) return;
    setCalendlyChecking(true);
    setCalendlyDiagnostic(null);
    try {
      const response = await fetch(buildApiUrl("/test-chat/calendly-readiness"), {
        method: "GET", headers: { Accept: "application/json" },
      });
      const body = await response.json();
      if (!response.ok || !body?.ok) {
        setCalendlyDiagnostic({ status: "test_mode_required",
          note: "Der sichere lokale Testmodus ist nicht nachgewiesen.",
          slots: [], bookingUrl: null });
      } else {
        setCalendlyDiagnostic(body);
      }
    } catch {
      setCalendlyDiagnostic({ status: "backend_unavailable",
        note: "Lokaler Backend-Testdienst nicht erreichbar.", slots: [], bookingUrl: null });
    } finally {
      setCalendlyChecking(false);
    }
  }

  async function checkPeteKiReadOnly() {
    if (aiChecking) return;
    setAiChecking(true);
    try {
      setAiDiagnostic(await desktopClient.current.status());
    } catch {
      setAiDiagnostic({ error: "Der lokale Backend-Status ist nicht erreichbar. Keine KI-Freigabe." });
    } finally {
      setAiChecking(false);
    }
  }

  async function togglePeteAi() {
    if (aiChecking) return;
    setAiChecking(true);
    try {
      const ownerManagedCosts = ownerManagedCostsAcknowledged && budget?.ownerManagedApprovalAvailable === true && !budget?.historyVerified;
      const data = await desktopClient.current.setBudget(budget?.enabled !== true, budgetChoice, ownerManagedCosts);
      setAiDiagnostic(previous => ({ ...previous, budget: data.budget }));
    } catch (error) {
      setAiDiagnostic(previous => ({ ...previous, ...(error.budget ? { budget: error.budget } : {}),
        error: budget?.enabled ? "KI-AUS nicht bestätigt. Status erneut prüfen oder lokalen Backenddienst schließen."
          : "KI-Freigabe nicht bestätigt. Status und Kostenbelege prüfen." }));
    } finally { setAiChecking(false); }
  }

  async function resetTest() {
    if (loading || refreshing) return;
    setRefreshing(true);
    try {
      const lead = await desktopClient.current.newLead();
      setLeadId(lead.leadId);
      setMessages([]);
      setInput("");
      setEntryNotice("");
      setDebug({ info: "Neuer serverseitiger Testkontakt. Budget unverändert.", leadId: lead.leadId, campaignId });
    } catch (error) { setDebug({ error: error.message }); }
    finally { setRefreshing(false); }
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

        <section aria-label="Pete-KI und dauerhaftes Testbudget" style={{
          background: "#111827", border: "1px solid #2a3348",
          borderRadius: 12, padding: 14, marginBottom: 14,
        }}>
          <strong>Echte Pete-KI im lokalen Labor: {!budget?.ok || aiDiagnostic?.error
            ? "Status nicht bestätigt" : budget.enabled ? "AN" : "AUS"}</strong>
          <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.5 }}>
            GPT-6.1 Sol. Nur für deine synthetischen Desktop-Testkontakte.
            „KI AN“ erlaubt kostenpflichtige Antworten bis zur gewählten Grenze.
            Neue Kontakte, AUS/AN und Neustarts setzen den Verbrauch nicht zurück.
            Nach einem Backend-Neustart bleibt die KI AUS.
          </p>
          <label htmlFor="pete-desktop-budget">Gesamtbudget dieser Testfreigabe: </label>
          <select id="pete-desktop-budget" value={budgetChoice}
            disabled={budget?.enabled || aiChecking || loading}
            onChange={event => setBudgetChoice(event.target.value)}
            style={{ color: "#111827", background: "#fff", padding: 8, borderRadius: 6 }}>
            {["0.25", "0.50", "1.00", "2.00"].map(amount =>
              <option key={amount} value={amount}>{amount} USD</option>)}
          </select>
          {!budget?.historyVerified && budget?.ownerManagedApprovalAvailable === true &&
            budget?.ownerManagedCosts !== true && !budget?.enabled && (
              <label style={{ display: "block", color: "#fff", fontSize: 13, marginTop: 12, marginBottom: 8, lineHeight: 1.55 }}>
                <input type="checkbox" checked={ownerManagedCostsAcknowledged}
                  onChange={event => setOwnerManagedCostsAcknowledged(event.target.checked)}
                  disabled={aiChecking || loading}
                  style={{ marginRight: 8 }} />
                Ich habe die tatsächlichen bisherigen OpenAI-Ausgaben eigenständig geprüft und
                übernehme die Verantwortung für nicht erfasste historische Kosten.
                Ich genehmige ausschließlich das oben gewählte zusätzliche,
                kumulativ begrenzte lokale Testbudget. Die historischen Mindestausgaben
                sind kein bestätigtes Kontoguthaben.
              </label>
            )}
          <button type="button" role="switch" aria-checked={budget?.enabled === true}
            onClick={togglePeteAi}
            disabled={aiChecking || (!budget?.enabled && (Boolean(aiBlock) || loading))}
            style={{ background: budget?.enabled ? "#fbbf24" : "#ff914d", color: "#111827",
              border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, margin: 8 }}>
            {budget?.enabled ? "KI AUS" : "KI AN (kostenpflichtig)"}
          </button>
          <button type="button" onClick={checkPeteKiReadOnly}
            disabled={aiChecking || loading}
            style={{ background: "#ff914d", color: "#111827", border: "none",
              borderRadius: 8, padding: "10px 14px", fontWeight: 700 }}>
            {aiChecking ? "Prüfe Pete-KI..." : "Pete-KI-Status prüfen (kostenlos)"}
          </button>
          {aiDiagnostic && <div role="status" style={{
            marginTop: 12, color: "#f8fafc", fontSize: 13, lineHeight: 1.5,
          }}>
            {aiBlock && <p style={{ color: "#fbbf24" }}>{aiBlock}</p>}
            {budget?.ownerManagedCosts && !budget.historyVerified && (
              <p style={{ color: "#fbbf24" }}>
                Historische Cloudkosten wurden nicht vollständig abgeglichen.
                Eigenverantwortlicher Budgetmodus aktiv, keine bestätigte Gesamtrestgrenze.
              </p>
            )}
            <div>Freigegeben: {formatDesktopUsd(budget?.authorizedUsd)}</div>
            <div>Verbrauch bestätigt: {formatDesktopUsd(budget?.confirmedUsd)}</div>
            <div>Reserviert oder noch ungeklärt: {formatDesktopUsd(budget?.reservedUsd)}</div>
            <div><strong>Für weitere API-Aufrufe verfügbar: {formatDesktopUsd(budget?.remainingUsd)}</strong></div>
            <div>Historisch im Projekt verbucht, mindestens: {formatDesktopUsd(budget?.knownHistoricalBookedUsd)}</div>
            <div>Rest im Projekt nach vollständigem Abgleich: {formatDesktopUsd(budget?.projectRemainingUsd)}</div>
            <p style={{ color: "#cbd5e1" }}>
              Interne USD-Kostenrechnung, kein OpenAI-Kontoguthaben.
              Ungeklärte Aufrufe bleiben reserviert. Meta- und WhatsApp-Versand bleiben AUS.
            </p>
          </div>}
        </section>

        <section aria-label="Calendly-Testdiagnose" style={{
          background: "#111827", border: "1px solid #2a3348",
          borderRadius: 12, padding: 14, marginBottom: 14,
        }}>
          <strong>Calendly: Verbindung und echte Termine prüfen</strong>
          <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.5 }}>
            Diagnose für dich als Betreiber. Nur lesender Kalenderzugriff, keine Buchung,
            kein Kundensend und keine Pete-KI-Antwort. Diese Anzeige ersetzt nicht
            den Terminvorschlag im Pete-Gespräch.
          </p>
          <button type="button" onClick={checkCalendlyReadOnly}
            disabled={calendlyChecking || loading}
            style={{ background: "#ff914d", border: "none", borderRadius: 8,
              padding: "10px 14px", fontWeight: 700,
              cursor: calendlyChecking || loading ? "wait" : "pointer" }}>
            {calendlyChecking ? "Prüfe Calendly..." : "Calendly jetzt lesen (kein Buchen)"}
          </button>
          {calendlyDiagnostic && <div role="status" style={{
            marginTop: 12, color: "#f8fafc", fontSize: 13, lineHeight: 1.5,
          }}>
            <div><strong>Status:</strong> {calendlyDiagnostic.status === "verified_slots"
              ? "Live-Slots von Calendly bestätigt" :
              calendlyDiagnostic.status === "credentials_missing"
                ? "Kein Calendly-Zugang in Funnel Pilot" :
              calendlyDiagnostic.status === "no_verified_slots"
                ? "Keine verifizierten freien Slots" :
              "Keine bestätigte Verbindung oder Verfügbarkeit"}</div>
            <p>{calendlyDiagnostic.note}</p>
            {calendlyDiagnostic.peteUsesCalendar === false && (
              <p style={{ color: "#fbbf24" }}>
                Achtung: Pete ist momentan NICHT auf Kalender als
                Verfügbarkeitsquelle eingestellt. Dieser API-Check ändert
                keine Einstellungen und ist kein bestandener Pete-Termintest.
              </p>
            )}
            {(calendlyDiagnostic.slots || []).length > 0 && (
              <ul style={{ margin: "8px 0", paddingLeft: 22 }}>
                {calendlyDiagnostic.slots.map((slot) => (
                  <li key={slot.startAt}>{slot.label}</li>
                ))}
              </ul>
            )}
            {calendlyDiagnostic.checkedAt &&
              <div style={{ color: "#aebbd2" }}>
                Zuletzt geprüft: {new Date(calendlyDiagnostic.checkedAt).toLocaleString("de-DE")}
              </div>}
            {calendlyDiagnostic.bookingUrl && (
              <a href={calendlyDiagnostic.bookingUrl} target="_blank" rel="noreferrer"
                style={{ color: "#93c5fd", display: "inline-block", marginTop: 8 }}>
                Buchungskalender ansehen (externer Link)
              </a>
            )}
          </div>}
        </section>

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
            {debug.replySource === "llm" && debug.providerUsage &&
              <div>Provider-Nutzung verbucht: {debug.providerUsage.inputTokens} Eingabe- und{" "}
                {debug.providerUsage.outputTokens} Ausgabetokens ({debug.providerUsage.model}).</div>}
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
