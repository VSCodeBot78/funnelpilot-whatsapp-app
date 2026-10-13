import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// All provider calls intercepted. No real API, Instagram or WhatsApp sends.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-phase54-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;
const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { clearConversationStore } = await import("../data/store.js");
const { writeSettings } = await import("../services/settings-store.js");
const { isGeneralNonMedicalKnowledgeRequest, getPeteVerifiedTransactionAnswer,
  isUnsafeLlmClaim } = await import("../core/pete-conversation-quality.js");
const { validatePeteLlmReply, buildPeteContext } = await import("../core/pete-llm-conversation.js");
const { OFFER_TRUTH } = await import("./offer-truth.js");

function enableMock() {
  process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
  process.env.PETE_LLM_API_CALLS_APPROVED = "true";
  process.env.OPENAI_API_KEY = "fixture-only";
  process.env.OPENAI_MODEL = "gpt-4.1-mini";
  writeSettings({ aiEnabled: true });
}
function fake(reply: string) {
  return new Response(JSON.stringify({
    output: [{ content: [{ type: "output_text",
      text: JSON.stringify({ reply, needsHuman: false }) }] }],
    usage: { input_tokens: 500, output_tokens: 120 },
  }), { status: 200 });
}
const send = (leadId: string, messageText: string) =>
  processIncomingMessage({ leadId, campaignId: DEFAULT_CAMPAIGN_ID,
    messageText, conversationMode: "natural" });

test("Phase 54: regression against genuine GPT-5.4 transcript failures", async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    clearConversationStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await t.test("two years after pregnancy remains normal fitness discussion", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++; return fake("Wenn du bereits schwer trainierst, sind Kalorienbilanz, Schlaf und Alltagsbewegung sinnvolle allgemeine Prüfpunkte.");
    };
    const input = "Meine letzte Schwangerschaft ist über zwei Jahre her. Ich trainiere zweimal die Woche schwer, aber das Gewicht bewegt sich kaum.";
    assert.equal(isGeneralNonMedicalKnowledgeRequest(input), true);
    const out = await send("phase54-past-pregnancy", input);
    assert.equal(out.state.owner, "ai");
    assert.equal(out.state.answers.peteReplySource, "llm");
    assert.match(out.text || "", /Kalorienbilanz/);
    assert.equal(calls, 1);
  });
  await t.test("pregnancy that is CURRENT or includes danger remains guarded", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("must not call"); };
    for (const [lead, text] of [
      ["phase54-current-pregnancy", "Ich bin schwanger und möchte eine Keto-Diät anfangen."],
      ["phase54-acute-pregnancy", "Meine letzte Schwangerschaft ist zwei Jahre her, seitdem habe ich Brustschmerzen und Atemnot."],
    ]) {
      const out = await send(lead, text);
      assert.equal(out.state.owner, "human");
      assert.notEqual(out.state.answers.peteReplySource, "llm");
    }
    assert.equal(calls, 0);
  });
  await t.test("bought product and missing access email goes to verified human ownership", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("must not call"); };
    const out = await send("phase54-missing-mail",
      "Ich habe gestern den Selbststarter gekauft, aber finde die Zugangs-Mail nicht.");
    assert.equal(out.state.owner, "human");
    assert.equal(out.state.aiPaused, true);
    assert.equal(out.state.answers.peteReplySource, "verified_transaction");
    assert.match(out.text || "", /Zugangs-Mail/);
    assert.match(out.text || "", /Bestellprüfung/);
    assert.doesNotMatch(out.text || "", /ist bezahlt|ist gebucht/);
    assert.equal(calls, 0);
  });
  await t.test("specific product scope and price do not trigger high-ticket coaching pitch", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("must not call"); };
    const out = await send("phase54-selfstarter",
      "Was ist denn beim Selbststarter enthalten und was kostet er?");
    assert.equal(out.state.answers.peteReplySource, "verified_transaction");
    assert.match(out.text || "", /14,95/);
    assert.doesNotMatch(out.text || "", /499|5-Wochen-Begleitung/);
    assert.match(out.text || "", /Produktseite/);
    assert.equal(calls, 0);
  });
  await t.test("actual duplicate Instagram and WhatsApp replies trigger immediate human handoff", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("must not fetch"); };
    const first = await send("phase54-two-channels",
      "Ich hab euch auf Instagram und WhatsApp geschrieben und bekomme auf beiden Kanälen Antworten.");
    assert.equal(first.state.owner, "human");
    assert.equal(first.state.aiPaused, true);
    assert.equal(first.state.flags.peteRuntimeHandoffActive, true);
    assert.equal(first.state.answers.peteReplySource, "verified_transaction");
    assert.match(first.text || "", /Jochen/);
    assert.match(first.text || "", /anderen Kanal/);
    assert.doesNotMatch(first.text || "", /auch auf WhatsApp pausiert|alles gestoppt/);
    const second = await send("phase54-two-channels",
      "Ich will nicht von zwei Bots gleichzeitig angequatscht werden.");
    assert.equal(second.text, null);
    assert.equal(second.replySuppressedReason, "human_owned");
    assert.equal(calls, 0);
  });
  await t.test("two-bot complaint alone escalates but neutral cross-channel question does not", () => {
    const state = { messages: [] } as any;
    const complaint = getPeteVerifiedTransactionAnswer(
      "Ich werde von zwei Bots gleichzeitig angeschrieben. Das nervt.", state);
    assert.equal(complaint?.handoff, true);
    const neutral = getPeteVerifiedTransactionAnswer(
      "Kann ich auf Instagram und WhatsApp Fragen stellen?", state);
    assert.notEqual(neutral?.handoff, true);
  });
  await t.test("generated promises about dual-channel automation are rejected", () => {
    for (const reply of [
      "Ich schreibe dir nur hier weiter.",
      "Wir halten es ab jetzt hier an einer Stelle.",
      "Die KI stoppt automatisch, wenn Jochen schreibt.",
    ]) {
      assert.equal(isUnsafeLlmClaim(reply), true, reply);
      assert.equal(validatePeteLlmReply({ reply, needsHuman: false }), null);
    }
  });
  await t.test("explicit unverified Calendly payment case still requires human", () => {
    const state = { messages: [], providerBooking: {} } as any;
    const out = getPeteVerifiedTransactionAnswer(
      "Ich habe einen Calendly-Termin gebucht, aber keine Bestätigung bekommen.", state);
    assert.equal(out?.handoff, true);
  });
  await t.test("exact CHECK KETO and BULLSHIT use verified URLs without paid LLM calls", async () => {
    clearConversationStore(); enableMock();
    let providerCalls = 0;
    globalThis.fetch = async () => {
      providerCalls++;
      throw Error("provider must not receive an exact resource keyword");
    };
    for (const [keyword, url] of [
      ["CHECK", OFFER_TRUTH.resources.elterncheck.url],
      ["KETO", OFFER_TRUTH.resources.ketoGuide.url],
      ["BULLSHIT", OFFER_TRUTH.selfstarter.productUrl],
    ]) {
      const reply = await send("phase1-keyword-" + keyword.toLowerCase(), keyword);
      assert.equal(reply.state.answers.peteReplySource, "verified_transaction", keyword);
      assert.equal(reply.state.owner, "ai", keyword);
      assert.ok(reply.text?.includes(url), keyword);
      assert.doesNotMatch(reply.text ?? "", /strategiegespräch|499|jetzt buchen/i);
    }
    assert.equal(providerCalls, 0);
  });

  await t.test("setter role is present in the mocked model instructions", async () => {
    clearConversationStore();
    enableMock();
    let called = 0;
    globalThis.fetch = async (_url, init) => {
      called++;
      const body = JSON.parse(String((init as RequestInit).body));
      assert.match(body.instructions, /KI-DM-Setter/);
      assert.match(body.instructions, /KEIN DM-COACHING/);
      assert.match(body.instructions, /SETTER-LOGIK/);
      return fake("Du hast also wechselnde Pausenzeiten. Was hast du bisher versucht?");
    };
    const r = await send("pete-setter-policy-mock", "Bei Schichtarbeit sind meine Pausen unregelmäßig.");
    assert.equal(r.state.answers.peteReplySource, "llm");
    assert.equal(called, 1);
  });

  await t.test("older lead facts stay quoted when the latest 36 messages omit them", () => {
    const older = [
      { role: "user", text: "Ich arbeite im Schichtdienst. Schreib mir nicht an test@example.com." },
      { role: "assistant", text: "Wie läuft dein Sport?" },
      { role: "user", text: "Sport bekomme ich 4-5 mal die Woche gut unter." },
      { role: "assistant", text: "Was klappt nicht?" },
      { role: "user", text: "Es hängt bei mir eher an der Ernährung." },
    ];
    const newer = Array.from({ length: 50 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user",
      text: index % 2 ? "Danke für die Einordnung." : "Verstehe, okay.",
    }));
    const context = buildPeteContext({
      campaignId: DEFAULT_CAMPAIGN_ID, answers: {}, messages: [...older, ...newer],
    } as any);
    assert.equal(context.conversation.length, 36);
    assert.ok(context.earlierLeadEvidence.some(item =>
      item.topic === "work_and_schedule" && item.excerpt.includes("Schichtdienst")));
    assert.ok(context.earlierLeadEvidence.some(item =>
      item.topic === "movement" && item.excerpt.includes("4-5 mal")));
    assert.ok(context.earlierLeadEvidence.some(item =>
      item.topic === "nutrition" && item.excerpt.includes("Ernährung")));
    const json = JSON.stringify(context);
    assert.ok(json.length <= 12000);
    assert.doesNotMatch(json, /test@example\.com/);
    assert.match(json, /\[E-Mail entfernt\]/);
    assert.doesNotMatch(context.conversation[0]?.text ?? "", /Schichtdienst/);
  });

  await t.test("context size still caps at 12000 characters including older evidence", () => {
    const messages = Array.from({ length: 70 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user",
      text: ("Fragen und Antworten zu Alltag, Training und Ernährung. ").repeat(29),
    }));
    const context = buildPeteContext({
      campaignId: DEFAULT_CAMPAIGN_ID, answers: {}, messages,
    } as any);
    assert.ok(JSON.stringify(context).length <= 12000);
    assert.ok(context.conversation.length >= 1);
  });

  await t.test("realistic shift-work conversation keeps the nutrition blocker in every model request", async () => {
    clearConversationStore(); enableMock();
    const prompts: any[] = [];
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(String((options as RequestInit).body));
      const raw = String(body.input[0].content);
      const marker = "\nBeantworte die letzte Lead-Nachricht.";
      const context = JSON.parse(raw.slice(raw.indexOf("\n") + 1, raw.lastIndexOf(marker)));
      prompts.push(context);
      const replies = [
        "Fitter werden und abnehmen sind verständliche Ziele. Wir müssen nicht alles gleichzeitig verändern.",
        "Beides lässt sich gemeinsam angehen, ohne einen strengen Plan aus dem Alltag zu machen.",
        "Mit Schichtarbeit kann ein festes Zeitschema schwierig sein. Ein flexibler Ansatz passt hier eher.",
        "Du trainierst schon regelmäßig. Bei Schichtarbeit kann die Ernährung im Alltag schwieriger sein. Wann ist das Essen für dich am schwersten zu organisieren?",
      ];
      return fake(replies[prompts.length - 1]);
    };
    const leadId = "phase1-shift-example";
    for (const messageText of [
      "Ich will fitter werden und abnehmen.",
      "Sowohl als auch.",
      "Wenig Zeit wegen Schichtarbeit.",
      "Sport schaffe ich 4-5 mal die Woche, aber die Ernährung ist eher mein Problem.",
    ]) {
      const reply = await send(leadId, messageText);
      assert.equal(reply.state.owner, "ai");
      assert.equal(reply.state.answers.peteReplySource, "llm");
    }
    assert.equal(prompts.length, 4);
    const last = prompts.at(-1);
    assert.ok(last.conversation.some((x: any) => x.text.includes("Schichtarbeit")));
    assert.ok(last.conversation.some((x: any) => x.text.includes("4-5 mal")));
    assert.ok(last.conversation.some((x: any) => x.text.includes("Ernährung")));
    assert.doesNotMatch(JSON.stringify(last), /https?:\/\/api\.openai\.com/);
  });

  await t.test("Bundle CTA after verified BULLSHIT entry sends just the product link", async () => {
    clearConversationStore(); enableMock();
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error("provider not required for verified CTA"); };
    const leadId = "phase1-bundle-cta";
    const entry = await send(leadId, "BULLSHIT");
    assert.ok(entry.text?.includes(OFFER_TRUTH.selfstarter.productUrl));
    const clicked = await send(leadId, "Zeig mir das Bundle");
    assert.equal(clicked.state.answers.peteReplySource, "verified_transaction");
    assert.ok(clicked.text?.includes(OFFER_TRUTH.selfstarter.productUrl));
    assert.ok((clicked.text ?? "").length < 230);
    assert.doesNotMatch(clicked.text ?? "", /wenig zeit|bauchfett|mehr energie|muskelaufbau/i);
    assert.equal(calls, 0);
  });

  await t.test("unrelated Bundle word does not authorize an invented product link", async () => {
    clearConversationStore(); enableMock();
    const fakeLead = "phase1-bundle-unrelated";
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return fake("Meinst du den No Bullshit Elternfitness Selbststarter oder ein anderes Bundle?");
    };
    const out = await send(fakeLead, "Zeig mir das Bundle");
    assert.equal(out.state.answers.peteReplySource, "llm");
    assert.equal(calls, 1);
    assert.doesNotMatch(out.text ?? "", /https?:\/\//);
  });

  await t.test("verified trust texts are compact and contain natural spelling", () => {
    const state = { messages: [] } as any;
    const checkout = getPeteVerifiedTransactionAnswer(
      "Ich hatte im Checkout eine schlechte Erfahrung.", state);
    assert.ok(checkout);
    assert.match(checkout.text, /Kaufübersicht/);
    assert.doesNotMatch(checkout.text, /ungeprueft|fuer|Zusatzkosten-Regeln|garantiert keine/i);
    const hidden = getPeteVerifiedTransactionAnswer(
      "Ich habe Angst vor versteckten Kosten.", state);
    assert.ok(hidden);
    assert.match(hidden.text, /Kaufübersicht/);
    assert.doesNotMatch(hidden.text, /Zusatzkosten-Regeln|ungeprueft/);
    assert.equal(hidden.handoff, undefined);
  });

});
