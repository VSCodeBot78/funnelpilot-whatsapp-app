import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createPreviewServer } from "../../preview-server.mjs";
import { DEMO_CAMPAIGNS, simulateEntry, simulateWebhook } from "./simulatedCampaigns.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => fs.readFileSync(path.join(here, file), "utf8");

test("mobile preview uses fake campaigns and matches only explicit saved keywords", () => {
  const match = simulateEntry(DEMO_CAMPAIGNS, {
    source: "instagram_dm", messageText: "CHECK",
  });
  assert.equal(match.status, "matched");
  assert.equal(match.matchedCampaignId, "demo-check");
  assert.equal(match.draftContext?.mode, "preview_only");
  assert.equal(match.draftContext?.sendAllowed, false);
  assert.equal(match.followUpDraftConfigured, false);
  assert.equal(simulateEntry(DEMO_CAMPAIGNS, {
    source: "instagram_dm", messageText: "Was kann ich machen?",
  }).status, "no_match");
  assert.equal(simulateEntry(DEMO_CAMPAIGNS, {
    source: "instagram_reel_comment", messageText: "CHECK",
  }).status, "manual_review");
  assert.equal(simulateEntry(DEMO_CAMPAIGNS, {
    source: "instagram_reel_comment", messageText: "CHECK",
    mediaId: "17851537767246649",
  }).status, "matched");
});

test("mobile preview fails closed on conflicts and unverified events", () => {
  const ambiguous = simulateEntry([...DEMO_CAMPAIGNS, {
    ...DEMO_CAMPAIGNS[0], id: "another-check",
  }], { source: "instagram_dm", messageText: "CHECK" });
  assert.equal(ambiguous.status, "ambiguous");
  assert.equal(ambiguous.draftContext, null);
  assert.equal(ambiguous.sendAllowed, false);
  const unsafe = simulateWebhook(DEMO_CAMPAIGNS, {
    channel: "instagram", payload: { object: "instagram", entry: [] },
  });
  assert.equal(unsafe.event.status, "manual_review");
  assert.equal(unsafe.preview, null);
  assert.equal(unsafe.event.sendAllowed, false);
  const whatsapp = simulateWebhook(DEMO_CAMPAIGNS, {
    channel: "whatsapp",
    payload: {
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: {
        messages: [{ id: "synthetic-id", from: "synthetic-parent",
          type: "text", text: { body: "KETO" },
          referral: { ctwa_clid: "synthetic-click" } }],
      } }] }],
    },
  });
  assert.equal(whatsapp.event.source, "whatsapp_ctwa");
  assert.equal(whatsapp.preview?.matchedCampaignId, "demo-keto");
  assert.equal(whatsapp.preview?.sendAllowed, false);
});

test("isolated preview imports the actual campaign editor without the full app or live adapters", () => {
  const app = read("MobileDashboardPreview.jsx");
  assert.match(app, /import CampaignsView from "\.\.\/campaigns\/campaignsView"/);
  assert.match(app, /previewEntry=\{previewEntry\} previewWebhook=\{previewWebhook\}/);
  assert.doesNotMatch(app, /AppDashboard|MobilePeteLab|useCampaigns|fetch\(|localStorage/);
  assert.match(app, /synthetische Testdaten/);
  assert.match(app, /Nur Demo:/);
  const matcher = read("simulatedCampaigns.js");
  assert.doesNotMatch(matcher, /fetch\(|axios|MetaGraph|OPENAI_API_KEY/);
  assert.match(matcher, /sendAllowed: false/);
  const config = fs.readFileSync(path.join(here, "../../vite.mobile-preview.config.js"), "utf8");
  assert.match(config, /mobile-preview\.html/);
  assert.match(config, /preview-dist/);
});

test("preview web server fails closed without credentials", () => {
  assert.throws(() => createPreviewServer({ username: "u", password: "longbutinvalid" }),
    /preview_credentials_not_configured/);
  assert.throws(() => createPreviewServer({ username: "tester", password: "short" }),
    /preview_credentials_not_configured/);
});

test("preview web server protects assets and blocks every backend/API path", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fp-mobile-preview-"));
  fs.mkdirSync(path.join(root, "assets"));
  fs.writeFileSync(path.join(root, "mobile-preview.html"), "<h1>synthetic-preview</h1>");
  fs.writeFileSync(path.join(root, "assets", "sample.js"), "console.log('demo')");
  const server = createPreviewServer({ rootDir: root, username: "tester",
    password: "secure-synthetic-password-12345" });
  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const noAuth = await fetch(base + "/");
  assert.equal(noAuth.status, 401);
  assert.match(noAuth.headers.get("www-authenticate") || "", /Basic realm/);
  assert.equal(await (await fetch(base + "/assets/sample.js")).status, 401);
  assert.equal(await (await fetch(base + "/", { headers: {
    authorization: "Basic " + Buffer.from("tester:wrong").toString("base64"),
  } })).status, 401);
  const auth = { authorization: "Basic " +
    Buffer.from("tester:secure-synthetic-password-12345").toString("base64") };
  const ok = await fetch(base + "/", { headers: auth });
  assert.equal(ok.status, 200);
  assert.match(await ok.text(), /synthetic-preview/);
  assert.match(ok.headers.get("content-security-policy") || "", /connect-src 'none'/);
  assert.equal(await (await fetch(base + "/assets/sample.js", { headers: auth })).status, 200);
  for (const blocked of ["/campaigns", "/settings-config", "/api", "/pete-test",
    "/webhooks/meta/instagram", "/assets/../preview-server.mjs", "/.env"]) {
    assert.equal((await fetch(base + blocked, { headers: auth })).status, 404,
      "Expected protected server to reject " + blocked);
  }
  assert.equal((await fetch(base + "/", { headers: auth, method: "POST" })).status, 405);
  assert.equal((await fetch(base + "/healthz")).status, 200);
});
