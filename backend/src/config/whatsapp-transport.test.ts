import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const testDataDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "funnel-pilot-whatsapp-"),
);

process.env.NODE_ENV = "test";
process.env.DATA_DIR = testDataDir;
process.env.META_APP_SECRET = "whatsapp-test-app-secret";
process.env.META_VERIFY_TOKEN = "whatsapp-test-verify";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;

const { default: app } = await import("../app.js");
const {
  getLeadById,
  saveLead,
  deleteLead,
} = await import("../data/leads.store.js");
const {
  clearConversationStore,
} = await import("../data/store.js");

function sign(raw: string): string {
  return (
    "sha256=" +
    crypto
      .createHmac("sha256", "whatsapp-test-app-secret")
      .update(Buffer.from(raw, "utf8"))
      .digest("hex")
  );
}

function buildPayload(params: {
  messageId: string;
  from: string;
  text: string;
  name?: string;
}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "test-waba",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "491111111111",
                phone_number_id: "test-phone-number-id",
              },
              contacts: [
                {
                  wa_id: params.from,
                  profile: { name: params.name ?? "Test Lead" },
                },
              ],
              messages: [
                {
                  from: params.from,
                  id: params.messageId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: params.text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function postSigned(baseUrl: string, payload: unknown) {
  const raw = JSON.stringify(payload);
  const response = await fetch(baseUrl + "/webhooks/meta/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": sign(raw),
    },
    body: raw,
  });

  return {
    response,
    json: (await response.json()) as Record<string, unknown>,
  };
}

test("Phase 6 WhatsApp transport safety", async (t) => {
  t.after(() => {
    clearConversationStore();
    fs.rmSync(testDataDir, { recursive: true, force: true });
  });

  await t.test("signed WhatsApp DM reaches shared engine in dry-run mode", async () => {
    clearConversationStore();
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));

    try {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const from = "491701234567";

      const { response, json } = await postSigned(
        baseUrl,
        buildPayload({
          messageId: "wa-phase6-1",
          from,
          text: "Max",
          name: "Max",
        }),
      );

      assert.equal(response.status, 200);
      assert.equal(json.ok, true);
      assert.equal(json.processed, 1);
      assert.equal(json.engineProcessed, true);
      assert.equal(json.botReplyPrepared, true);
      assert.equal(json.dryRun, true);
      assert.equal(json.sent, false);
      assert.equal(json.sendSkipped, true);

      deleteLead(`whatsapp:${from}`);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  await t.test("bot-disabled WhatsApp lead is stored but never enters engine", async () => {
    clearConversationStore();
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));

    try {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const from = "491709876543";

      const first = await postSigned(
        baseUrl,
        buildPayload({
          messageId: "wa-phase6-seed",
          from,
          text: "Max",
          name: "Max",
        }),
      );
      assert.equal(first.response.status, 200);

      const leadId = `whatsapp:${from}`;
      const lead = getLeadById(leadId);
      assert.ok(lead);

      saveLead({
        ...lead,
        botEnabled: false,
      });

      const second = await postSigned(
        baseUrl,
        buildPayload({
          messageId: "wa-phase6-disabled",
          from,
          text: "Ja, gerne",
          name: "Max",
        }),
      );

      assert.equal(second.response.status, 200);
      assert.equal(second.json.ok, true);
      assert.equal(second.json.processed, 0);
      assert.equal(second.json.engineProcessed, false);
      assert.equal(second.json.sent, false);
      assert.equal(second.json.ignoredAutomationPaused, 1);

      deleteLead(leadId);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
