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

  await t.test("ghosting dry-run stays due and is not faked into history", async () => {
    clearConversationStore();

    const leadId = "instagram:ghosting-dry-run";
    const campaignId = "eltern-vital-fit";
    const state = getOrCreateConversationState(leadId, campaignId);
    state.source = "Instagram";
    state.lastAssistantMessageAt = hoursAgo(96);
    state.lastUserMessageAt = undefined;
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
    state.lastAssistantMessageAt = hoursAgo(96);
    state.lastUserMessageAt = undefined;
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

  await t.test("provider booking dry-run stays pending and is not faked into history", async () => {
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
        "INSTAGRAM_SEND_ENABLED=false",
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
