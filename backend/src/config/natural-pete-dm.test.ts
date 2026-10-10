import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-natural-dm-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
delete process.env.OPENAI_API_KEY;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");
const { getNaturalConversationReply } = await import("../core/natural-conversation.js");

async function send(id: string, messageText: string) {
  return processIncomingMessage({
    leadId: id, campaignId: DEFAULT_CAMPAIGN_ID,
    messageText, conversationMode: "natural",
  });
}
test("Phase 24 natural IG DM short response, pricing, objections, human handoff and health boundaries", async t => {
  t.after(() => { clearConversationStore(); fs.rmSync(dir, { recursive: true, force: true }); });

  await t.test("no-time is addressed in parent context, not instantly a lead magnet", async () => {
    const a = await send("natural-time", "Ich habe keine Zeit für Sport.");
    assert.match(a.text || "", /Job, Kinder und Alltag/);
    assert.match(a.text || "", /10–20 Minuten/);
    assert.doesNotMatch(a.text || "", /Elterncheck|a\)|b\)|c\)/i);
    const b = await send("natural-time", "10 Minuten gingen schon.");
    assert.match(b.text || "", /bisher probiert/i);
  });

  await t.test("ambiguous price asks which product, then only coaching price", async () => {
    const a = await send("natural-price", "Sag mir jetzt den Preis");
    assert.match(a.text || "", /5-Wochen-Begleitung oder den Selbststarter/);
    assert.doesNotMatch(a.text || "", /2\.499|499 €/);
    const b = await send("natural-price", "Die persönliche Begleitung");
    assert.match(b.text || "", /499 €/);
    assert.doesNotMatch(b.text || "", /14,95|2\.499/);
  });

  await t.test("budget asks for the real objection before a selfstarter offer", async () => {
    const a = await send("natural-budget", "Das kann ich mir nicht leisten");
    assert.match(a.text || "", /wirklich der Preis das Problem/);
    assert.doesNotMatch(a.text || "", /14,95/);
    const b = await send("natural-budget", "Ja, finanziell geht das gerade nicht.");
    assert.match(b.text || "", /Selbststarter/);
    assert.match(b.text || "", /14,95/);
  });

  await t.test("human takeover means Inbox, not Calendly without agreement", async () => {
    const a = await send("natural-human", "Ich möchte direkt mit Jochen sprechen");
    assert.match(a.text || "", /hier persönlich übernimmt/);
    assert.doesNotMatch(a.text || "", /calendly\.com/);
    const b = await send("natural-human", "Hier im Chat bitte");
    assert.equal(b.state.owner, "human");
    assert.equal(b.state.aiPaused, true);
    assert.equal(b.state.flags.peteRuntimeHandoffRequested, true);
    const c = await send("natural-human", "Hallo?");
    assert.equal(c.text, null);
    assert.equal(c.replySuppressedReason, "human_owned");
  });

  await t.test("explicit strategy appointment still offers booking without false confirmation", async () => {
    const a = await send("natural-appointment", "Ich möchte ein Strategiegespräch buchen");
    assert.match(a.text || "", /calendly\.com/);
    assert.equal(a.state.flags.wantsBooking, true);
    assert.notEqual(a.state.providerBooking.status, "booked");
  });

  await t.test("third objection family: past failures are explored not immediately closed", async () => {
    const a = await send("natural-past", "Ich habe schon alles versucht und wieder aufgehört");
    assert.match(a.text || "", /Dranbleiben/);
    assert.match(a.text || "", /Woran/);
    assert.doesNotMatch(a.text || "", /calendly|Selbststarter|a\)|b\)/i);
    const b = await send("natural-past", "Ich bin nach der Arbeit meistens zu platt");
    assert.match(b.text || "", /selbst mit einem klaren Plan/);
  });

  await t.test("thinking objection is permission-based rather than pressure closing", async () => {
    const a = await send("natural-think", "Ich muss überlegen");
    assert.match(a.text || "", /nimm dir die Zeit/);
    assert.doesNotMatch(a.text || "", /calendly|14,95|499/);
    const b = await send("natural-think", "Es passt gerade nicht");
    assert.match(b.text || "", /dann lassen wir das erstmal so/);
    assert.doesNotMatch(b.text || "", /calendly/);
  });

  await t.test("no budget and explicit price request do not bypass budget clarification", async () => {
    const a = await send("natural-price-budget", "Kein Budget, wie teuer ist das?");
    assert.match(a.text || "", /wirklich der Preis das Problem/);
    assert.doesNotMatch(a.text || "", /499 €|14,95 €/);
  });

  await t.test("Keto personalized coaching remains normal 499 EUR five-week coaching", async () => {
    const a = await send("natural-keto", "Ich möchte Unterstützung beim Keto-Coaching");
    assert.match(a.text || "", /5-Wochen-Begleitung/);
    assert.doesNotMatch(a.text || "", /keto-guide/);
    const b = await send("natural-keto", "Ich schaffe es im Alltag nicht durchzuhalten");
    assert.match(b.text || "", /Woran hakt es/i);
    const c = await send("natural-keto", "Meine Arbeit und die Schichten");
    assert.match(c.text || "", /selbst mit einem klaren Plan/);
    const d = await send("natural-keto", "Ich möchte Begleitung, damit ich dranbleibe");
    assert.match(d.text || "", /persönliche Begleitung/);
    const e = await send("natural-keto", "Mehr Energie und sicher Keto umsetzen");
    assert.match(e.text || "", /499 €/);
    assert.doesNotMatch(e.text || "", /2\.499/);
  });

  await t.test("Keto PDF request is a free guide with PDF and hearing version", async () => {
    const a = await send("natural-guide", "Schick mir den Keto Guide");
    assert.match(a.text || "", /kostenlos/);
    assert.match(a.text || "", /PDF/);
    assert.match(a.text || "", /Hörversion/);
    assert.match(a.text || "", /jochen-kammerer\.de\/keto-guide/);
  });

  await t.test("parent mentioning two kids is not interrogated about first name", async () => {
    const a = await send("natural-parent", "Ich bin Papa von zwei Kindern und abends immer platt");
    assert.match(a.text || "", /Kinder, Job und abends komplett leer/);
    assert.doesNotMatch(a.text || "", /Vornamen|a\)|b\)|c\)/i);
    const b = await send("natural-parent", "Der Schlaf ist der Knackpunkt");
    assert.match(b.text || "", /bisher versucht/i);
  });

  await t.test("explicit long-term price is never answered with stale 2499 EUR", async () => {
    const a = await send("natural-longterm", "Was kostet die 6-Monats-Begleitung?");
    assert.doesNotMatch(a.text || "", /2\.499|499 €/);
    assert.match(a.text || "", /klärt Jochen aktuell persönlich/);
  });

  for (const msg of [
    "Ich habe Krebs und möchte Keto Begleitung",
    "Ich habe Epilepsie und nehme Medikamente",
    "Ich möchte meine Chemotherapie mit Keto ersetzen",
    "Ich habe eine Essstörung und brauche einen Plan",
  ]) {
    await t.test("medical stop and handover: " + msg, async () => {
      const a = await send("medical-" + msg.length + "-" + msg.slice(0, 10), msg);
      assert.equal(a.state.flags.peteRuntimeHandoffActive, true);
      assert.doesNotMatch(a.text || "", /499 €|Checkout|keto-guide/i);
    });
  }
  await t.test("STOP still suppresses subsequent replies", async () => {
    const a = await send("natural-stop", "Bitte nicht mehr schreiben");
    assert.equal(a.state.flags.stopped, true);
    const b = await send("natural-stop", "Hallo?");
    assert.equal(b.text, null);
  });
  await t.test("only one question and no a/b/c/D in core natural replies", () => {
    const state: any = { answers: {}, messages: [] };
    for (const msg of [
      "Ich habe keine Zeit für Sport",
      "Das ist mir zu teuer",
      "Ich bin Papa von zwei Kindern und abends immer platt",
      "Ich möchte Keto-Coaching",
      "Ich möchte mit Jochen sprechen",
      "Ich habe zweimal angefangen und dann aufgehört",
    ]) {
      const out = getNaturalConversationReply({ text: msg, state, bookingUrl: "https://calendly.com/test/intro" });
      assert.ok(out);
      assert.ok((out.text.match(/\?/g) || []).length <= 1, msg + ": " + out.text);
      assert.doesNotMatch(out.text, /(?:^|\n)[abcd]\)/im);
    }
  });
});
