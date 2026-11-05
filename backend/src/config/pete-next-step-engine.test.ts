import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-semantic-engine-"));
Object.assign(process.env, {
  NODE_ENV: "test", DATA_DIR: dir,
  INSTAGRAM_ENGINE_ENABLED: "false", INSTAGRAM_SEND_ENABLED: "false",
  WHATSAPP_SEND_ENABLED: "false", PETE_LLM_CONVERSATION_ENABLED: "true",
  PETE_LLM_API_CALLS_APPROVED: "true", OPENAI_MODEL: "gpt-6.1-sol",
  OPENAI_API_KEY: "SYNTHETIC-LOCAL-ONLY-NOT-A-REAL-KEY",
});
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { getConversationState, clearConversationStore } = await import("../data/store.js");
const { takeOverByHuman, persistConversationState } = await import("../core/state-manager.js");
const { writeSettings } = await import("../services/settings-store.js");
const { validatePeteLlmReply } = await import("../core/pete-llm-conversation.js");
const modelPayload = (reply: string, nextStep = "none", evidenceQuote = "", needsHuman = false) => ({
  usage: { input_tokens: 100, output_tokens: 20 },
  output: [{ content: [{ type: "output_text", text: JSON.stringify({ reply, needsHuman, nextStep, evidenceQuote }) }] }],
});
const send = (leadId: string, messageText: string) => processIncomingMessage({
  leadId, campaignId: "eltern-vital-fit", messageText, conversationMode: "natural",
});
const setMock = (payload: unknown, verify?: (body: any) => void) => {
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    verify?.(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(payload), { status: 200 });
  };
};
test("structured next steps are verified inside the existing Pete engine, never sent", async t => {
  const originalFetch = globalThis.fetch;
  writeSettings({ aiEnabled: true });
  t.after(() => {
    globalThis.fetch = originalFetch;
    clearConversationStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await t.test("strict model schema contains an exact evidence quote and no model-authorized link", async () => {
    const text = "Ein Telefonat wäre für mich ein guter nächster Schritt.";
    setMock(modelPayload("Gerne, du kannst selbst einen Zeitpunkt wählen.", "booking", text), body => {
      assert.equal(body.store, false);
      assert.deepEqual(body.text.format.schema.required, ["reply", "needsHuman", "nextStep", "evidenceQuote"]);
      assert.equal(body.text.format.schema.additionalProperties, false);
    });
    const out = await send("semantic-live-engine-booking", text);
    assert.equal(out.state.owner, "ai");
    assert.match(out.text ?? "", /https:\/\/calendly\.com/);
    assert.equal(out.state.answers.peteReplySource, "verified_transaction");
    assert.equal(out.state.answers.peteSemanticNextStep, "booking");
    assert.equal(out.state.providerBooking?.status, "awaiting_booking");
    assert.notEqual(out.state.providerBooking?.status, "booked");
  });
  await t.test("unsupported booking proposal cannot create a link or mute an ordinary lead", async () => {
    const text = "Was wäre bei deiner Begleitung anders, wenn der Alltag dazwischenkommt?";
    setMock(modelPayload("Wir schauen auf den nächsten umsetzbaren Schritt.", "booking", text));
    const out = await send("semantic-live-engine-denied", text);
    assert.equal(out.state.owner, "ai");
    assert.equal(out.state.aiPaused, false);
    assert.equal(out.state.flags.wantsBooking, false);
    assert.equal(out.state.answers.peteSemanticProposalRejected, true);
    assert.equal(out.state.answers.peteReplySource, "llm");
    assert.doesNotMatch(out.text ?? "", /https?:\/\/|buchung.best.tigt/i);
  });
  await t.test("a subsequent fact-only answer clears the rejected-action marker", async () => {
    setMock(modelPayload("Ja, dabei geht es um alltagstaugliche Umsetzung."));
    const out = await send("semantic-live-engine-denied", "Ich möchte erst die Grundlagen verstehen.");
    assert.equal(out.state.owner, "ai");
    assert.equal(out.state.answers.peteSemanticProposalRejected, false);
    assert.equal(out.state.answers.peteSemanticNextStep, undefined);
  });
  await t.test("half-filled and arbitrary model action proposals fail closed", () => {
    const base = { reply: "Gerne.", needsHuman: false };
    assert.ok(validatePeteLlmReply(base));
    for (const proposal of [
      { nextStep: "booking" }, { evidenceQuote: "ich will buchen" },
      { nextStep: "checkout", evidenceQuote: "ich will kaufen" },
      { nextStep: "none", evidenceQuote: "ich will buchen" },
    ]) assert.equal(validatePeteLlmReply({ ...base, ...proposal }), null);
  });
  for (const boundary of ["stop", "human"] as const)
    await t.test("in-flight next step stays silent after " + boundary, async () => {
      const text = "Ein Telefonat wäre für mich ein guter nächster Schritt.";
      let release!: () => void, entered!: () => void;
      const started = new Promise<void>(resolve => { entered = resolve; });
      const waiting = new Promise<void>(resolve => { release = resolve; });
      globalThis.fetch = async url => {
        assert.equal(String(url), "https://api.openai.com/v1/responses");
        entered(); await waiting;
        return new Response(JSON.stringify(modelPayload("Du kannst selbst auswählen.", "booking", text)), { status: 200 });
      };
      const leadId = "semantic-race-" + boundary;
      const pending = send(leadId, text);
      await started;
      const state = getConversationState(leadId, "eltern-vital-fit")!;
      if (boundary === "stop") state.flags.stopped = true;
      else takeOverByHuman(state);
      persistConversationState(state);
      release();
      const out = await pending;
      assert.equal(out.text, null);
      assert.equal(out.replySuppressedReason, boundary === "stop" ? "stopped" : "human_owned");
      assert.equal(out.state.flags.wantsBooking, false);
    });
});
