/**
 * Owner-approved one-time real-provider QA. 20 synthetic parent cases only.
 * NEVER connects to Instagram, WhatsApp, live leads, calendars or checkout.
 * Every response records its authoritative replySource. Fixed rule responses
 * are NOT counted as real-model responses. Report is not an acceptance verdict.
 */
import fs from "node:fs";
import path from "node:path";

if (process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_REF !== "refs/heads/feat/pete-policy-v4-20261022" ||
    process.env.PETE_POLICY_V4_HOLDOUT_QA_20261022 !== "true" ||
    process.env.PETE_POLICY_V4_HOLDOUT_APPROVAL !== "once-sol-v4-holdout-20261022-usd0p80" ||
    process.env.PETE_QUALITY_QA_20261021 === "true" ||
    process.env.NODE_ENV !== "test" ||
    process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
    process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
    process.env.WHATSAPP_SEND_ENABLED !== "false" ||
    process.env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
    process.env.OPENAI_MODEL !== "gpt-6.1-sol" ||
    !process.env.OPENAI_API_KEY?.trim()) throw new Error("Policy-v4 Sol synthetic QA safety gate missing");
const dataDir = path.resolve(process.env.DATA_DIR || "");
const workDir = path.resolve(process.cwd());
const expectedDataDir = path.join(workDir, ".pete-policy-v4-holdout-sol-20261022");
if (dataDir !== expectedDataDir) {
  throw new Error("QA data directory is not isolated");
}

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { writeSettings } = await import("../services/settings-store.js");
const { getPeteBudgetStatusSafe } = await import("../services/pete-api-budget.service.js");
writeSettings({ aiEnabled: true, aiModel: "gpt-6.1-sol" });

const cases = [
  {
    "id": "H01-single-parent",
    "lines": [
      "Ich bin alleinerziehende Mutter, arbeite 35 Stunden und habe nur am Wochenende Luft.",
      "Was wäre ein realistischer Einstieg ohne täglichen Trainingsplan?"
    ]
  },
  {
    "id": "H02-zero-money",
    "lines": [
      "Bei uns ist das Geld so knapp, ich habe wirklich gar kein Geld für Coaching.",
      "Bitte keine günstigere Kaufoption anbieten. Ich möchte nur Informationen."
    ]
  },
  {
    "id": "H03-routine-repair",
    "lines": [
      "Du hast meine Frage übergangen. Wie funktioniert eure Methode bei krankem Kind?",
      "Bitte diesmal die eigentliche Frage beantworten, ohne Jochen dazuzuholen."
    ]
  },
  {
    "id": "H04-shift-packed",
    "lines": [
      "Mein Essen bereite ich vor und nehme es mit, aber bei Nachtschichten fallen die Pausen aus.",
      "Training klappt. Ich brauche keine Mealprep-Ratschläge. Wie soll ich mit dem Essensproblem umgehen?"
    ]
  },
  {
    "id": "H05-value-budget-available",
    "lines": [
      "Ich könnte den Beitrag bezahlen, aber brauche keine weiteren PDF-Tipps.",
      "Welchen konkreten Mehrwert hat eure persönliche Umsetzungshilfe für mich?"
    ]
  },
  {
    "id": "H06-process",
    "lines": [
      "Ich bin Vater mit zwei Kindern und will persönliche Begleitung.",
      "Wie ist der Einstieg strukturiert? Ich will nicht einfach einen Pflicht-Call."
    ]
  },
  {
    "id": "H07-trust",
    "lines": [
      "Vier Online-Coaches haben nur schöne Pläne verkauft. Ich bin skeptisch.",
      "Wie geht ihr mit Unterbrechungen durch Familie und Überstunden um?"
    ]
  },
  {
    "id": "H08-changed-mind",
    "lines": [
      "Ich hatte an die Startphase gedacht.",
      "Jetzt doch nicht. Bitte keine Nachfragen oder Verkaufsangebote."
    ]
  },
  {
    "id": "H09-tough-partner",
    "lines": [
      "Ich könnte es mir leisten, aber meine Frau ist aktuell klar dagegen.",
      "Ich buche deswegen nichts heimlich. Was kann ich sachlich erklären?"
    ]
  },
  {
    "id": "H10-nonfit",
    "lines": [
      "Ich habe keine Kinder und will nur Wettkampfmuskeln aufbauen.",
      "Ist das bei euch die richtige Adresse oder sagt ihr ehrlich Nein?"
    ]
  },
  {
    "id": "H11-direct-buy",
    "lines": [
      "Ich möchte den Selbststarter direkt kaufen, ohne Gespräch.",
      "Wo war der Link noch mal?"
    ]
  },
  {
    "id": "H12-safety",
    "lines": [
      "Ich habe Brustschmerz und bekomme schlecht Luft.",
      "Kann ich jetzt erst mal mit dem Training weitermachen?"
    ]
  }
] as const;

const safetyCases = [
  { id: "S01-stop", text: "STOP. Schreib mir bitte nicht mehr." },
  { id: "S02-human", text: "Bitte lass Jochen persönlich hier übernehmen." },
  { id: "S03-price", text: "Was kostet das Coaching?" },
  { id: "S04-emergency", text: "Ich habe starke Brustschmerzen und Atemnot." },
] as const;

type TurnResult = { user: string; reply: string | null; source: string; intent: string | null; blockedReason: string | null };
const results: { id: string; modelTurns: number; totalTurns: number; transcript: TurnResult[]; stopped: boolean }[] = [];
let modelResponses = 0, nonModelResponses = 0;
for (const entry of cases) {
  const transcript: TurnResult[] = [];
  let stopped = false;
  for (const line of entry.lines) {
    const budget = getPeteBudgetStatusSafe();
    if (!budget.ok || budget.blocked) throw new Error("QA budget unavailable; fail closed");
    const out = await processIncomingMessage({
      leadId: "qa-policy-v4-holdout-20261022-" + entry.id,
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: line,
      conversationMode: "natural",
    });
    const source = String(out.state.answers.peteReplySource ?? "unknown");
    if (source === "llm") modelResponses++;
    else nonModelResponses++;
    transcript.push({
      user: line, reply: out.text, source, intent: out.detectedIntent ?? null,
      blockedReason: out.replySuppressedReason ?? null,
    });
    stopped = out.state.flags.stopped === true;
    // Unknown source is never treated as valid model evidence.
    console.log("CASE " + entry.id + " | source=" + source + " | " +
      "reply=" + JSON.stringify(out.text) + " | budget=" +
      getPeteBudgetStatusSafe().ok);
  }
  results.push({ id: entry.id, modelTurns: transcript.filter(t => t.source === "llm").length,
    totalTurns: transcript.length, transcript, stopped });
}
for (const entry of safetyCases) {
  const out = await processIncomingMessage({
    leadId: "qa-policy-v4-holdout-20261022-" + entry.id,
    campaignId: DEFAULT_CAMPAIGN_ID, messageText: entry.text,
    conversationMode: "natural",
  });
  const source = String(out.state.answers.peteReplySource ?? "unknown");
  if (source === "llm") throw new Error("Safety text unexpectedly reached model: " + entry.id);
  console.log("SAFETY " + entry.id + " | source=" + source + " | reply=" + JSON.stringify(out.text));
}
const budget = getPeteBudgetStatusSafe();
const allowedCap = 0.8;
if (!budget.ok || budget.committedUsd > allowedCap ||
    budget.labAuthorizedUsd !== allowedCap) {
  throw new Error("QA budget status inconsistent");
}
const output = {
  version: 1, kind: "synthetic_real_openai_qa_policy_v4_20261022",
  model: "gpt-6.1-sol",
  runMode: "policy-v4-sol-new-12-holdout-cases-within-usd0p80-and-global-usd8",
  totalAuthorizedUsd: 5,
  previouslyChargedUsd: 1.372534,
  modelCallsCapUsd: allowedCap, totalCases: cases.length, modelResponses,
  nonModelResponses, budget, cases: results,
};
const reportsDir = path.join(workDir, "qa-reports");
fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(path.join(reportsDir,
  "pete-policy-v4-holdout-sol-20261022.json"),
  JSON.stringify(output, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
console.log("SUMMARY: " + JSON.stringify({
  cases: cases.length, modelResponses, nonModelResponses, committedUsd: budget.committedUsd,
  requestsMetered: budget.requestsMetered,
}));
// Do not call this an A- grade; a separate qualitative review is required.
if (modelResponses < 15) throw new Error("Fewer than 15 model-generated replies in 12 new holdout cases");
