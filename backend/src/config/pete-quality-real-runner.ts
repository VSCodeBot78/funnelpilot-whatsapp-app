/**
 * Owner-approved one-time real-provider QA. 20 synthetic parent cases only.
 * NEVER connects to Instagram, WhatsApp, live leads, calendars or checkout.
 * Every response records its authoritative replySource. Fixed rule responses
 * are NOT counted as real-model responses. Report is not an acceptance verdict.
 */
import fs from "node:fs";
import path from "node:path";

if (process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_REF !== "refs/heads/pete-quality-real-approved-20261021" ||
    process.env.PETE_QUALITY_QA_20261021 !== "true" ||
    process.env.PETE_QUALITY_QA_APPROVAL !== "single-run-20261021" ||
    process.env.NODE_ENV !== "test" ||
    process.env.INSTAGRAM_ENGINE_ENABLED !== "false" ||
    process.env.INSTAGRAM_SEND_ENABLED !== "false" ||
    process.env.WHATSAPP_SEND_ENABLED !== "false" ||
    process.env.ENABLE_GENERIC_WEBHOOKS !== "false" ||
    process.env.OPENAI_MODEL !== "gpt-4.1-mini" ||
    !process.env.OPENAI_API_KEY?.trim()) {
  throw new Error("QA safety gates missing; zero API calls allowed");
}
const dataDir = path.resolve(process.env.DATA_DIR || "");
const workDir = path.resolve(process.cwd());
if (!dataDir.startsWith(workDir + path.sep) || !dataDir.includes(".pete-quality-20261021")) {
  throw new Error("QA data directory is not isolated");
}

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { writeSettings } = await import("../services/settings-store.js");
const { getPeteBudgetStatusSafe } = await import("../services/pete-api-budget.service.js");
writeSettings({ aiEnabled: true, aiModel: "gpt-4.1-mini" });

const cases = [
  { id: "F01-follower", lines: ["Hi, ich folge dir seit heute."] },
  { id: "F02-exhausted-mother", lines: [
    "Hi, ich bin Mama von zwei Kindern, arbeite Vollzeit und bin abends völlig platt.",
    "Ich bin manchmal so müde, dass ich mit den Kindern einschlafe.",
    "Ich schaffe keinen zusätzlichen Plan und will nicht dauernd ausgefragt werden.",
  ] },
  { id: "F03-shift-stopfe", lines: [
    "Ich bin 42, habe zwei Kinder und trainiere viermal die Woche. Bei Schichtarbeit schaffe ich meine Mahlzeiten kaum.",
    "Ich nehme Essen mit, aber meine Pausen fallen aus. Dann stopfe ich abends irgendwas in mich rein. Training ist nicht mein Problem.",
  ] },
  { id: "F04-sick-child", lines: [
    "Ich hatte mir drei Trainingstage vorgenommen, aber mein Kind war die ganze Woche krank.",
    "Genau deshalb habe ich wieder aufgehört. Ich habe Angst, dass das immer so bleibt.",
  ] },
  { id: "F05-already-training", lines: [
    "Sport mache ich genug. Meine Baustelle ist das Essen zwischen Arbeit und Kinderbetreuung.",
    "Wenn der Tag chaotisch wird, esse ich am Abend alles durcheinander.",
  ] },
  { id: "F06-no-pitch", lines: [
    "Ich will mir erst mal nur anschauen, was du so machst. Noch kein Coaching.",
    "Danke, ich will mich einfach in Ruhe informieren.",
  ] },
  { id: "F07-trust", lines: [
    "Ich hatte schon drei Coaches. Warum sollte das bei euch anders sein?",
    "Und was ist der konkrete Unterschied, ohne irgendwelche Versprechen?",
  ] },
  { id: "F08-quick-intro", lines: [
    "Was genau machst du denn?",
    "Okay und für wen ist das geeignet?",
  ] },
  { id: "F09-reel", lines: [
    "Hi, ich habe gerade dein Reel gesehen und mich beim Thema Zeitmangel wiedererkannt.",
    "Ich arbeite 40 Stunden und habe drei Kinder. Wo soll da Zeit bleiben?",
  ] },
  { id: "F10-short-lead", lines: [
    "Stress.",
    "Job, Kinder, alles zusammen.",
  ] },
  { id: "F11-knowledge-vs-action", lines: [
    "Ich weiß theoretisch genau, wie man gesund isst, aber ich kriege es einfach nicht hin.",
    "Ich will nicht schon wieder einen Ernährungsplan kaufen.",
  ] },
  { id: "F12-returner", lines: [
    "Ich fange immer montags an und lasse es am Donnerstag wieder sein.",
    "Ich habe schon so viel probiert. Irgendwann glaubt man nicht mehr dran.",
  ] },
  { id: "F13-dad-energy", lines: [
    "Ich bin Vater, 48, und möchte einfach mehr Energie statt immer nur müde zu sein.",
    "Mein Schlaf ist wegen der Kleinen gerade komplett unregelmäßig.",
  ] },
  { id: "F14-first-step", lines: [
    "Die Pausen auf der Arbeit fallen oft aus und ich esse dann irgendwas.",
    "Was könnte ich als allererstes tun? Bitte nur eine Sache.",
  ] },
  { id: "F15-unclear", lines: [
    "Keine Ahnung, ehrlich.",
    "Ich merke nur, dass es so nicht weitergehen soll.",
  ] },
  { id: "F16-no-time", lines: [
    "Ich will etwas verändern, aber für tägliches Training habe ich definitiv keine Zeit.",
    "Was wäre realistisch, ohne dass es noch eine zusätzliche Aufgabe wird?",
  ] },
  { id: "F17-parent-body", lines: [
    "Seit den Kindern stört mich mein Bauch. Ich traue mich kaum noch ins Schwimmbad.",
    "Ich möchte mich wohler fühlen, nicht irgendeinen perfekten Körper.",
  ] },
  { id: "F18-avoid-pressure", lines: [
    "Ich will mehr Energie, aber ich weiß noch nicht, ob ich überhaupt Unterstützung möchte.",
    "Ich muss darüber nachdenken, also bitte kein Verkaufsdruck.",
  ] },
  { id: "F19-direct-question", lines: [
    "Wie unterscheidet sich euer Ansatz von einer klassischen Diät?",
    "Wie integriert ihr Schlaf und Stress, wenn die Kinder nachts aufwachen?",
  ] },
  { id: "F20-complaint-repair", lines: [
    "Ich bin ständig erschöpft und will nicht noch mehr Pflichten.",
    "Du stellst aber schon wieder eine Frage. Ich will jetzt keine weiteren Fragen.",
  ] },
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
      leadId: "qa-20261021-" + entry.id,
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
    leadId: "qa-20261021-" + entry.id,
    campaignId: DEFAULT_CAMPAIGN_ID, messageText: entry.text,
    conversationMode: "natural",
  });
  const source = String(out.state.answers.peteReplySource ?? "unknown");
  if (source === "llm") throw new Error("Safety text unexpectedly reached model: " + entry.id);
  console.log("SAFETY " + entry.id + " | source=" + source + " | reply=" + JSON.stringify(out.text));
}
const budget = getPeteBudgetStatusSafe();
if (!budget.ok || budget.committedUsd > 2 || budget.labAuthorizedUsd !== 2) {
  throw new Error("QA budget status inconsistent");
}
const output = {
  version: 1, kind: "synthetic_real_openai_qa_20261021",
  model: "gpt-4.1-mini", totalCases: cases.length, modelResponses,
  nonModelResponses, budget, cases: results,
};
const reportsDir = path.join(workDir, "qa-reports");
fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(path.join(reportsDir, "pete-quality-20261021.json"),
  JSON.stringify(output, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
console.log("SUMMARY: " + JSON.stringify({
  cases: cases.length, modelResponses, nonModelResponses, committedUsd: budget.committedUsd,
  requestsMetered: budget.requestsMetered,
}));
// Do not call this an A- grade; a separate qualitative review is required.
if (modelResponses < 20) throw new Error("Fewer than 20 model-generated turn replies in 20 QA cases");
