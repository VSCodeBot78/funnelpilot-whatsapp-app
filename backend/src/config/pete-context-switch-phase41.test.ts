import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// A roleplay of ordinary mothers/fathers, not a real AI/Meta conversation.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-phase41-parent-context-"));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = "test";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");

async function send(leadId: string, text: string) {
  return processIncomingMessage({
    leadId, messageText: text, campaignId: DEFAULT_CAMPAIGN_ID,
    conversationMode: "natural",
  });
}

test("Phase 41: parents can switch topics after Pete offers chat with Jochen", async t => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const cases = [
    {
      role: "Mama wants a free guide instead of a call",
      id: "phase41-guide",
      followUp: "Kein Termin, schick mir lieber den Keto Guide.",
      expected: /keto.guide.*kostenlos|kostenlos.*keto.guide/i,
      forbidden: /calendly\.com|Terminwunsch an Jochen/,
      phase: "info",
    },
    {
      role: "Papa asks a real price question instead of choosing a meeting",
      id: "phase41-price",
      followUp: "Wie teuer ist die 5-Wochen-Begleitung?",
      expected: /499 €/,
      forbidden: /calendly\.com|Strategiegespräch aussuchen/,
      phase: "human_choice",
    },
    {
      role: "Mama chooses check not chat",
      id: "phase41-check",
      followUp: "Nein, lieber erst den Elterncheck schicken.",
      expected: /kostenlosen Elternfitness-Check/,
      forbidden: /calendly\.com|Terminwunsch/,
      phase: "info",
    },
    {
      role: "Papa asks selfstarter instead of a meeting",
      id: "phase41-selfstarter",
      followUp: "Schick mir lieber den Selbststarter.",
      expected: /Selbststarter.*14,95 €/,
      forbidden: /calendly\.com|Terminwunsch/,
      phase: "selfstarter_offered",
    },
    {
      role: "Mama refuses appointment without replacing it by a product",
      id: "phase41-reject",
      followUp: "Nein danke, keinen Termin. Ich will nur Infos.",
      expected: /kein Termin/i,
      forbidden: /calendly\.com|Terminwunsch/,
      phase: "info",
    },
  ] as const;

  for (const scenario of cases) {
    await t.test(scenario.role, async () => {
      clearConversationStore();
      const first = await send(scenario.id, "Kann ich mit Jochen sprechen?");
      assert.equal(first.state.answers.naturalPhase, "human_choice");
      const answer = await send(scenario.id, scenario.followUp);
      assert.match(answer.text || "", scenario.expected);
      assert.doesNotMatch(answer.text || "", scenario.forbidden);
      assert.equal(answer.state.answers.naturalPhase, scenario.phase);
      assert.equal(answer.state.owner, "ai");
      assert.notEqual(answer.state.flags.wantsBooking, true);
      assert.notEqual(answer.state.providerBooking.status, "booked");
      assert.doesNotMatch(answer.text || "", /(?:^|\n)[abcd]\)\s/im);
      console.log("FP_PHASE41_ROLEPLAY " + JSON.stringify({
        role: scenario.role, lead: scenario.followUp, pete: answer.text,
        nextPhase: answer.state.answers.naturalPhase,
        mode: "deterministic, no real OpenAI/Meta",
      }));
    });
  }
});

test("Phase 41: explicit chat and explicit meeting still work", async t => {
  await t.test("Papa asks Jochen in this chat and Pete hands over", async () => {
    const id = "phase41-human";
    await send(id, "Kann ich mit Jochen sprechen?");
    const answer = await send(id, "Hier im Chat bitte.");
    assert.equal(answer.state.owner, "human");
    assert.equal(answer.state.aiPaused, true);
    assert.equal(answer.state.flags.peteRuntimeHandoffRequested, true);
    const next = await send(id, "Hallo?");
    assert.equal(next.text, null);
    assert.equal(next.replySuppressedReason, "human_owned");
  });
  await t.test("Mama asks for genuine strategy appointment", async () => {
    const id = "phase41-booking";
    await send(id, "Kann ich mit Jochen sprechen?");
    const answer = await send(id, "Ich will ein Strategiegespräch vereinbaren.");
    assert.match(answer.text || "", /calendly\.com/);
    assert.equal(answer.state.flags.wantsBooking, true);
    assert.notEqual(answer.state.providerBooking.status, "booked");
  });
});

test("Phase 41: coaching buyer is not sent checkout on an explicit negation", async t => {
  await t.test("Mama asks to think instead of buying directly", async () => {
    const id = "phase41-not-buy";
    const first = await send(id, "Ich möchte die 5-Wochen-Begleitung buchen.");
    assert.equal(first.state.answers.naturalPhase, "coaching_close");
    const answer = await send(id, "Ich will nicht direkt kaufen. Ich muss erst nachdenken.");
    assert.match(answer.text || "", /kein direkter Kauf/i);
    assert.doesNotMatch(answer.text || "", /portal\.nutrilize\.app|calendly\.com/);
    assert.equal(answer.state.answers.naturalPhase, "info");
    assert.notEqual(answer.state.providerBooking.status, "booked");
  });
  await t.test("Papa explicitly asks to buy, checkout remains possible", async () => {
    const id = "phase41-buy";
    await send(id, "Ich möchte die 5-Wochen-Begleitung buchen.");
    const answer = await send(id, "Ich möchte direkt kaufen, ohne Termin.");
    assert.match(answer.text || "", /portal\.nutrilize\.app/);
    assert.equal(answer.state.answers.naturalPhase, "checkout_offered");
    assert.notEqual(answer.state.providerBooking.status, "booked");
  });
  await t.test("Mama wants a conversation before buying, not checkout", async () => {
    const id = "phase41-booking-before-buy";
    await send(id, "Ich möchte die 5-Wochen-Begleitung buchen.");
    const answer = await send(id, "Nicht direkt kaufen, zuerst ein Strategiegespräch.");
    assert.match(answer.text || "", /calendly\.com/);
    assert.doesNotMatch(answer.text || "", /portal\.nutrilize\.app/);
    assert.equal(answer.state.flags.wantsBooking, true);
  });
});
