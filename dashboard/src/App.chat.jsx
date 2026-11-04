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

/** Only server-allowlisted, secret-free diagnostics are displayed. */
function explainLocalLlmDiagnostic(value) {
  if (!value || typeof value !== "object") return "Ursache noch nicht ermittelt.";
  const detail = value.detail;
  const reason = value.reason;
  if (typeof detail === "string" && /^http_[1-5][0-9]{2}$/.test(detail)) {
    const status = Number(detail.slice(5));
    if (status === 401) return "OpenAI HTTP 401: Schlüssel oder Authentifizierung abgelehnt.";
    if (status === 403) return "OpenAI HTTP 403: Projekt- oder Modellzugriff verweigert.";
    if (status === 404) return "OpenAI HTTP 404: angefordertes Modell oder Endpunkt nicht gefunden.";
    if (status === 429) return "OpenAI HTTP 429: Kontingent, Abrechnungsgrenze oder Anfragelimit.";
    if (status >= 500) return "OpenAI HTTP " + status + ": Anbieterfehler.";
    return "OpenAI HTTP " + status + ": Anfrage wurde abgelehnt.";
  }
  if (detail === "request_timeout") return "Zeitüberschreitung bei der Anbieteranfrage.";
  if (detail === "network_error") return "Netzwerk-/Verbindungsfehler zum Anbieter.";
  if (detail === "provider_processing_error") return "Anbieterantwort konnte technisch nicht verarbeitet werden.";
  if (detail === "provider_usage_unverified") return "Anbieterantwort ohne überprüfbare Token-Nutzung.";
  if (detail === "invalid_json" || detail === "no_output_text") return "Modellantwort hat kein gültiges Antwortformat.";
  if (typeof detail === "string" && detail.startsWith("response_incomplete_"))
    return "Modellantwort unvollständig.";
  if (reason === "model_handoff") return "Das Modell hat selbst eine menschliche Prüfung verlangt.";
  if (reason === "invalid_output") return "Antwort durch die Sicherheits- oder Formatprüfung abgewiesen.";
  if (reason === "budget_unavailable" || reason === "budget_exhausted")
    return "Bisherige lokale Budget-/Verbrauchsprüfung hat den Aufruf blockiert.";
  if (reason === "not_authorized") return "Lokale KI-Freigabe oder Konfiguration nicht bestätigt.";
  return "Ursache noch nicht ermittelt. Keine erfolgreiche KI-Antwort.";
}

function describeProviderConnection(result) {
  if (!result) return "";
  if (result.result === "model_visible")
    return "OpenAI erreichbar: Schlüssel akzeptiert und GPT-6.1 Sol sichtbar. Dies ist noch kein KI-Antworttest.";
  if (result.result === "not_configured")
    return "Lokaler OpenAI-Schlüssel oder Modellkonfiguration fehlt.";
  if (result.result === "timeout") return "OpenAI-Verbindungsprüfung: Zeitüberschreitung.";
  if (result.result === "connection_error") return "OpenAI-Verbindungsprüfung: Netzwerkfehler.";
  if (result.result === "http_error") {
    const status = result.httpStatus;
    if (status === 401) return "OpenAI HTTP 401: API-Schlüssel abgelehnt.";
    if (status === 403) return "OpenAI HTTP 403: Berechtigung für Projekt oder Modell fehlt.";
    if (status === 404) return "OpenAI HTTP 404: Modell nicht sichtbar.";
    if (status === 429) return "OpenAI HTTP 429: API-Limit oder Kontingent erreicht.";
    return "OpenAI HTTP " + status + ": Zugriff nicht erfolgreich.";
  }
  return "OpenAI-Verbindungsprüfung ohne bestätigtes Ergebnis.";
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
    actor: msg.actor || null,
    manualOwnerGreeting: msg.role === "assistant" && msg.actor === "human" && msg.syntheticAutomation !== true,
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

export default function ChatTest({ v2 = false }) {
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
  const [noSendFlow, setNoSendFlow] = useState(null);
  const [calendlyDiagnostic, setCalendlyDiagnostic] = useState(null);
  const [calendlyChecking, setCalendlyChecking] = useState(false);
  const [aiDiagnostic, setAiDiagnostic] = useState(null);
  const [aiChecking, setAiChecking] = useState(false);
  const [providerCheck, setProviderCheck] = useState(null);
  const [providerChecking, setProviderChecking] = useState(false);

  const campaignId = "eltern-vital-fit";

  const budget = aiDiagnostic?.budget;
  const aiBlock = desktopBlockReason(aiDiagnostic);
  const frontendBuildSha = import.meta.env.VITE_FP_BUILD_SHA || null;
  const backendBuildSha = aiDiagnostic?.buildSha || null;
  const versionVerified = Boolean(frontendBuildSha && backendBuildSha &&
    frontendBuildSha === backendBuildSha);
  const buildMismatch = Boolean(frontendBuildSha && backendBuildSha &&
    frontendBuildSha !== backendBuildSha);
  // Local chats may remain available without a marker for free manual tests.
  // Paid KI must NEVER activate without proven matching backend/frontend SHAs.
  const canSend = useMemo(() => Boolean(leadId) && input.trim().length > 0 &&
    !loading && !aiChecking && !aiDiagnostic?.error && !buildMismatch,
    [leadId, input, loading, aiChecking, aiDiagnostic, buildMismatch]);

  useEffect(() => {
    let cancelled = false;
    // Reopen the authenticated session's last synthetic lead; never create a
    // new one just because the owner navigates away and returns.
    Promise.all([desktopClient.current.status(), desktopClient.current.active()])
      .then(async ([status, active]) => {
        if (cancelled) return;
        const lead = active.leadId ? active : await desktopClient.current.newLead();
        if (cancelled) return;
        setAiDiagnostic(status);
        setLeadId(lead.leadId);
        if (active.leadId) {
          setMessages(mapStateMessagesToUi(active.state?.messages || []));
          setNoSendFlow(active.flow || null);
          setDebug({ replySource: active.replySource,
            llmDiagnostic: active.llmDiagnostic,
            replySuppressedReason: active.replySuppressedReason });
        }
      }).catch(error => { if (!cancelled) setAiDiagnostic({ error: error.message }); });
    return () => { cancelled = true; };
  }, []);

  async function startCampaignSimulation(keyword) {
    if (loading || refreshing) return;
    setMessages([]);
    setInput("");
    setEntryNotice("");
    setNoSendFlow(null);
    setLoading(true);
    try {
      // Manual follower welcomes are prewritten by Jochen, never triggered by
      // a reel comment, story or an automated new-follower event.
      const manualWelcome = keyword === "WELCOME_1" || keyword === "WELCOME_2";
      const source = manualWelcome ? "instagram_dm" : entrySource;
      const data = await desktopClient.current.entry(keyword, source);
      setLeadId(data.leadId);
      setDebug(data);
      setNoSendFlow(data.flow || null);
      setMessages(mapStateMessagesToUi(data.state?.messages || []));
      setEntryNotice(manualWelcome
        ? `Manuelle Follower-Begrüßung ${keyword === "WELCOME_1" ? "1" : "2"} (nur Simulation). Antworte jetzt frei als Follower. Kein echter Versand.`
        : `${source === "instagram_reel_comment" ? "Reel-Kommentar" :
          source === "instagram_story_reply" ? "Story-Antwort" : "Instagram-DM"} · ${keyword}: ${data.note}`);
    } catch (error) {
      setDebug({ error: error instanceof Error ? error.message : "Kampagnenstart fehlgeschlagen" });
      setEntryNotice("Simulation nicht gestartet. Prüfe lokalen Desktop-Modus und deaktivierte Meta-Sendeflags.");
    } finally {
      setLoading(false);
    }
  }

  async function simulateFlowAction(action) {
    if (!leadId || loading || refreshing || !noSendFlow) return;
    setLoading(true);
    try {
      const result = await desktopClient.current.flowAction(leadId, action);
      setNoSendFlow(result.flow || null);
      setMessages(mapStateMessagesToUi(result.state?.messages || []));
      setEntryNotice(result.flow?.stage === "pete_ready"
        ? "NoSend-Flow fertig: Pete ist für die nächste echte Test-Eingabe freigegeben."
        : "NoSend-Schritt ausgeführt. Kein Meta-Versand und keine KI-Kosten.");
    } catch (error) {
      setEntryNotice("Flow-Schritt blockiert oder bereits verarbeitet. " +
        (error instanceof Error ? error.message : "Status prüfen."));
      try {
        const state = await desktopClient.current.state(leadId);
        setNoSendFlow(state.flow || null);
        setMessages(mapStateMessagesToUi(state.state?.messages || []));
      } catch { /* Continue to show the last verified state. */ }
    } finally { setLoading(false); }
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
      setNoSendFlow(data.flow || null);
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

  async function checkOpenAiProvider() {
    if (providerChecking || loading) return;
    setProviderChecking(true);
    setProviderCheck(null);
    try {
      const result = await desktopClient.current.checkProvider();
      setProviderCheck(result);
    } catch {
      setProviderCheck({ result: "connection_error" });
    } finally {
      setProviderChecking(false);
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
      const data = await desktopClient.current.setBudget(budget?.enabled !== true);
      setAiDiagnostic(previous => ({ ...previous, error: undefined, budget: data.budget }));
    } catch (error) {
      setAiDiagnostic(previous => ({ ...previous, ...(error.budget ? { budget: error.budget } : {}),
        error: budget?.enabled ? "KI-AUS nicht bestätigt. Status erneut prüfen oder lokalen Backenddienst schließen."
          : "KI-Freigabe nicht bestätigt. Lokalen Status und Kostenprotokoll prüfen." }));
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
      setNoSendFlow(null);
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
    <section className={v2 ? "v2-native-page v2-native-lab" : undefined}
      style={v2 ? { minHeight: 0, background: "var(--surface)", color: "var(--text)", padding: 0 } : {
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
        {v2 ? <header className="v2-native-section-head">
          <div><span className="v2-eyebrow">PETE DESKTOP-LABOR</span>
            <h2>Pete im Testchat</h2>
            <p>Manuelle Follower-Begrüßungen, Keywords und freie Antworten. Kein Meta-Live-Versand.</p></div>
          <span className="v2-native-counter">NoSend</span>
        </header> : <h1 style={{ textAlign: "center", fontSize: 32, marginBottom: 20 }}>Pete im Testchat</h1>}

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
            Bei gespeichertem V2-Flow erst Button und Link im NoSend-Labor durchspielen.
            Pete übernimmt nur bei aktiviertem Handoff nach diesen Schritten. Kein Meta-Versand.
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
          <div style={{ borderTop: "1px solid #334155", marginTop: 15, paddingTop: 12 }}>
            <strong>Follower-Begrüßung (von Jochen manuell, nur Simulation)</strong>
            <p style={{ color: "#cbd5e1", fontSize: 12, marginTop: 6 }}>
              Zwei Originaltexte. Die Begrüßung ist bereits von Jochen geschrieben.
              Kein automatisches Anschreiben, kein echtes DM-Zeitfenster.
              Danach antwortest du als Follower und testest Pete.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                ["WELCOME_1", "Begrüßung 1 · Energie / Fitness"],
                ["WELCOME_2", "Begrüßung 2 · mit Keto"],
              ].map(([keyword, title]) => (
                <button key={keyword} type="button" onClick={() => startCampaignSimulation(keyword)}
                  disabled={loading || refreshing}
                  style={{ padding: "10px 14px", borderRadius: 8,
                    border: "1px solid #ff914d", background: "#26354a", color: "#fff",
                    fontWeight: 700, cursor: loading ? "wait" : "pointer" }}>
                  {title}
                </button>
              ))}
            </div>
          </div>
          {entryNotice && <p role="status" style={{ color: "#f8fafc", fontSize: 13,
            marginTop: 10, marginBottom: 0 }}>{entryNotice}</p>}
          {noSendFlow && (
            <div aria-label="Gespeicherter NoSend-Kampagnenablauf"
              style={{ marginTop: 12, padding: 12, border: "1px solid #ff914d",
                background: "#172235", borderRadius: 10, fontSize: 13 }}>
              <strong>V2-Kampagne: {noSendFlow.campaignId}</strong>
              <div style={{ marginTop: 5, color: "#cbd5e1" }}>
                Servergebundener Entwurf · Kein Versand · Status: {noSendFlow.stage}
              </div>
              {noSendFlow.stage === "await_button" && (
                <button type="button" disabled={loading || refreshing}
                  onClick={() => simulateFlowAction("button")}
                  style={{ marginTop: 9, padding: "9px 12px", border: 0,
                    borderRadius: 8, background: "#ff914d", color: "#111827", fontWeight: 700 }}>
                  Button simulieren: {noSendFlow.buttonLabel}
                </button>
              )}
              {noSendFlow.stage === "await_link" && (
                <div>
                  <p style={{ margin: "9px 0", overflowWrap: "anywhere" }}>
                    Gespeicherter Link (nicht automatisch geöffnet):
                    {" "}{noSendFlow.linkLabel}: {noSendFlow.linkUrl}
                  </p>
                  <button type="button" disabled={loading || refreshing}
                    onClick={() => simulateFlowAction("link")}
                    style={{ padding: "9px 12px", border: 0, borderRadius: 8,
                      background: "#ff914d", color: "#111827", fontWeight: 700 }}>
                    Link-Schritt simulieren
                  </button>
                </div>
              )}
              {noSendFlow.stage === "pete_ready" &&
                <p style={{ margin: "9px 0 0" }}>
                  Pete-Handoff freigegeben. Erst deine nächste Testnachricht startet Pete.
                </p>}
              {noSendFlow.stage === "finished" &&
                <p style={{ margin: "9px 0 0" }}>
                  Ablauf beendet. Pete-Handoff ist für diese Kampagne nicht aktiviert.
                </p>}
            </div>
          )}
          {entrySource === "instagram_reel_comment" &&
            <p style={{ color: "#cbd5e1", fontSize: 12, marginTop: 8 }}>
              Ein Kommentar eröffnet noch kein reguläres DM-Nachrichtenfenster.
              Erst deine anschließende Antwort an Pete zählt als eingehende DM.
            </p>}
        </div>

        <section aria-label="Pete-KI und Kostenstatus" style={{
          background: "#111827", border: "1px solid #2a3348",
          borderRadius: 12, padding: 14, marginBottom: 14,
        }}>
          <strong>Echte Pete-KI im lokalen Labor: {!budget?.ok || aiDiagnostic?.error
            ? "Status nicht bestätigt" : budget.enabled ? "AN" : "AUS"}</strong>
          <div role="status" style={{ fontSize: 12, color: buildMismatch ? "#fbbf24" : "#cbd5e1", marginTop: 6 }}>
            Version: {frontendBuildSha
              ? ("Pete V5 / Dashboard V2 · " + (import.meta.env.VITE_FP_BUILD_DATE || "Datum offen") + " · " + frontendBuildSha)
              : "kein verifizierter One-Click-Build"}
            {buildMismatch && " | SICHERHEITS-STOP: Frontend/Backend-Version verschieden"}
            {frontendBuildSha && !backendBuildSha && " | Backend-Version nicht bestätigt"}
            {!versionVerified && " | Kostenpflichtige KI gesperrt bis zum geprüften One-Click-Start"}
          </div>
          <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.5 }}>
            KI AN erlaubt kostenpflichtige Pete-Antworten bei deinen manuellen Testnachrichten.
            Du verwaltest dein OpenAI-Guthaben selbst. Kein festes lokales Testbudget
            und keine automatische Nachladung. Nach jedem Backend-Neustart ist KI AUS.
          </p>
          <button type="button" role="switch" aria-checked={budget?.enabled === true}
            onClick={togglePeteAi}
            disabled={aiChecking || (!budget?.enabled && (!versionVerified || Boolean(aiBlock) || loading))}
            style={{ background: budget?.enabled ? "#fbbf24" : "#ff914d", color: "#111827",
              border: "none", borderRadius: 8, padding: "10px 14px", fontWeight: 700, margin: 8 }}>
            {budget?.enabled ? "KI verwenden: AN" : "KI verwenden: AUS"}
          </button>
          {aiDiagnostic?.error && <button type="button" onClick={checkPeteKiReadOnly}
            disabled={aiChecking || loading}
            style={{ color: "#f8fafc", background: "transparent", border: "none",
              textDecoration: "underline", cursor: "pointer", padding: 4 }}>
            Status neu prüfen
          </button>}
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={checkOpenAiProvider}
              disabled={providerChecking || loading}
              style={{ color: "#111827", background: "#93c5fd", padding: "10px 14px",
                border: 0, borderRadius: 8, fontWeight: 700 }}>
              {providerChecking ? "OpenAI-Verbindung wird geprüft ..." : "OpenAI-Verbindung prüfen (ohne KI-Antwort)"}
            </button>
            <p style={{ color: "#cbd5e1", fontSize: 12 }}>
              Nur auf deinen Klick: geschützte Modell-Metadatenabfrage, kein Pete-Gespräch,
              keine Antwort-Tokens und keine Instagram-/WhatsApp-Nachricht.
            </p>
            {providerCheck && <p role="status" style={{ color: "#f8fafc" }}>
              {describeProviderConnection(providerCheck)}
            </p>}
          </div>
          {aiDiagnostic && <div role="status" style={{
            marginTop: 12, color: "#f8fafc", fontSize: 13, lineHeight: 1.5,
          }}>
            {aiBlock && <p style={{ color: "#fbbf24" }}>{aiBlock}</p>}
            <div>Lokale Pete-Kosten bestätigt: {formatDesktopUsd(budget?.confirmedUsd)}</div>
            <div>Reserviert oder noch ungeklärt: {formatDesktopUsd(budget?.reservedUsd)}</div>
            <div><strong>Kostenfreigabe: {budget?.enabled ? "KI AN" : "KI AUS"}</strong></div>
            <p style={{ color: "#cbd5e1" }}>
              Kein OpenAI-Kontoguthaben: Die Werte zeigen nur lokal erfasste API-Kosten.
              Ungeklärte Aufrufe bleiben protokolliert. Meta- und WhatsApp-Versand bleiben AUS.
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
            {debug.replySuppressedReason && (
              <div role="alert" style={{ marginTop: 7, color: "#fbbf24" }}>
                Pete hat keine Antwort gesendet: {debug.replySuppressedReason === "human_owned"
                  ? "Interne menschliche Uebernahme / Pete pausiert. Dieser Labor-Lead erscheint nicht automatisch in der normalen Inbox."
                  : debug.replySuppressedReason === "stopped"
                    ? "Kontaktstopp (STOP)." : "Nachricht unterdrueckt."}
              </div>
            )}
            {debug.replySource === "llm_handoff" && (
              <div role="alert" style={{ marginTop: 7, color: "#fbbf24" }}>
                KI-Diagnose: {explainLocalLlmDiagnostic(debug.llmDiagnostic)}
                <div>Kein erfolgreicher Modelltext nachgewiesen. Eine lokale Budgetreservierung
                  ist keine bestätigte OpenAI-Abrechnung.</div>
              </div>
            )}
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
                    <strong>{isUser
                      ? (messages.some(item => item.manualOwnerGreeting) ? "Follower (du im Test)" : "Du")
                      : msg.manualOwnerGreeting
                        ? "Jochen (manuell, simuliert)"
                        : msg.syntheticAutomation
                          ? "Kampagnen-Automatik (Simulation)"
                          : "Pete"}:</strong>{" "}
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
            placeholder={messages.some(item => item.manualOwnerGreeting)
              ? "Als Follower auf Jochens Begrüßung antworten..."
              : "Nachricht eingeben..."}
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
    </section>
  );
}
