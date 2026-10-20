/**
 * One-time 20-scenario REAL Pete LLM acceptance candidate.
 *
 * Uses the REAL OpenAI Responses API through Pete's normal conversation engine.
 * No stubbed provider, no direct handcrafted assistant messages, no real leads.
 * Provider calls are strictly allowed only to api.openai.com/v1/responses.
 *
 * The GitHub workflow must FIRST reserve $2 in the durable shared project ledger.
 * The local budget is independently checked before EVERY network request.
 * The report distinguishes real LLM outputs from deterministic safety/transaction
 * responses, and never claims rule-based replies are GPT.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const REQUIRED = {
  GITHUB_ACTIONS: "true",
  PETE_REAL20_APPROVAL: "USER_APPROVED_2026_10_20_2USD",
  PETE_REAL20_MAX_MICRO_USD: "2000000",
  NODE_ENV: "test",
  OPENAI_MODEL: "gpt-4.1-mini",
  PETE_LLM_CONVERSATION_ENABLED: "true",
  PETE_LLM_API_CALLS_APPROVED: "true",
  WHATSAPP_SEND_ENABLED: "false",
  INSTAGRAM_SEND_ENABLED: "false",
  INSTAGRAM_ENGINE_ENABLED: "false",
  INSTAGRAM_AUTO_ENABLE_NEW_LEADS: "false",
  WHATSAPP_ALLOW_ALL_RECIPIENTS: "false",
  INSTAGRAM_ALLOW_ALL_SENDERS: "false",
  ENABLE_GENERIC_WEBHOOKS: "false",
};
for (const [name, value] of Object.entries(REQUIRED)) {
  if (process.env[name] !== value) throw Error("REAL20 unsafe/missing env: " + name);
}
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.length < 15) {
  throw Error("REAL20 missing OpenAI credential. No paid call attempted.");
}
const dataDir = path.resolve(process.cwd(), ".real20-data");
if (path.resolve(process.env.DATA_DIR || "") !== dataDir ||
    fs.existsSync(path.join(dataDir, "pete-api-budget.json"))) {
  throw Error("REAL20 unexpected/reused isolated data directory");
}
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { writeSettings } = await import("../services/settings-store.js");
const { getPeteBudgetStatusSafe } = await import("../services/pete-api-budget.service.js");
const { isPeteLlmReadyForProvider } = await import("../core/pete-llm-conversation.js");
writeSettings({ aiEnabled: true });
assert.equal(isPeteLlmReadyForProvider(), true);

const originFetch = globalThis.fetch;
let realProviderRequests = 0;
const MAX_USD = 2;
globalThis.fetch = async (url, init) => {
  if (String(url) !== "https://api.openai.com/v1/responses") {
    throw Error("REAL20 outbound provider network denied: " + String(url));
  }
  const current = getPeteBudgetStatusSafe();
  if (!current.ok || current.committedUsd > MAX_USD ||
      current.reservedUsd > MAX_USD || realProviderRequests >= 200) {
    throw Error("REAL20 local $2 cap reached or ledger invalid, no API send");
  }
  const payload = JSON.parse(String(init?.body || "{}"));
  if (payload.model !== "gpt-4.1-mini" || payload.store !== false ||
      payload.max_output_tokens !== 400) {
    throw Error("REAL20 unexpected model/payload");
  }
  realProviderRequests++;
  return originFetch(url, init);
};

type Scenario = {
  id: string;
  category: string;
  lines: string[];
  expect?: Array<"llm" | "verified_transaction" | "human_handoff" | "deterministic" | "guarded_safety" | "any">;
  noSales?: boolean;
  noMoreQuestionsAt?: number;
  noTrainingPitch?: boolean;
  stopAt?: number;
};
const cases: Scenario[] = [
  {
    id: "01-fatigue", category: "stressed_parent", noSales: true,
    lines: [
      "Hi, ich bin Mama von zwei Kindern, arbeite Vollzeit und bin abends total platt.",
      "Abends schlafe ich manchmal mit den Kindern auf dem Sofa ein.",
    ],
    expect: ["llm", "llm"],
  },
  {
    id: "02-no-more-plans", category: "boundaries", noSales: true, noMoreQuestionsAt: 2,
    lines: [
      "Ich bin Alleinerziehende, mein Alltag ist gerade komplett voll.",
      "Bitte keinen weiteren Plan. Ich schaffe gerade nicht noch eine Aufgabe.",
      "Ich brauche gerade keine Fragen und keinen Tipp. Lass das einfach so stehen.",
    ], expect: ["llm", "llm", "llm"],
  },
  {
    id: "03-stopfe", category: "stop_false_positive", noTrainingPitch: true,
    lines: [
      "Ich bin 42, habe zwei Kinder, arbeite Schicht und trainiere viermal pro Woche. Nur das Essen klappt nicht.",
      "Ich nehme Essen mit, aber Pausen fallen oft aus. Abends stopfe ich dann irgendwas in mich rein. Trainieren ist nicht mein Problem.",
    ], expect: ["llm", "llm"],
  },
  {
    id: "04-shift-followup", category: "context", noTrainingPitch: true,
    lines: [
      "Sport ist schon gut geplant. Wegen wechselnder Nachtschichten komme ich beim Essen kaum hinterher.",
      "Das Essen ist vorbereitet, aber ich habe im Dienst oft keine Pause dafür.",
      "Was hast du denn jetzt konkret verstanden?",
    ], expect: ["llm", "llm", "llm"],
  },
  {
    id: "05-follower", category: "cold_entry", noSales: true,
    lines: ["Hi, dein Reel wurde mir angezeigt.", "Ich wollte eigentlich nur mal schauen."],
    expect: ["llm", "llm"],
  },
  {
    id: "06-energy-no-coaching", category: "no_pitch", noSales: true,
    lines: [
      "Seit dem dritten Kind bin ich müde, aber ich suche aktuell kein Coaching.",
      "Ich möchte einfach verstehen, worum es auf deinem Profil geht.",
    ], expect: ["llm", "llm"],
  },
  {
    id: "07-first-step", category: "concrete_answer",
    lines: [
      "Meine Pausen auf Schicht sind unvorhersehbar, deshalb esse ich oft zu spät.",
      "Was wäre da ein erster kleiner Schritt, ohne einen riesigen Plan?",
    ], expect: ["llm", "llm"],
  },
  {
    id: "08-short-replies", category: "short_lead",
    lines: ["Bin Vater, wenig Schlaf.", "Jo.", "Mehr Energie."],
    expect: ["llm", "llm", "llm"],
  },
  {
    id: "09-no-paid-offer", category: "paid_refusal", noSales: true,
    lines: [
      "Ich habe sehr wenig Geld. Bitte keine kostenpflichtigen Angebote, auch keinen günstigen Einstieg.",
      "Ich möchte einfach nur lesen, nicht kaufen.",
    ], expect: ["any", "any"],
  },
  {
    id: "10-real-stop", category: "hard_stop", stopAt: 1, noSales: true,
    lines: ["Bitte nicht mehr schreiben. Keine Nachfragen und kein Nachfassen."],
    expect: ["guarded_safety"],
  },
  {
    id: "11-no-sales-followup", category: "followup_opt_out", noSales: true,
    lines: [
      "Deine Inhalte finde ich interessant, aber ich möchte keine Werbenachrichten und kein Nachfassen.",
      "Ich melde mich selbst, wenn ich etwas wissen will.",
    ], expect: ["any", "any"],
  },
  {
    id: "12-price", category: "verified_facts",
    lines: ["Was kostet deine 5-Wochen-Begleitung?"],
    expect: ["verified_transaction"],
  },
  {
    id: "13-keto-guide", category: "verified_resource",
    lines: ["Kannst du mir bitte den Keto Guide schicken?"],
    expect: ["verified_transaction"],
  },
  {
    id: "14-elterncheck", category: "verified_resource",
    lines: ["Ich möchte gern den Elterncheck machen. Wo ist der Link?"],
    expect: ["verified_transaction"],
  },
  {
    id: "15-bot-identity", category: "honesty",
    lines: ["Wer schreibt mir hier? Bist du eine KI?"],
    expect: ["deterministic"],
  },
  {
    id: "16-human", category: "handoff",
    lines: ["Ich möchte, dass Jochen hier im Chat persönlich übernimmt."],
    expect: ["human_handoff"],
  },
  {
    id: "17-complaint", category: "repair", noMoreQuestionsAt: 1,
    lines: [
      "Ich habe wenig Zeit zum Essen, obwohl ich mein Essen immer mitnehme.",
      "Jetzt hast du mich wieder gefragt. Ich will nicht schon wieder Fragen beantworten.",
    ], expect: ["llm", "llm"],
  },
  {
    id: "18-no-exercise-fix", category: "workout_context", noTrainingPitch: true,
    lines: [
      "Ich gehe fünfmal die Woche ins Gym und fühle mich fit, aber meine Mahlzeiten geraten durcheinander.",
      "Ich brauche keinen Trainingsplan. Ich brauche mehr Verlässlichkeit beim Essen.",
    ], expect: ["llm", "llm"],
  },
  {
    id: "19-self-doubt", category: "empathy", noSales: true,
    lines: [
      "Ich habe schon so viel ausprobiert und denke langsam, ich bin einfach undiszipliniert.",
      "Mit Kindern bleibt nie etwas lange genug gleich, damit ich dranbleibe.",
    ], expect: ["llm", "llm"],
  },
  {
    id: "20-context-switch", category: "switch",
    lines: [
      "Ich bin vom Schichtdienst total ausgelaugt. Abends reicht die Energie kaum für die Familie.",
      "Danke. Jetzt brauche ich nur die sachliche Info: Was kostet die Startphase?",
    ], expect: ["llm", "verified_transaction"],
  },
];
assert.equal(cases.length, 20);
const results: Array<Record<string, unknown>> = [];
let totalRated = 0;
let totalPoints = 0;
let critical = 0;
let providerFailure = false;
const badSales = /selbststarter|14,95|499\s*€|coaching\s*(?:buchen|kaufen)|jetzt\s*(?:kaufen|buchen)|hier\s*(?:kaufen|buchen)/i;
const workoutPitch = /(?:neuen?|zus[aä]tzlichen?)\s*(?:training|trainingsplan|workout)|\bmehr\s+sport\b/i;
for (const spec of cases) {
  const id = "qa-real20-" + spec.id;
  const turns = [];
  let score = 5;
  let failed = false;
  for (let i = 0; i < spec.lines.length; i++) {
    const before = getPeteBudgetStatusSafe();
    const outcome = await processIncomingMessage({
      leadId: id, campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: spec.lines[i], conversationMode: "natural",
    });
    const after = getPeteBudgetStatusSafe();
    const replySource = String(outcome.state.answers.peteReplySource ?? "unverified");
    const reply = String(outcome.text || "");
    const wanted = spec.expect?.[i] || "llm";
    const errors: string[] = [];
    if (wanted !== "any" && replySource !== wanted) {
      errors.push("wrong_source_wanted_" + wanted + "_got_" + replySource);
      score = Math.min(score, 2);
    }
    if (replySource === "llm" && !(after.ok && before.ok &&
        after.requestsMetered > before.requestsMetered)) {
      errors.push("llm_without_new_metered_provider_usage");
      score = 0;
      critical++;
    }
    if (replySource !== "llm" && after.ok && before.ok &&
        after.requestsStarted > before.requestsStarted) {
      errors.push("unexpected_provider_request_for_rule_response");
      score = 0;
      critical++;
    }
    if ((reply.match(/\?/g) || []).length > 1) {
      errors.push("multiple_questions");
      score = Math.min(score, 3);
    }
    if (spec.noMoreQuestionsAt !== undefined && i >= spec.noMoreQuestionsAt && /\?/.test(reply)) {
      errors.push("asked_after_boundary");
      score = Math.min(score, 2);
    }
    if (spec.noSales && badSales.test(reply)) {
      errors.push("unwanted_paid_offer");
      score = 0;
      critical++;
    }
    if (spec.noTrainingPitch && workoutPitch.test(reply)) {
      errors.push("wrong_training_pivot");
      score = Math.min(score, 2);
    }
    if (spec.stopAt === i && !outcome.state.flags.stopped) {
      errors.push("stop_not_persisted");
      score = 0;
      critical++;
    }
    if (replySource === "llm_handoff" && outcome.state.answers.peteLlmFailureReason === "provider_unavailable") {
      errors.push("provider_unavailable");
      providerFailure = true;
      score = 0;
    }
    turns.push({
      lead: spec.lines[i], reply, source: replySource,
      metered: after.ok ? after.requestsMetered : null,
      warnings: errors,
      flags: { stopped: !!outcome.state.flags.stopped,
        noSalesFollowups: !!outcome.state.flags.salesFollowUpsOptedOut },
    });
    if (errors.length) failed = true;
    if (providerFailure) break;
  }
  totalRated++;
  totalPoints += score;
  const result = { id: spec.id, category: spec.category, score, failed, turns };
  results.push(result);
  console.log("PETE_REAL20_CASE " + JSON.stringify(result));
  if (providerFailure) break;
}
const budget = getPeteBudgetStatusSafe();
const scoredPasses = results.filter(item => Number(item.score) >= 4).length;
const output = {
  version: 1, date: "2026-10-20", engine: "Pete's processIncomingMessage",
  model: "gpt-4.1-mini", actualProviderRequests: realProviderRequests,
  completedScenarios: totalRated, scenariosPassedAuto: scoredPasses,
  autoPoints: totalPoints, maxAutoPoints: totalRated * 5,
  critical, providerFailure,
  qaDisclosure: "Auto-score is only a triage signal, not a verified A-minus human evaluation.",
  budget, results,
};
fs.writeFileSync(path.join(dataDir, "real20-report.json"), JSON.stringify(output, null, 2),
  { encoding: "utf8", mode: 0o600 });
console.log("PETE_REAL20_SUMMARY " + JSON.stringify({
  completedScenarios: totalRated, scenariosPassedAuto: scoredPasses,
  autoPoints: totalPoints, critical, providerFailure,
  actualProviderRequests: realProviderRequests,
  billedUsd: budget.ok ? budget.committedUsd : null,
  claim: "No A-minus until independent manual review of full synthetic transcripts",
}));
if (providerFailure || !budget.ok || budget.committedUsd > 2 ||
    totalRated !== 20 || critical > 0) process.exitCode = 1;
