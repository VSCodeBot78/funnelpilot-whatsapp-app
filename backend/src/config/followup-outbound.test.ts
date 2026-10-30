import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const testDataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "funnel-pilot-followup-outbound-"),
);

process.env.NODE_ENV = "test";
process.env.DATA_DIR = testDataDir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.INSTAGRAM_ALLOWED_SENDER_IDS = "";
process.env.INSTAGRAM_ALLOW_ALL_SENDERS = "false";
delete process.env.OPENAI_API_KEY;

const {
  getOrCreateConversationState,
  persistConversationState,
} = await import("../core/state-manager.js");
const {
  clearConversationStore,
  getConversationState,
} = await import("../data/store.js");
const { default: app } = await import("../app.js");
const { syncInstagramLead } = await import("../services/instagram-lead-sync.service.js");
const { saveLead } = await import("../data/leads.store.js");

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function withServer(
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("Phase 12 real follow-up transport truth", async (t) => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });

  await t.test("Meta 24h follow-up window uses LAST inbound, never the bot send time", async () => {
    clearConversationStore();
    const { evaluateGhostingState } = await import("../services/ghosting.service.js");
    const state = getOrCreateConversationState("instagram:window-boundary", "eltern-vital-fit");
    state.source = "Instagram";
    state.lastAssistantMessageAt = hoursAgo(7);
    state.lastUserMessageAt = hoursAgo(8);
    const allowedPreview = evaluateGhostingState(state, state.ghosting);
    assert.equal(allowedPreview.dueNow, true);
    assert.equal(allowedPreview.stage, "cycle1_within24h_6h");

    state.lastUserMessageAt = hoursAgo(25);
    const expired = evaluateGhostingState(state, state.ghosting);
    assert.equal(expired.dueNow, false);
    assert.match(expired.reason || "", /24-Stunden/);

    state.lastUserMessageAt = undefined;
    const noProof = evaluateGhostingState(state, state.ghosting);
    assert.equal(noProof.dueNow, false);
    assert.match(noProof.reason || "", /Kundeneingang/);
  });

  await t.test("desktop keyword starts are scripted, and a Reel comment is not an inbound DM", async () => {
    clearConversationStore();
    await withServer(async baseUrl => {
      for (const [source, keyword] of [
        ["instagram_dm", "CHECK"],
        ["instagram_story_reply", "KETO"],
        ["instagram_reel_comment", "BULLSHIT"],
      ] as const) {
        const leadId = "lab_desktop_test_" + source + "_" + keyword.toLowerCase();
        const response = await fetch(baseUrl + "/test-chat/simulate-entry", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, source, keyword }),
        });
        assert.equal(response.status, 200);
        const data = await response.json() as {
          ok: boolean; reply: null; replySource: string;
          state: { messages: Array<{ role: string; syntheticAutomation?: boolean }> };
        };
        assert.equal(data.ok, true);
        assert.equal(data.reply, null); // no LLM or Meta network on entry
        assert.equal(data.replySource, "scripted_context");
        assert.equal(data.state.messages.at(-1)?.syntheticAutomation, true);
        const state = getConversationState(leadId, "eltern-vital-fit");
        assert.ok(state);
        assert.equal(Boolean(state.lastUserMessageAt), source !== "instagram_reel_comment");
        assert.equal(data.state.messages.length, source === "instagram_reel_comment" ? 1 : 2);
      }
    });
  });

  await t.test("ghosting dry-run stays due and is not faked into history", async () => {
    clearConversationStore();

    const leadId = "instagram:ghosting-dry-run";
    const campaignId = "eltern-vital-fit";
    const state = getOrCreateConversationState(leadId, campaignId);
    state.source = "Instagram";
    // The user last wrote 8h ago, and the bot last wrote 7h ago.
    // Only then is a 6h reminder due AND still inside Meta's 24h window.
    state.lastAssistantMessageAt = hoursAgo(7);
    state.lastUserMessageAt = hoursAgo(8);
    state.owner = "ai";
    state.aiPaused = false;
    state.flags.stopped = false;
    state.ghosting = {
      active: false,
      cycle: 0,
      stage: "inactive",
      isDead: false,
      sentHistory: [],
    };
    persistConversationState(state);

    const messagesBefore = state.messages.length;
    const sentHistoryBefore = state.ghosting.sentHistory?.length ?? 0;

    await withServer(async (baseUrl) => {
      const response = await fetch(
        baseUrl +
          "/ghosting/send-due/" +
          encodeURIComponent(campaignId) +
          "/" +
          encodeURIComponent(leadId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sendAt: new Date().toISOString() }),
        },
      );

      assert.equal(response.status, 200);
      const result = (await response.json()) as {
        ok: boolean;
        sent?: boolean;
        dryRun?: boolean;
        sendSkipped?: boolean;
        sendSkipReason?: string;
      };

      assert.equal(result.ok, true);
      assert.equal(result.sent, false);
      assert.equal(result.dryRun, true);
      assert.equal(result.sendSkipped, true);
      assert.equal(
        result.sendSkipReason,
        "INSTAGRAM_SEND_ENABLED=false",
      );
    });

    const persisted = getConversationState(leadId, campaignId);
    assert.ok(persisted);
    assert.equal(persisted.messages.length, messagesBefore);
    assert.equal(
      persisted.ghosting.sentHistory?.length ?? 0,
      sentHistoryBefore,
    );
    assert.equal(persisted.ghosting.lastSentStage, undefined);
  });

  await t.test("ghosting respects explicit Funnel Pilot handoff and stays silent when bot is disabled", async () => {
    clearConversationStore();

    const leadSync = syncInstagramLead({
      instagramScopedId: "followup-handoff-disabled",
      botEnabledForNewLead: false,
    });
    const state = getOrCreateConversationState(
      leadSync.lead.id,
      leadSync.campaignId,
    );
    state.source = "Instagram";
    // The user last wrote 8h ago, and the bot last wrote 7h ago.
    // Only then is a 6h reminder due AND still inside Meta's 24h window.
    state.lastAssistantMessageAt = hoursAgo(7);
    state.lastUserMessageAt = hoursAgo(8);
    state.owner = "ai";
    state.aiPaused = false;
    state.flags.stopped = false;
    state.ghosting = {
      active: false,
      cycle: 0,
      stage: "inactive",
      isDead: false,
      sentHistory: [],
    };
    persistConversationState(state);

    await withServer(async (baseUrl) => {
      const response = await fetch(
        baseUrl +
          "/ghosting/send-due/" +
          encodeURIComponent(leadSync.campaignId) +
          "/" +
          encodeURIComponent(leadSync.lead.id),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sendAt: new Date().toISOString() }),
        },
      );

      assert.equal(response.status, 200);
      const result = (await response.json()) as {
        sent?: boolean;
        sendSkipped?: boolean;
        sendSkipReason?: string;
      };

      assert.equal(result.sent, false);
      assert.equal(result.sendSkipped, true);
      assert.equal(
        result.sendSkipReason,
        "outbound_guard_lead_bot_disabled",
      );
    });

    const persisted = getConversationState(
      leadSync.lead.id,
      leadSync.campaignId,
    );
    assert.ok(persisted);
    assert.equal(persisted.messages.length, 0);
    assert.equal(persisted.ghosting.sentHistory?.length ?? 0, 0);
  });

  await t.test("provider follow-up respects excluded leads", async () => {
    clearConversationStore();

    const leadSync = syncInstagramLead({
      instagramScopedId: "followup-excluded",
      botEnabledForNewLead: true,
    });
    saveLead({
      ...leadSync.lead,
      excluded: true,
    });

    const state = getOrCreateConversationState(
      leadSync.lead.id,
      leadSync.campaignId,
    );
    state.source = "Instagram";
    state.owner = "ai";
    state.aiPaused = false;
    state.flags.stopped = false;
    state.providerBooking = {
      status: "awaiting_booking",
      active: true,
      stage: "inactive",
      linkSentAt: hoursAgo(72),
      sentHistory: [],
    };
    persistConversationState(state);

    await withServer(async (baseUrl) => {
      const response = await fetch(
        baseUrl +
          "/provider-booking/send-due/" +
          encodeURIComponent(leadSync.campaignId) +
          "/" +
          encodeURIComponent(leadSync.lead.id),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sentAt: new Date().toISOString() }),
        },
      );

      assert.equal(response.status, 200);
      const result = (await response.json()) as {
        sent?: boolean;
        sendSkipped?: boolean;
        sendSkipReason?: string;
      };

      assert.equal(result.sent, false);
      assert.equal(result.sendSkipped, true);
      assert.equal(
        result.sendSkipReason,
        "outbound_guard_lead_excluded",
      );
    });

    const persisted = getConversationState(
      leadSync.lead.id,
      leadSync.campaignId,
    );
    assert.ok(persisted);
    assert.equal(persisted.messages.length, 0);
    assert.equal(persisted.providerBooking.sentHistory.length, 0);
  });

  await t.test("provider reminder without inbound is blocked and not faked into history", async () => {
    clearConversationStore();

    const leadId = "instagram:provider-dry-run";
    const campaignId = "eltern-vital-fit";
    const state = getOrCreateConversationState(leadId, campaignId);
    state.source = "Instagram";
    state.owner = "ai";
    state.aiPaused = false;
    state.flags.stopped = false;
    state.providerBooking = {
      status: "awaiting_booking",
      active: true,
      stage: "inactive",
      linkSentAt: hoursAgo(72),
      sentHistory: [],
    };
    persistConversationState(state);

    const messagesBefore = state.messages.length;
    const sentHistoryBefore = state.providerBooking.sentHistory.length;

    await withServer(async (baseUrl) => {
      const response = await fetch(
        baseUrl +
          "/provider-booking/send-due/" +
          encodeURIComponent(campaignId) +
          "/" +
          encodeURIComponent(leadId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sentAt: new Date().toISOString() }),
        },
      );

      assert.equal(response.status, 200);
      const result = (await response.json()) as {
        ok: boolean;
        sent?: boolean;
        dryRun?: boolean;
        sendSkipped?: boolean;
        sendSkipReason?: string;
      };

      assert.equal(result.ok, true);
      assert.equal(result.sent, false);
      assert.equal(result.dryRun, true);
      assert.equal(result.sendSkipped, true);
      assert.equal(
        result.sendSkipReason,
        "outbound_guard_message_window_unverified_or_expired",
      );
    });

    const persisted = getConversationState(leadId, campaignId);
    assert.ok(persisted);
    assert.equal(persisted.messages.length, messagesBefore);
    assert.equal(
      persisted.providerBooking.sentHistory.length,
      sentHistoryBefore,
    );
    assert.equal(persisted.providerBooking.stage, "inactive");
  });
});
