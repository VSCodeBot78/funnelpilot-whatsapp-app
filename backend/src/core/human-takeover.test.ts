import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const testDataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "funnel-pilot-phase1-"),
);

process.env.NODE_ENV = "test";
process.env.DATA_DIR = testDataDir;
delete process.env.OPENAI_API_KEY;

const {
  appendAssistantMessage,
  appendHumanMessage,
  appendUserMessage,
  getOrCreateConversationState,
  releaseToAi,
  takeOverByHuman,
} = await import("./state-manager.js");
const { processIncomingMessage } = await import("./conversation-engine.js");
const {
  clearConversationStore,
} = await import("../data/store.js");
const {
  evaluateGhostingState,
} = await import("../services/ghosting.service.js");
const {
  evaluateProviderBookingFollowUp,
} = await import("../services/provider-booking.service.js");

const CAMPAIGN_ID = "mama-papa-kampagne";

test("Phase 1 human takeover semantics", async (t) => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });

  await t.test("new conversations default to AI ownership", () => {
    clearConversationStore();
    const state = getOrCreateConversationState("phase1-default", CAMPAIGN_ID);

    assert.equal(state.owner, "ai");
    assert.equal(state.aiPaused, false);
    assert.equal(state.lastHumanMessageAt, undefined);
  });

  await t.test("lead, AI and human actors are tracked correctly", () => {
    clearConversationStore();
    const state = getOrCreateConversationState("phase1-actors", CAMPAIGN_ID);

    appendUserMessage(state, "Hallo");
    assert.equal(state.lastActor, "lead");
    assert.equal(state.lastHumanMessageAt, undefined);

    appendAssistantMessage(state, "Hi");
    assert.equal(state.lastActor, "ai");

    appendHumanMessage(state, "Hier ist Jochen.");
    assert.equal(state.owner, "human");
    assert.equal(state.aiPaused, true);
    assert.equal(state.lastActor, "human");
    assert.ok(state.lastHumanMessageAt);
    assert.equal(state.messages.at(-1)?.actor, "human");
  });

  await t.test("lead reply is stored but AI stays silent during human ownership", async () => {
    clearConversationStore();
    const state = getOrCreateConversationState("phase1-human-owned", CAMPAIGN_ID);
    takeOverByHuman(state);

    const messageCountBefore = state.messages.length;
    const result = await processIncomingMessage({
      leadId: state.leadId,
      campaignId: state.campaignId,
      messageText: "Danke, Jochen.",
    });

    assert.equal(result.text, null);
    assert.equal(result.replySuppressedReason, "human_owned");
    assert.equal(result.state.owner, "human");
    assert.equal(result.state.aiPaused, true);
    assert.equal(result.state.lastActor, "lead");
    assert.equal(result.state.messages.length, messageCountBefore + 1);
    assert.equal(result.state.messages.at(-1)?.role, "user");
  });

  await t.test("explicit release allows AI replies again", async () => {
    clearConversationStore();
    const state = getOrCreateConversationState("phase1-release", CAMPAIGN_ID);
    takeOverByHuman(state);
    releaseToAi(state);

    assert.equal(state.owner, "ai");
    assert.equal(state.aiPaused, false);

    const result = await processIncomingMessage({
      leadId: state.leadId,
      campaignId: state.campaignId,
      messageText: "Max",
    });

    assert.notEqual(result.text, null);
    assert.equal(result.state.owner, "ai");
    assert.equal(result.state.aiPaused, false);
    assert.equal(result.state.lastActor, "ai");
  });

  await t.test("stopped conversations stay silent on later inbound messages", async () => {
    clearConversationStore();
    const state = getOrCreateConversationState("phase1-stopped", CAMPAIGN_ID);
    state.flags.stopped = true;

    const messageCountBefore = state.messages.length;
    const result = await processIncomingMessage({
      leadId: state.leadId,
      campaignId: state.campaignId,
      messageText: "Hallo nochmal",
    });

    assert.equal(result.text, null);
    assert.equal(result.replySuppressedReason, "stopped");
    assert.equal(result.state.messages.length, messageCountBefore + 1);
    assert.equal(result.state.messages.at(-1)?.role, "user");
  });

  await t.test("ghosting is blocked during human ownership", () => {
    clearConversationStore();
    const state = getOrCreateConversationState("phase1-ghosting", CAMPAIGN_ID);
    state.lastAssistantMessageAt = new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString();
    takeOverByHuman(state);

    const evaluation = evaluateGhostingState(state, state.ghosting, new Date());

    assert.equal(evaluation.dueNow, false);
    assert.equal(evaluation.active, false);
    assert.match(evaluation.reason ?? "", /Human Takeover/i);
  });

  await t.test("provider booking follow-ups are blocked during human ownership", () => {
    clearConversationStore();
    const state = getOrCreateConversationState("phase1-booking", CAMPAIGN_ID);
    state.providerBooking = {
      status: "awaiting_booking",
      active: true,
      stage: "inactive",
      linkSentAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      sentHistory: [],
    };
    takeOverByHuman(state);

    const evaluation = evaluateProviderBookingFollowUp(state, new Date());

    assert.equal(evaluation.dueNow, false);
    assert.equal(evaluation.active, false);
    assert.match(evaluation.reason ?? "", /Human Takeover/i);
  });
});
