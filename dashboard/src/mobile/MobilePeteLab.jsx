import React, { useCallback, useEffect, useRef, useState } from "react";
import { buildApiUrl } from "../services/apiBase";
import { budgetCounterChange, formatUsd, readPeteBudget } from "./peteLabBudget";
import { browserSpeechConstructor, recognizedSpeech, withRecognizedText, speechErrorLabel } from "./peteLabSpeech";
import { isSyntheticLabId, loadTestHistory, rememberTest, saveTestHistory, loadReviews, saveReviews, buildReviewExport } from "./peteLabReview";
import "./mobilePeteLab.css";

const STORAGE_KEY = "fp-temporary-pete-lab-lead-v1";
const ENTRY_SCENARIOS = [
  ["follower", "Neuer Follower begrüßt Pete"],
  ["jochen_greeting", "Jochen begrüßt persönlich (KI pausiert)"],
  ["check", "CHECK - Elternfitness-Check"],
  ["bullshit", "BULLSHIT - No-Bullshit-Angebot"],
  ["keto", "KETO - Gratis-Guide"],
  ["video", "VIDEO - Inhalt anfragen"],
  ["guide", "GUIDE - Info anfragen"],
  ["reel_fun", "Privates Reel + 😂 (kein Verkauf)"],
  ["reel_question", "Reel mit Frage (menschlich prüfen)"],
  ["reel_keyword", "Reel + KETO (explizites Interesse)"],
];

function newSyntheticId() {
  return "lab_" + (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + "_" + Math.random().toString(36).slice(2));
}
function getSavedId() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isSyntheticLabId(value) ? value : newSyntheticId();
  } catch {
    return newSyntheticId();
  }
}
function parseMessages(state) {
  if (!Array.isArray(state?.messages)) return [];
  return state.messages.filter(m => (m.role === "user" || m.role === "assistant") &&
    typeof m.text === "string").map((m, i) => ({
    id: String(m.id || i), role: m.role, actor: m.actor, text: m.text,
  }));
}
function moneyText(value) { return formatUsd(value, 4); }

export default function MobilePeteLab() {
  const [id, setId] = useState(getSavedId);
  const [history, setHistory] = useState(() =>
    rememberTest(loadTestHistory(window.localStorage), id, "Test " + new Date().toLocaleString("de-DE")));
  const [reviews, setReviews] = useState(() => loadReviews(window.localStorage, id));
  const sendLock = useRef(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [budget, setBudget] = useState(null);
  const [sessionBaseline, setSessionBaseline] = useState(null);
  const [lastChange, setLastChange] = useState(null);
  const [status, setStatus] = useState("Verbinde...");
  const [busy, setBusy] = useState(false);
  const [replySource, setReplySource] = useState("");
  const [selectedScenario, setSelectedScenario] = useState("follower");
  const [scenarioSummary, setScenarioSummary] = useState("");
  const lastRef = useRef(null);
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState("");
  const [canDictate] = useState(() => Boolean(browserSpeechConstructor(typeof window === "undefined" ? null : window)));

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* storage optional */ }
  }, [id]);
  useEffect(() => { saveTestHistory(window.localStorage, history); }, [history]);

  useEffect(() => {
    // A service worker with *no cache* satisfies app-shell installation without
    // persisting test chats, API budget responses or private admin resources.
    if (import.meta.env.PROD && "serviceWorker" in navigator &&
        location.protocol === "https:") {
      navigator.serviceWorker.register("/pete-lab-sw.js", { scope: "/pete-test" })
        .catch(() => {});
    }
  }, []);

  useEffect(() => () => {
    // Never leave a microphone session active after leaving the temporary lab.
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.abort(); } catch { /* browser may already have stopped */ }
      recognitionRef.current = null;
    }
  }, []);

  const cancelSpeech = () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.abort(); } catch { /* already ended */ }
      recognitionRef.current = null;
    }
    setListening(false);
    setSpeechStatus("");
  };

  const toggleSpeech = () => {
    const active = recognitionRef.current;
    if (active) {
      try { active.stop(); } catch { cancelSpeech(); }
      return;
    }
    if (busy) return;
    const Speech = browserSpeechConstructor(window);
    if (!Speech) {
      setSpeechStatus("Dieser Browser unterstützt die Diktierfunktion nicht. Öffne die Pete-App direkt in Google Chrome statt im ChatGPT-Browser.");
      return;
    }
    try {
      const recognition = new Speech();
      const existingDraft = draft;
      recognition.lang = "de-DE";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = event => {
        // No audio is stored or sent to our backend. The text is editable;
        // sending a message remains a completely separate explicit action.
        setDraft(withRecognizedText(existingDraft, recognizedSpeech(event)));
        setSpeechStatus("Text erkannt. Bitte kontrollieren und dann selbst senden.");
      };
      recognition.onerror = event => {
        const message = speechErrorLabel(event?.error);
        if (message) setSpeechStatus(message);
      };
      recognition.onend = () => {
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        setListening(false);
        setSpeechStatus(previous => previous.startsWith("Mikrofon aktiv:") ? "Diktat beendet. Text bitte prüfen." : previous || "Diktat beendet. Text bitte prüfen.");
      };
      recognitionRef.current = recognition;
      setSpeechStatus("Mikrofon aktiv: Jetzt sprechen. Beim ersten Mal Zugriff erlauben.");
      setListening(true);
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setSpeechStatus("Spracherkennung konnte nicht starten. Versuche Google Chrome oder tippe den Text ein.");
    }
  };

  const loadBudget = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl("/test-chat/lab/budget"), {
        credentials: "same-origin", cache: "no-store",
      });
      if (res.status === 401 && import.meta.env.PROD) {
        window.location.assign("/lab-login");
        return null;
      }
      if (!res.ok) throw Error("Keine Budgetfreigabe");
      const value = readPeteBudget(await res.json());
      if (!value) throw Error("Budgetdaten ungültig");
      setBudget(value);
      setSessionBaseline(prev => prev === null ? value.spent : prev);
      return value;
    } catch {
      setBudget(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function start() {
      // Budget is checked first. A missing meter must never be interpreted as $0.
      const budgetData = await loadBudget();
      if (!active) return;
      setStatus(budgetData ? "Testbereit" : "Kostenkontrolle nicht erreichbar");
      try {
        const res = await fetch(buildApiUrl("/test-chat/lab/state/" +
          encodeURIComponent(id)), { credentials: "same-origin", cache: "no-store" });
        if (res.status === 404) { setMessages([]); return; }
        if (!res.ok) throw Error("Chat nicht verfügbar");
        const data = await res.json();
        if (active) setMessages(parseMessages(data.state));
      } catch {
        if (active) setStatus("Testverlauf nicht erreichbar");
      }
    }
    start();
    return () => { active = false; };
  }, [id, loadBudget]);

  useEffect(() => {
    lastRef.current?.scrollIntoView?.({ block: "end", behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy || listening || sendLock.current || !budget || budget.blocked) return;
    sendLock.current = true;
    setBusy(true);
    setStatus("Pete antwortet...");
    const before = await loadBudget();
    if (!before || before.blocked) {
      sendLock.current = false;
      setBusy(false);
      setStatus("Kostenkontrolle gesperrt oder nicht erreichbar");
      return;
    }
    setDraft("");
    try {
      const res = await fetch(buildApiUrl("/test-chat/lab/message"), {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: id, messageText: text }),
      });
      const data = await res.json();
      if (!res.ok || data.ok !== true) throw Error(data.error || "Test nicht möglich");
      setMessages(parseMessages(data.state));
      setReplySource(String(data.replySource || ""));
      setStatus(data.replySuppressedReason
        ? "Pete pausiert: " + data.replySuppressedReason
        : "Testantwort erhalten");
    } catch {
      // Preserve a long dictated message, but never auto-retry a potentially billed call.
      setDraft(previous => previous || text);
      setStatus("Antwort unklar. Zuerst Verlauf und Budget aktualisieren, nicht blind erneut senden.");
    } finally {
      const after = await loadBudget();
      setLastChange(budgetCounterChange(before, after));
      sendLock.current = false;
      setBusy(false);
    }
  };

  const startScenario = async () => {
    if (busy || sendLock.current || listening || !budget || budget.blocked) return;
    sendLock.current = true;
    cancelSpeech();
    setBusy(true);
    setStatus("Einstieg wird im echten Testverlauf angelegt...");
    const freshId = newSyntheticId();
    try {
      const before = await loadBudget();
      if (!before || before.blocked) {
        setStatus("Kostenkontrolle gesperrt. Szenario nicht gestartet.");
        return;
      }
      const response = await fetch(buildApiUrl("/test-chat/lab/start"), {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: freshId, scenarioId: selectedScenario }),
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true) throw Error(data.error || "Szenario nicht möglich");
      const title = ENTRY_SCENARIOS.find(([value]) => value === selectedScenario)?.[1] || "Fiktiver Test";
      setHistory(previous => rememberTest(previous, freshId, title));
      setId(freshId);
      setMessages(parseMessages(data.state));
      setReviews({});
      setDraft("");
      setReplySource(String(data.replySource || ""));
      setLastChange(budgetCounterChange(before, await loadBudget()));
      setScenarioSummary(data.replySuppressedReason === "shared_media_needs_human_review"
        ? "Reel/Anhang ist nicht auslesbar: Pete bleibt still. Dieser Chat braucht persönliche Prüfung."
        : data.replySuppressedReason === "human_owned"
          ? "Jochen hat persönlich geschrieben: Pete pausiert, bis Jochen die KI ausdrücklich freigibt."
          : "Der Einstieg und Petes Antwort gehören jetzt zum selben gespeicherten Testgespräch.");
      setStatus("Szenario gestartet");
    } catch {
      setStatus("Szenario-Start unklar. Bitte erst Verlauf und Budget prüfen, nicht blind wiederholen.");
    } finally {
      sendLock.current = false;
      setBusy(false);
    }
  };

  const selectConversation = nextId => {
    if (busy || !history.some(test => test.id === nextId)) return;
    cancelSpeech();
    setId(nextId);
    setScenarioSummary("");
    setMessages([]);
    setDraft("");
    setReviews(loadReviews(window.localStorage, nextId));
    setReplySource("");
    setLastChange(null);
    setStatus("Testverlauf wird geladen...");
  };
  const newConversation = () => {
    if (busy) return;
    cancelSpeech();
    const newId = newSyntheticId();
    setHistory(previous => rememberTest(previous, newId,
      "Test " + new Date().toLocaleString("de-DE")));
    setId(newId);
    setScenarioSummary("");
    setMessages([]);
    setDraft("");
    setReviews({});
    setReplySource("");
    setLastChange(null);
    setStatus("Neuer fiktiver Testkontakt");
  };
  const rateReply = (messageId, patch) => {
    setReviews(previous => {
      const next = { ...previous, [messageId]: { ...previous[messageId], ...patch } };
      saveReviews(window.localStorage, id, next);
      return next;
    });
  };

  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    const b = await loadBudget();
    try {
      const res = await fetch(buildApiUrl("/test-chat/lab/state/" +
        encodeURIComponent(id)), { credentials: "same-origin", cache: "no-store" });
      if (res.status === 404) setMessages([]);
      else if (res.ok) setMessages(parseMessages((await res.json()).state));
      else throw Error();
      setStatus(b ? "Aktueller Stand geladen" : "Kostenkontrolle nicht erreichbar");
    } catch {
      setStatus("Verlauf nicht erreichbar");
    }
    setBusy(false);
  };

  const copyFeedback = async () => {
    const summary = buildReviewExport(messages, reviews);
    if (!summary) { setStatus("Bitte zuerst eine Pete-Antwort bewerten."); return; }
    try {
      await navigator.clipboard.writeText(summary);
      setStatus("Feedback kopiert. Du kannst es mir hier schicken.");
    } catch {
      setStatus("Kopieren nicht verfügbar. Nutze die Chat-Auswahl.");
    }
  };

  const sessionSpend = budget && sessionBaseline !== null
    ? Math.max(0, budget.spent - sessionBaseline) : null;
  return (
    <main className="pete-mobile-lab">
      <header className="pete-lab-header">
        <div className="pete-lab-mark" aria-hidden="true">P</div>
        <div>
          <h1>Pete Testlabor</h1>
          <p>Nur Entwicklung · fiktive Gespräche · kein IG/WhatsApp-Versand</p>
        </div>
      </header>
      <section className="pete-lab-budget" aria-label="Interne API-Kostenkontrolle">
        <div className="pete-lab-budget-title">
          <strong>API-Testkosten</strong>
          <button type="button" onClick={refresh} disabled={busy}>Aktualisieren</button>
        </div>
        {budget ? (
          <>
            <div className="pete-lab-finances">
              <div><span>Verbraucht</span><strong>{moneyText(budget.spent)}</strong></div>
              <div><span>Noch frei</span><strong>{moneyText(budget.left)}</strong></div>
              <div><span>Interne Grenze</span><strong>{formatUsd(budget.cap, 2)}</strong></div>
            </div>
            <div className="pete-lab-meter" role="progressbar"
              aria-label="Anteil genutzter interner API-Grenze" aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Math.min(100, Math.round(100 * budget.spent / budget.cap))}>
              <div style={{ width: Math.min(100, 100 * budget.spent / budget.cap) + "%" }} />
            </div>
            <div className="pete-lab-subcost">
              <span>Seit App-Öffnung: {sessionSpend === null ? "–" : moneyText(sessionSpend)}</span>
              <span>Letzte Zähleränderung: {lastChange === null ? "–" : formatUsd(lastChange, 6)}</span>
            </div>
            <div className="pete-lab-subcost">
              <span>Bestätigt: {moneyText(budget.confirmed)}</span>
              <span>Reserviert: {moneyText(budget.reserved)}</span>
            </div>
            {budget.blocked && <p className="pete-lab-warning" role="alert">Interne Grenze erreicht. Weitere KI-Testaufrufe sind gesperrt.</p>}
            {!budget.blocked && budget.low && <p className="pete-lab-warning" role="alert">Weniger als 20 % der internen Grenze verfügbar.</p>}
          </>
        ) : <p className="pete-lab-warning" role="alert">Zähler nicht erreichbar. Senden aus Sicherheitsgründen gesperrt.</p>}
        <p className="pete-lab-disclaimer">Nur dieser Backend-Pete-Zähler. <strong>Kein OpenAI-Kontoguthaben</strong>, keine automatische Aufladung. Bei parallelen Tests ist die Änderung nicht exakt einem Chat zuzuordnen.</p>
      </section>
      <section className="pete-lab-entry" aria-label="Gesprächseinstieg simulieren">
        <label htmlFor="pete-lab-entry">Gesprächseinstieg testen</label>
        <select id="pete-lab-entry" value={selectedScenario}
          onChange={e => setSelectedScenario(e.target.value)}
          disabled={busy || listening}>
          {ENTRY_SCENARIOS.map(([value, label]) =>
            <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" onClick={startScenario}
          disabled={busy || listening || !budget || budget.blocked}>
          Einstieg als neuen Test starten
        </button>
        <p>Der Einstieg wird im Test-Backend gespeichert. Keine Nachricht geht an Instagram.</p>
        {scenarioSummary && <p className="pete-lab-entry-result" role="status">{scenarioSummary}</p>}
      </section>
      <div className="pete-lab-sessions">
        <label htmlFor="pete-lab-session">Fiktiven Chat fortsetzen</label>
        <select id="pete-lab-session" value={id}
          onChange={e => selectConversation(e.target.value)} disabled={busy}>
          {history.map(entry => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
        </select>
      </div>
      <div className="pete-lab-actions">
        <button type="button" onClick={newConversation} disabled={busy}>+ Neuer Test</button>
        <button type="button" onClick={copyFeedback}>Bewertungen kopieren</button>
      </div>
      <section className="pete-lab-conversation" aria-label="Fiktives Pete-Testgespräch">
        {!messages.length && <div className="pete-lab-empty">Starte als Mama oder Papa. Nutze unten den Mikrofon-Button oder tippe deine Nachricht ein.</div>}
        {messages.map(m => (
          <div className={"pete-lab-message " + (m.role === "user" ? "is-lead" : m.actor === "human" ? "is-human" : "is-pete")} key={m.id}>
            <div className="pete-lab-bubble">
              <strong>{m.role === "user" ? "Test-Elternteil" : m.actor === "human" ? "Jochen (persönlich)" : "Pete"}</strong>
              <p>{m.text}</p>
            </div>
            {m.role === "assistant" && m.actor !== "human" && (
              <div className="pete-lab-votes" aria-label="Antwort bewerten">
                <button type="button" aria-pressed={reviews[m.id]?.rating === "gut"}
                  onClick={() => rateReply(m.id, { rating: "gut" })}>👍 Gut</button>
                <button type="button" aria-pressed={reviews[m.id]?.rating === "verbessern"}
                  onClick={() => rateReply(m.id, { rating: "verbessern" })}>👎 Verbessern</button>
              </div>
            )}
            {m.role === "assistant" && m.actor !== "human" && (reviews[m.id]?.rating === "verbessern" || reviews[m.id]?.note) && (
              <label className="pete-lab-note">
                Was sollte Pete anders machen?
                <textarea maxLength={400} rows={2}
                  value={reviews[m.id]?.note || ""}
                  placeholder="Kurze Korrektur für Pete diktieren oder tippen..."
                  onChange={e => rateReply(m.id, { note: e.target.value })} />
              </label>
            )}
          </div>
        ))}
        {busy && <p className="pete-lab-busy">Pete verarbeitet den Test...</p>}
        <div ref={lastRef} />
      </section>
      <form className="pete-lab-composer" onSubmit={e => { e.preventDefault(); send(); }}>
        <label htmlFor="pete-lab-input">Fiktive Testnachricht</label>
        <textarea id="pete-lab-input" rows="2" maxLength={1000} value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Hier tippen oder unten aufs Mikrofon tippen..."
          disabled={busy || listening || !budget || budget.blocked} />
        <button type="button" className={"pete-lab-mic-button" + (listening ? " is-listening" : "")}
          aria-pressed={listening} onClick={toggleSpeech} disabled={busy}>
          {listening ? "⏹ Diktat beenden" : "🎤 Nachricht diktieren"}
        </button>
        {speechStatus && <p className="pete-lab-speech-status" role="status">{speechStatus}</p>}
        {!canDictate && <p className="pete-lab-speech-hint">Für das Mikrofon bitte die App direkt in Google Chrome öffnen. Der ChatGPT-interne Browser unterstützt diese Funktion möglicherweise nicht.</p>}
        <button type="submit" disabled={busy || listening || !draft.trim() || !budget || budget.blocked}>
          {busy ? "Warten..." : "An Pete senden"}
        </button>
      </form>
      <p className="pete-lab-status" role="status">{status}{replySource ? " · Quelle: " + replySource : ""}</p>
      <footer>Testmodus. Fiktive Chatverläufe liegen im Test-Backend; deine Bewertungen bleiben nur auf diesem Handy gespeichert. Browser-Spracherkennung kann einen externen Sprachdienst nutzen. Keine OpenAI-Audio-API und kein automatisches KI-Training.</footer>
    </main>
  );
}
