import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const testDataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "funnel-pilot-manual-outbound-"),
);

process.env.NODE_ENV = "test";
process.env.DATA_DIR = testDataDir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.INSTAGRAM_ALLOWED_SENDER_IDS = "";
process.env.INSTAGRAM_ALLOW_ALL_SENDERS = "false";
delete process.env.OPENAI_API_KEY;

const {
  resolveManualOutboundTransport,
  sendManualConversationOutbound,
} = await import("../services/manual-outbound.service.js");
const {
  getOrCreateConversationState,
  persistConversationState,
} = await import("../core/state-manager.js");
const {
  clearConversationStore,
  getConversationState,
} = await import("../data/store.js");
const { default: app } = await import("../app.js");

test("Phase 9 dashboard manual outbound", async (t) => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });

  await t.test("resolves Instagram and WhatsApp recipients without guessing", () => {
    const instagramState = getOrCreateConversationState(
      "instagram:178900001",
      "eltern-vital-fit",
    );
    instagramState.source = "Instagram";

    assert.deepEqual(resolveManualOutboundTransport(instagramState), {
      transport: "meta_instagram",
      recipient: "178900001",
    });

    const whatsappState = getOrCreateConversationState(
      "whatsapp:491701234567",
      "eltern-vital-fit",
    );
    whatsappState.source = "WhatsApp";
    whatsappState.phone = "+49 170 1234567";

    assert.deepEqual(resolveManualOutboundTransport(whatsappState), {
      transport: "meta_whatsapp",
      recipient: "+491701234567",
    });
  });

  await t.test("disabled channel stays explicit dry-run", async () => {
    const instagramState = getOrCreateConversationState(
      "instagram:dry-run-recipient",
      "eltern-vital-fit",
    );
    instagramState.source = "Instagram";

    const instagramResult = await sendManualConversationOutbound({
      state: instagramState,
      messageText: "Manuelle Testnachricht",
    });

    assert.equal(instagramResult.ok, true);
    assert.equal(instagramResult.sent, false);
    assert.equal(instagramResult.dryRun, true);
    assert.equal(instagramResult.sendSkipped, true);
    assert.equal(
      instagramResult.reason,
      "INSTAGRAM_SEND_ENABLED=false",
    );

    const whatsappState = getOrCreateConversationState(
      "whatsapp:491701111111",
      "eltern-vital-fit",
    );
    whatsappState.source = "WhatsApp";
    whatsappState.phone = "491701111111";

    const whatsappResult = await sendManualConversationOutbound({
      state: whatsappState,
      messageText: "WhatsApp Test",
    });

    assert.equal(whatsappResult.ok, true);
    assert.equal(whatsappResult.sent, false);
    assert.equal(whatsappResult.dryRun, true);
    assert.equal(whatsappResult.sendSkipped, true);
    assert.equal(
      whatsappResult.reason,
      "WHATSAPP_SEND_ENABLED=false",
    );
  });

  await t.test("human-message route pauses AI but does not fake an unsent message", async () => {
    clearConversationStore();

    const state = getOrCreateConversationState(
      "instagram:dashboard-dry-run",
      "eltern-vital-fit",
    );
    state.source = "Instagram";
    persistConversationState(state);

    const messageCountBefore = state.messages.length;
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));

    try {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const response = await fetch(
        baseUrl +
          "/conversations/eltern-vital-fit/" +
          encodeURIComponent("instagram:dashboard-dry-run") +
          "/human-message",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageText: "Das soll nicht nur lokal so aussehen.",
          }),
        },
      );

      assert.equal(response.status, 200);
      const result = (await response.json()) as {
        ok: boolean;
        sent: boolean;
        dryRun: boolean;
        sendSkipped: boolean;
        sendSkipReason?: string;
        messageAppended: boolean;
        state: {
          owner?: string;
          aiPaused?: boolean;
          messages: unknown[];
        };
      };

      assert.equal(result.ok, true);
      assert.equal(result.sent, false);
      assert.equal(result.dryRun, true);
      assert.equal(result.sendSkipped, true);
      assert.equal(
        result.sendSkipReason,
        "INSTAGRAM_SEND_ENABLED=false",
      );
      assert.equal(result.messageAppended, false);
      assert.equal(result.state.owner, "human");
      assert.equal(result.state.aiPaused, true);
      assert.equal(result.state.messages.length, messageCountBefore);

      const persisted = getConversationState(
        "instagram:dashboard-dry-run",
        "eltern-vital-fit",
      );
      assert.ok(persisted);
      assert.equal(persisted.owner, "human");
      assert.equal(persisted.aiPaused, true);
      assert.equal(persisted.messages.length, messageCountBefore);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
