import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// Synthetic, deterministic quality checks. No GPT or provider calls.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pete-phase2-verified-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = tmp;
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { OFFER_TRUTH } = await import("./offer-truth.js");
const { clearConversationStore } = await import("../data/store.js");

async function send(leadId: string, messageText: string) {
  return processIncomingMessage({
    leadId, campaignId: DEFAULT_CAMPAIGN_ID, messageText,
    conversationMode: "natural",
  });
}

test("Phase 2: blue facts and human handoff remain truthful in natural Pete", async t => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  await t.test("Pete instruction set keeps four communication needs distinct", async () => {
    const { buildPeteEffectiveInstructions } = await import("../core/pete-llm-conversation.js");
    const instructions = buildPeteEffectiveInstructions();
    for (const label of [
      "BLAU (Struktur/Fakten)",
      "GRÜN (Sicherheit/Vertrauen)",
      "ROT (Ziel/Tempo)",
      "GELB (Bild/Gefühl)",
    ]) assert.ok(instructions.includes(label), label);
    assert.match(instructions, /KEIN DM-COACHING/);
    assert.match(instructions, /Keine ungefragte Angebots- oder Terminwahl/);
  });

  await t.test("coaching scope receives a direct bounded factual answer", async () => {
    const result = await send("phase2-blue-scope", "Was beinhaltet das 5-Wochen-Coaching?");
    assert.match(result.text || "", /5-Wochen-Startphase/);
    assert.match(result.text || "", /Fitness/);
    assert.match(result.text || "", /Ernährung/);
    assert.match(result.text || "", /Schlaf und Stress/);
    assert.ok(result.text?.includes(OFFER_TRUTH.coachingEntry.infoUrl));
    assert.doesNotMatch(result.text || "", /(?:^|\n)\s*[abcde]\)|garantiert|jede woche \d+ (?:stunden|termine)/i);
    assert.doesNotMatch(result.text || "", /14,95\s*€/);
  });

  await t.test("direct new factual question overrides an earlier conversational phase", async () => {
    await send("phase2-blue-shift", "Ich habe bisher schon viel probiert.");
    const result = await send("phase2-blue-shift", "Wie läuft die 5-Wochen-Begleitung ab?");
    assert.match(result.text || "", /5-Wochen-Startphase/);
    assert.ok(result.text?.includes(OFFER_TRUTH.coachingEntry.infoUrl));
    assert.doesNotMatch(result.text || "", /Woran ist es bisher|bisher probiert|Woran hakt es/);
  });

  await t.test("combined scope and explicit price question uses verified price", async () => {
    const result = await send("phase2-blue-red", "Wie läuft die 5-Wochen-Begleitung ab und was kostet sie?");
    assert.match(result.text || "", /5-Wochen-Startphase/);
    assert.ok(result.text?.includes(OFFER_TRUTH.coachingEntry.priceText));
    assert.doesNotMatch(result.text || "", /14,95\s*€|Raten|Rabatt/i);
  });

  await t.test("personal takeover does not promise when Jochen will reply", async () => {
    const first = await send("phase2-human", "Ich möchte mit Jochen sprechen.");
    assert.match(first.text || "", /hier persönlich übernimmt/);
    const accepted = await send("phase2-human", "Hier im Chat bitte.");
    assert.equal(accepted.state.owner, "human");
    assert.equal(accepted.state.aiPaused, true);
    assert.match(accepted.text || "", /an Jochen weiter/);
    assert.doesNotMatch(accepted.text || "", /er meldet sich|wird (?:heute|morgen) antworten|in \d+ minuten/i);
    const later = await send("phase2-human", "Hallo, ist da jemand?");
    assert.equal(later.text, null);
    assert.equal(later.replySuppressedReason, "human_owned");
  });
});
