import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-direct-buy-branches-"));
Object.assign(process.env, {
  NODE_ENV: "test", DATA_DIR: tempDir,
  INSTAGRAM_ENGINE_ENABLED: "false", INSTAGRAM_SEND_ENABLED: "false",
  WHATSAPP_SEND_ENABLED: "false", PETE_LLM_CONVERSATION_ENABLED: "false",
  PETE_LLM_API_CALLS_APPROVED: "false",
});
delete process.env.OPENAI_API_KEY;

const { DEFAULT_CAMPAIGN_ID } = await import("./campaigns.js");
const { processIncomingMessage } = await import("../core/conversation-engine.js");
const { getOrCreateConversationState, patchFlags, setCurrentStep,
  persistConversationState } = await import("../core/state-manager.js");
const { clearConversationStore } = await import("../data/store.js");

test("both legacy coaching-entry direct-buy triggers share identical safe state transition", async t => {
  const oldFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("No network permitted"); };
  t.after(() => {
    globalThis.fetch = oldFetch;
    clearConversationStore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const run = async (id: string, askedPrice: boolean, flags: Record<string, boolean> = {}, text = "kauf ich direkt") => {
    const state = getOrCreateConversationState(id, DEFAULT_CAMPAIGN_ID);
    setCurrentStep(state, "situation_choice");
    patchFlags(state, { askedPrice, ...flags });
    persistConversationState(state);
    const out = await processIncomingMessage({
      leadId: id, campaignId: DEFAULT_CAMPAIGN_ID,
      messageText: text,
    });
    return {
      reply: out.text,
      intent: out.detectedIntent,
      step: out.nextStep,
      flags: {
        directBuyEntry: out.state.flags.wantsDirectBuyCoachingEntry,
        directBuyStarter: out.state.flags.wantsDirectBuyStarter,
        booking: out.state.flags.wantsBooking,
        stopped: out.state.flags.stopped,
      },
      owner: out.state.owner,
      bookingStatus: out.state.providerBooking?.status,
    };
  };

  await t.test("asked-price route and direct-intent route are behavior-identical", async () => {
    const afterPrice = await run("buy-price-branch", true);
    const direct = await run("buy-direct-intent-branch", false, {}, "direkt kaufen");
    assert.deepEqual(afterPrice, direct);
    assert.equal(direct.intent, "direct_buy_coaching_entry");
    assert.equal(direct.flags.directBuyEntry, true);
    assert.equal(direct.flags.directBuyStarter, true);
    assert.equal(direct.owner, "ai");
    assert.equal(direct.flags.stopped, false);
    assert.equal(direct.bookingStatus, "inactive");
    assert.equal(requests, 0);
  });
  await t.test("installments require booking, not automatic checkout or confirmed slot", async () => {
    const out = await run("buy-installments", true, { askedInstallments: true });
    assert.equal(out.intent, "direct_buy_coaching_entry");
    assert.equal(out.step, "booking");
    assert.equal(out.flags.booking, true);
    assert.equal(out.bookingStatus, "inactive");
    assert.equal(requests, 0);
  });
});
