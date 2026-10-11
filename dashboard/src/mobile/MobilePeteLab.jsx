import React, { useCallback, useEffect, useRef, useState } from "react";
import { buildApiUrl } from "../services/apiBase";
import { budgetCounterChange, formatUsd, readPeteBudget } from "./peteLabBudget";
import "./mobilePeteLab.css";

const CAMPAIGN = "eltern-vital-fit";
const STORAGE_KEY = "fp-temporary-pete-lab-lead-v1";

function newSyntheticId() {
  return "lab_" + (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + "_" + Math.random().toString(36).slice(2));
}
function getSavedId() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && /^lab_[a-zA-Z0-9_-]{8,90}$/.test(value) ? value : newSyntheticId();
  } catch {
    return newSyntheticId();
  }
}
function parseMessages(state) {
  if (!Array.isArray(state?.messages)) return [];
  return state.messages.filter(m => (m.role === "user" || m.role === "assistant") &&
    typeof m.text === "string").map((m, i) => ({
    id: String(m.id || i), role: m.role, text: m.text,
  }));
}
function moneyText(value) { return formatUsd(value, 4); }

export default function MobilePeteLab() {
  const [id, setId] = useState(getSavedId);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [budget, setBudget] = useState(null);
  const [sessionBaseline, setSessionBaseline] = useState(null);
  const [lastChange, setLastChange] = useState(null);
  const [status, setStatus] = useState("Verbinde...");
  const [busy, setBusy] = useState(false);
  const [replySource, setReplySource] = useState("");
  const [votes, setVotes] = useState({});
  const lastRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* storage optional */ }
  }, [id]);

  useEffect(() => {
    // A service worker with *no cache* satisfies app-shell installation without
    // persisting test chats, API budget responses or private admin resources.
    if (import.meta.env.PROD && "serviceWorker" in navigator &&
        location.protocol === "https:") {
      navigator.serviceWorker.register("/pete-lab-sw.js", { scope: "/pete-test" })
        .catch(() => {});
    }
  }, []);

  const loadBudget = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl("/test-chat/budget"), {
        credentials: "same-origin", cache: "no-store",
      });
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
        const res = await fetch(buildApiUrl("/test-chat/state/" + CAMPAIGN + "/" +
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
    if (!text || busy || !budget || budget.blocked) return;
    setBusy(true);
    setStatus("Pete antwortet...");
    const before = await loadBudget();
    if (!before || before.blocked) {
      setBusy(false);
      setStatus("Kostenkontrolle gesperrt oder nicht erreichbar");
      return;
    }
    setDraft("");
    try {
      const res = await fetch(buildApiUrl("/test-chat/message"), {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: id, campaignId: CAMPAIGN, messageText: text }),
      });
      const data = await res.json();
      if (!res.ok || data.ok !== true) throw Error(data.error || "Test nicht möglich");
      setMessages(parseMessages(data.state));
      setReplySource(String(data.replySource || ""));
      setStatus(data.replySuppressedReason
        ? "Pete pausiert: " + data.replySuppressedReason
        : "Testantwort erhalten");
    } catch {
      // Do not fabricate a Pete response or reverse a potentially billed call.
      setStatus("Test fehlgeschlagen. Bitte Verlauf und Budget neu laden.");
    } finally {
      const after = await loadBudget();
      setLastChange(budgetCounterChange(before, after));
      setBusy(false);
    }
  };

  const newConversation = () => {
    if (busy) return;
    setId(newSyntheticId());
    setMessages([]);
    setDraft("");
    setVotes({});
    setReplySource("");
    setLastChange(null);
    setStatus("Neuer fiktiver Testkontakt");
  };

  const refresh = async () => {
    if (busy) return;
    setBusy(true);
    const b = await loadBudget();
    try {
      const res = await fetch(buildApiUrl("/test-chat/state/" + CAMPAIGN + "/" +
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
    const rated = messages.filter(m => m.role === "assistant" && votes[m.id]);
    if (!rated.length) { setStatus("Bitte zuerst eine Pete-Antwort bewerten."); return; }
    const summary = rated.map(m => "Pete: " + m.text + "\nBewertung: " + votes[m.id]).join("\n\n");
    try {
      await navigator.clipboard.writeText("Pete Testfeedback (nur fiktive Daten)\n\n" + summary);
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
              <span>Letzte Zähleränderung: {lastChange === null ? "–" : moneyText(lastChange)}</span>
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
      <div className="pete-lab-actions">
        <button type="button" onClick={newConversation} disabled={busy}>+ Neuer Test</button>
        <button type="button" onClick={copyFeedback}>Bewertungen kopieren</button>
      </div>
      <section className="pete-lab-conversation" aria-label="Fiktives Pete-Testgespräch">
        {!messages.length && <div className="pete-lab-empty">Starte als Mama oder Papa. Sprich deinen Text einfach über die Mikrofontaste deiner Android-Tastatur ein.</div>}
        {messages.map(m => (
          <div className={"pete-lab-message " + (m.role === "user" ? "is-lead" : "is-pete")} key={m.id}>
            <div className="pete-lab-bubble">
              <strong>{m.role === "user" ? "Test-Elternteil" : "Pete"}</strong>
              <p>{m.text}</p>
            </div>
            {m.role === "assistant" && (
              <div className="pete-lab-votes" aria-label="Antwort bewerten">
                <button type="button" aria-pressed={votes[m.id] === "gut"}
                  onClick={() => setVotes(v => ({ ...v, [m.id]: "gut" }))}>👍 Gut</button>
                <button type="button" aria-pressed={votes[m.id] === "verbessern"}
                  onClick={() => setVotes(v => ({ ...v, [m.id]: "verbessern" }))}>👎 Verbessern</button>
              </div>
            )}
          </div>
        ))}
        {busy && <p className="pete-lab-busy">Pete verarbeitet den Test...</p>}
        <div ref={lastRef} />
      </section>
      <form className="pete-lab-composer" onSubmit={e => { e.preventDefault(); send(); }}>
        <label htmlFor="pete-lab-input">Fiktive Testnachricht</label>
        <textarea id="pete-lab-input" rows="2" value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Hier tippen oder mit der Tastatur diktieren..."
          disabled={busy || !budget || budget.blocked} />
        <button type="submit" disabled={busy || !draft.trim() || !budget || budget.blocked}>
          {busy ? "Warten..." : "An Pete senden"}
        </button>
      </form>
      <p className="pete-lab-status" role="status">{status}{replySource ? " · Quelle: " + replySource : ""}</p>
      <footer>Testmodus. Feedback wird nur bis zum Schließen der App gehalten; kopiere es bei Bedarf. Kein automatisches KI-Training.</footer>
    </main>
  );
}
