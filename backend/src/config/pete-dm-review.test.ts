import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-dm-review-"));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = "test";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");
const { isMultiplePeopleIntroduction, parseName } = await import("../domain/name-parser.js");

const samples = [
  ["Selbststarter und Preis", "Was kostet der Selbststarter?"],
  ["Coaching-Gesamtpreis", "Sag mir jetzt den Preis"],
  ["Geld knapp", "Das kann ich mir gerade nicht leisten"],
  ["Zeitmangel", "Ich habe keine Zeit für Sport"],
  ["Ernährungsplan", "Kannst du mir einen individuellen Ernährungsplan machen?"],
  ["Kostenloser Keto Guide", "Schick mir den Keto Guide"],
  ["Misstrauen in KI", "Bist du eine KI oder schreibt Jochen persönlich?"],
  ["Direkter Mensch", "Ich möchte direkt mit Jochen sprechen"],
  ["Unverbindlich und Stress", "Ich bin Papa von zwei Kindern und abends immer platt"],
  ["Untersagung", "Bitte nicht mehr schreiben"],
] as const;

test("Founder review: real deterministic Pete DM answers without paid external API", async (t) => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  for (const [label, message] of samples) {
    clearConversationStore();
    const leadId = "review-" + samples.findIndex(item => item[0] === label);
    const result = await processIncomingMessage({
      leadId,
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: message,
    });
    const answer = result.text ?? "";
    console.log("FP_DM_REVIEW " + JSON.stringify({
      label,
      customerMessage: message,
      peteAnswer: answer,
      intent: result.detectedIntent,
      nextStep: result.nextStep,
      note: "Deterministische Funnel-Engine; kein echter OpenAI API-Aufruf",
    }));
    assert.ok(answer.trim().length > 0, "No reply for " + label);
    assert.doesNotMatch(answer, /ich bin Jochen persönlich/i);
    if (label === "Selbststarter und Preis") {
      assert.match(answer, /14,95/);
      assert.doesNotMatch(answer, /499 €/);
    }
    if (label === "Ernährungsplan") {
      assert.doesNotMatch(answer, /ich schicke dir einen individuellen Ernährungsplan/i);
    }
    if (label === "Untersagung") {
      assert.equal(result.state.flags.stopped, true);
    }
  }
});

test("Founder review: real short natural DM conversation for a parent", async () => {
  clearConversationStore();
  const messages = [
    "Ich bin Max, Papa von zwei Kindern",
    "Ja, leg los",
    "Ich bin abends müde, der Bauch stört mich",
    "Ich habe schon zweimal angefangen und dann aufgehört",
    "Dann wird das wohl wieder so weitergehen",
    "Mehr Energie für die Kinder",
    "Eine 8 von 10",
    "Ich will das jetzt wirklich angehen",
  ] as const;
  for (const message of messages) {
    const result = await processIncomingMessage({
      leadId: "review-parent-journey",
      campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: message,
    });
    console.log("FP_DM_JOURNEY " + JSON.stringify({
      customerMessage: message,
      peteAnswer: result.text,
      nextStep: result.nextStep,
    }));
    assert.ok(result.text || result.replySuppressedReason);
  }
});

test("Parent without first name is not interpreted as a multi-person introduction", async () => {
  clearConversationStore();
  const parentText = "Ich bin Papa von zwei Kindern und abends immer platt";
  assert.equal(isMultiplePeopleIntroduction(parentText), false);
  assert.equal(isMultiplePeopleIntroduction("Max und Lena"), true);
  assert.equal(parseName(parentText), null);

  const first = await processIncomingMessage({
    leadId: "review-parent-intro-no-name",
    campaignId: DEFAULT_CAMPAIGN_ID,
    messageText: parentText,
  });
  assert.equal(first.nextStep, "ask_name");
  assert.doesNotMatch(first.text || "", /falls ihr zu zweit seid/i);
  assert.equal(first.state.answers.parentRole, "papa");

  const second = await processIncomingMessage({
    leadId: "review-parent-intro-no-name",
    campaignId: DEFAULT_CAMPAIGN_ID,
    messageText: "Tom",
  });
  assert.equal(second.nextStep, "intro_ack");
  assert.equal(second.state.answers.parentRole, "papa");

  const third = await processIncomingMessage({
    leadId: "review-parent-intro-no-name",
    campaignId: DEFAULT_CAMPAIGN_ID,
    messageText: "Ja, leg los",
  });
  assert.equal(third.nextStep, "situation_choice");
  console.log("FP_DM_FIXED " + JSON.stringify({
    parentMessage: parentText,
    firstReply: first.text,
    followUpAfterFirstName: second.text,
    afterConsent: third.text,
  }));
});
