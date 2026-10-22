/**
 * Owner-approved one-time real-provider QA. 20 synthetic parent cases only.
 * NEVER connects to Instagram, WhatsApp, live leads, calendars or checkout.
 * Every response records its authoritative replySource. Fixed rule responses
 * are NOT counted as real-model responses. Report is not an acceptance verdict.
 */
import fs from "node:fs";
import path from "node:path";

if (process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_REF !== "refs/heads/pete-sol-model-smoke-20261022" ||
    process.env.PETE_SOL_SMOKE_QA_20261022 !== "true" ||
    process.env.PETE_SOL_SMOKE_APPROVAL !== "one-off-20261022-usd1p5" ||
    process.env.PETE_QUALITY_QA_20261021 === "true" ||
    process.env.NODE_ENV !== "test" ||
    process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
    process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
    process.env.WHATSAPP_SEND_ENABLED !== "false" ||
    process.env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
    process.env.OPENAI_MODEL !== "gpt-6.1-sol" ||
    !process.env.OPENAI_API_KEY?.trim()) throw new Error("Yoda3 safety gate missing");
const dataDir = path.resolve(process.env.DATA_DIR || "");
const workDir = path.resolve(process.cwd());
const expectedDataDir = path.join(workDir, ".pete-sol-smoke-20261022");
if (dataDir !== expectedDataDir) {
  throw new Error("QA data directory is not isolated");
}

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { writeSettings } = await import("../services/settings-store.js");
const { getPeteBudgetStatusSafe } = await import("../services/pete-api-budget.service.js");
writeSettings({ aiEnabled: true, aiModel: "gpt-6.1-sol" });

const allCases = [
  {
    "id": "Y-entry",
    "lines": [
      "Hi, ich bin Vater von zwei Kindern und will erst mal wissen, was ihr macht.",
      "Für wen ist das konkret geeignet?"
    ]
  },
  {
    "id": "Y-no-time",
    "lines": [
      "Ich arbeite Vollzeit, habe zwei Kinder und keine Zeit für täglichen Sport.",
      "Wie soll ich das überhaupt schaffen?"
    ]
  },
  {
    "id": "Y-food",
    "lines": [
      "Training läuft. Abends esse ich wegen Stress aber alles durcheinander.",
      "Was wäre bei euch anders als ein Ernährungsplan?"
    ]
  },
  {
    "id": "Y-exhaustion",
    "lines": [
      "Ich bin Mama und abends komplett erledigt.",
      "Ich will nicht noch einen Pflichtplan. Was wäre realistisch?"
    ]
  },
  {
    "id": "Y-shift",
    "lines": [
      "Bei Schichtarbeit fallen meine Pausen aus, dann stopfe ich abends irgendwas rein.",
      "Bitte nicht wieder Training empfehlen. Das ist nicht mein Problem."
    ]
  },
  {
    "id": "Y-trust",
    "lines": [
      "Drei Coaches haben mir viel versprochen. Warum seid ihr anders?",
      "Sag mir konkret, wie ihr die Umsetzung im Familienalltag angeht."
    ]
  },
  {
    "id": "Y-price",
    "lines": [
      "Ich interessiere mich für Unterstützung, aber das ist mir zu teuer.",
      "Es ist aktuell wirklich nicht in meinem Budget."
    ]
  },
  {
    "id": "Y-value",
    "lines": [
      "499 Euro finde ich teuer.",
      "Ich könnte es bezahlen, aber ich sehe den Mehrwert noch nicht."
    ]
  },
  {
    "id": "Y-partner",
    "lines": [
      "Das klingt passend, aber ich bespreche solche Ausgaben mit meiner Frau.",
      "Was könnte ich ihr sachlich dazu sagen?"
    ]
  },
  {
    "id": "Y-partner-autonomy",
    "lines": [
      "Ich würde das machen, aber mein Mann ist dagegen.",
      "Nein, ich möchte ohne seine Zustimmung nichts buchen."
    ]
  },
  {
    "id": "Y-consider",
    "lines": [
      "Ich möchte darüber schlafen.",
      "Mir fehlt noch Klarheit, was ich konkret bekomme."
    ]
  },
  {
    "id": "Y-buy",
    "lines": [
      "Ich will direkt den Selbststarter kaufen.",
      "Schick mir bitte den Kaufweg."
    ]
  },
  {
    "id": "Y-coaching",
    "lines": [
      "Ich will persönliche Begleitung und nicht nur ein PDF.",
      "Wie läuft der Einstieg bei euch ab?"
    ]
  },
  {
    "id": "Y-objection",
    "lines": [
      "Ich habe schon alles probiert und höre immer nach vier Tagen auf.",
      "Wie vermeide ich wieder so einen Start-Stopp?"
    ]
  },
  {
    "id": "Y-short",
    "lines": [
      "Stress.",
      "Arbeit, Kinder, Schlaf."
    ]
  },
  {
    "id": "Y-not-fit",
    "lines": [
      "Ich habe keine Kinder und suche reines Bodybuilding-Wettkampfcoaching.",
      "Passt das überhaupt zu euch?"
    ]
  },
  {
    "id": "Y-not-ready",
    "lines": [
      "Ich schaue mich nur um, bitte noch nichts verkaufen.",
      "Danke, ich möchte in Ruhe lesen."
    ]
  },
  {
    "id": "Y-no-questions",
    "lines": [
      "Ich bin erschöpft und will jetzt keine Fragen.",
      "Bitte hör auf zu fragen."
    ]
  },
  {
    "id": "Y-no-budget",
    "lines": [
      "Ich habe derzeit gar kein Geld für Coaching.",
      "Ich möchte dafür keine Schulden machen."
    ]
  },
  {
    "id": "Y-repair",
    "lines": [
      "Du hast meine Frage nicht beantwortet. Wie funktioniert eure Methode bei krankem Kind?",
      "Bitte diesmal konkret und kurz."
    ]
  }
] as const;
// Identical, untouched customer messages from eight difficult Yoda3 cases.
const selected = new Set(["Y-food","Y-exhaustion","Y-shift","Y-trust","Y-value","Y-buy","Y-short","Y-not-fit"]);
const cases = allCases.filter(c => selected.has(c.id));

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
      leadId: "qa-yoda3-20261021-" + entry.id,
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
    leadId: "qa-yoda3-20261021-" + entry.id,
    campaignId: DEFAULT_CAMPAIGN_ID, messageText: entry.text,
    conversationMode: "natural",
  });
  const source = String(out.state.answers.peteReplySource ?? "unknown");
  if (source === "llm") throw new Error("Safety text unexpectedly reached model: " + entry.id);
  console.log("SAFETY " + entry.id + " | source=" + source + " | reply=" + JSON.stringify(out.text));
}
const budget = getPeteBudgetStatusSafe();
const allowedCap = 1.5;
if (!budget.ok || budget.committedUsd > allowedCap ||
    budget.labAuthorizedUsd !== allowedCap) {
  throw new Error("QA budget status inconsistent");
}
const output = {
  version: 1, kind: "synthetic_real_openai_qa_20261021",
  model: "gpt-6.1-sol",
  runMode: "sol-isolated-smoke-usd1p5-under-existing-usd8",
  totalAuthorizedUsd: 5,
  previouslyChargedUsd: 0.218332,
  modelCallsCapUsd: allowedCap, totalCases: cases.length, modelResponses,
  nonModelResponses, budget, cases: results,
};
const reportsDir = path.join(workDir, "qa-reports");
fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(path.join(reportsDir,
  "pete-sol-smoke-20261022.json"),
  JSON.stringify(output, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
console.log("SUMMARY: " + JSON.stringify({
  cases: cases.length, modelResponses, nonModelResponses, committedUsd: budget.committedUsd,
  requestsMetered: budget.requestsMetered,
}));
// Do not call this an A- grade; a separate qualitative review is required.
if (modelResponses < 12) throw new Error("Fewer than 12 model-generated replies in 8 QA cases");
