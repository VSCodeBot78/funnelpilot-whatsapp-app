import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const testDataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "funnel-pilot-conversation-matrix-"),
);

process.env.NODE_ENV = "test";
process.env.DATA_DIR = testDataDir;
delete process.env.OPENAI_API_KEY;

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");

async function send(leadId: string, messageText: string) {
  return processIncomingMessage({
    leadId,
    campaignId: DEFAULT_CAMPAIGN_ID,
    messageText,
  });
}

test("Phase 7 pre-live conversation matrix", async (t) => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });

  await t.test("explicit Selfstarter request routes to 14,95 EUR, never 499 EUR", async () => {
    clearConversationStore();

    const result = await send(
      "matrix-selfstarter",
      "Was kostet der Selbststarter?",
    );

    assert.equal(result.detectedIntent, "selfstarter_interest");
    assert.match(result.text ?? "", /14,95 €/);
    assert.match(
      result.text ?? "",
      /no-bullshit-elternfitness-selbststarter/,
    );
    assert.doesNotMatch(result.text ?? "", /499 €/);
  });

  await t.test("explicit Elterncheck request returns the Elterncheck link end-to-end", async () => {
    clearConversationStore();

    const result = await send(
      "matrix-elterncheck",
      "Schick mir den Elterncheck",
    );

    assert.equal(result.detectedIntent, "info_link_only");
    assert.match(result.text ?? "", /Elterncheck/i);
    assert.match(result.text ?? "", /check\.jochen-kammerer\.de/);
    assert.equal(result.state.currentStep, "info_only");
  });

  await t.test("explicit Keto Guide request returns the Keto Guide link end-to-end", async () => {
    clearConversationStore();

    const result = await send(
      "matrix-keto-guide",
      "Schick mir den Keto Guide",
    );

    assert.equal(result.detectedIntent, "info_link_only");
    assert.match(result.text ?? "", /Keto Guide/i);
    assert.match(result.text ?? "", /jochen-kammerer\.de\/keto-guide\//);
    assert.equal(result.state.currentStep, "info_only");
  });

  await t.test("hard affordability limit routes away from 499 EUR to Selfstarter", async () => {
    clearConversationStore();

    const result = await send(
      "matrix-budget",
      "Das kann ich mir gerade nicht leisten",
    );

    assert.equal(result.detectedIntent, "price_question");
    assert.match(result.text ?? "", /14,95 €/);
    assert.match(result.text ?? "", /Selbststarter/i);
    assert.match(
      result.text ?? "",
      /no-bullshit-elternfitness-selbststarter/,
    );
    assert.match(result.text ?? "", /keinen Sinn.*499/s);
    assert.equal(result.state.flags.wantsInfoOnly, true);
    assert.equal(result.state.currentStep, "info_only");
    assert.equal(result.state.flags.wantsBooking, false);
  });

  await t.test("nutrition-plan request never promises or sells an isolated meal plan", async () => {
    clearConversationStore();

    const result = await send(
      "matrix-nutrition-plan",
      "Kannst du mir einen individuellen Ernährungsplan machen?",
    );

    assert.match(result.text ?? "", /nicht einfach raus/i);
    assert.match(result.text ?? "", /keinen isolierten Plan/i);
    assert.match(result.text ?? "", /Begleitung.*Struktur.*Umsetzung/s);
    assert.doesNotMatch(result.text ?? "", /schicke dir.*Ernährungsplan/i);
    assert.doesNotMatch(result.text ?? "", /verkaufe dir.*Ernährungsplan/i);
  });

  await t.test("identity question is answered honestly", async () => {
    clearConversationStore();

    const result = await send(
      "matrix-identity",
      "Bist du eine KI oder schreibt Jochen persönlich?",
    );

    assert.match(result.text ?? "", /Ich bin Pete/i);
    assert.match(result.text ?? "", /KI-Assistent/i);
    assert.match(result.text ?? "", /Jochen/i);
  });

  await t.test("direct price demand answers with current prices instead of dodging", async () => {
    clearConversationStore();

    const result = await send(
      "matrix-direct-price",
      "Sag mir jetzt den Preis",
    );

    assert.equal(result.detectedIntent, "price_question");
    assert.match(result.text ?? "", /499 €/);
    assert.match(result.text ?? "", /14,95 €/);
    assert.doesNotMatch(result.text ?? "", /2\.499|2499|2\.000|2000/);
    assert.doesNotMatch(result.text ?? "", /Eltern-Energie-Startphase/i);
  });

  await t.test("installment request goes to personal clarification without invented rate", async () => {
    clearConversationStore();

    const result = await send(
      "matrix-installments",
      "Kann ich das in Raten zahlen?",
    );

    assert.equal(result.detectedIntent, "price_question");
    assert.equal(result.state.currentStep, "booking");
    assert.equal(result.state.flags.wantsBooking, true);
    assert.match(result.text ?? "", /Ratenzahlung/i);
    assert.doesNotMatch(result.text ?? "", /\d+\s*€\s*(pro|im)\s*Monat/i);
    assert.doesNotMatch(result.text ?? "", /Rabatt/i);
  });

  await t.test("human request routes to booking / Jochen instead of pretending to be Jochen", async () => {
    clearConversationStore();

    const result = await send(
      "matrix-human",
      "Ich möchte direkt mit Jochen sprechen",
    );

    assert.equal(result.detectedIntent, "booking_intent");
    assert.equal(result.state.currentStep, "booking");
    assert.equal(result.state.flags.wantsBooking, true);
    assert.match(result.text ?? "", /Strategiegespräch|Termin/i);
    assert.doesNotMatch(result.text ?? "", /ich bin Jochen/i);
  });

  await t.test("hard stop is final and automation stays stopped", async () => {
    clearConversationStore();

    const stopped = await send(
      "matrix-stop",
      "Bitte nicht mehr schreiben",
    );

    assert.equal(stopped.detectedIntent, "stop");
    assert.equal(stopped.state.flags.stopped, true);
    assert.equal(stopped.state.currentStep, "done");

    const later = await send("matrix-stop", "Hallo?");
    assert.equal(later.state.flags.stopped, true);
    assert.equal(later.replySuppressedReason, "stopped");
    assert.ok(later.text === null || later.text === "");
  });
});
