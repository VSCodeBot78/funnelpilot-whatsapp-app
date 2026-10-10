import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-onboarding-settings-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dataDir;
process.env.DISABLE_DESTRUCTIVE_ROUTES = "true";
delete process.env.OPENAI_API_KEY;

const { default: app } = await import("../app.js");
const { readSettings, writeSettings } = await import("../services/settings-store.js");

test("Onboarding repeat and partial settings edits preserve all unrelated data", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  const base = "http://127.0.0.1:" + addr.port;

  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  async function patch(body: unknown) {
    const response = await fetch(base + "/settings-config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 200);
    return response.json() as Promise<{ settings: Record<string, unknown> }>;
  }

  const first = await patch({
    companyName: "Coach Testmarke",
    companyNiche: "Stressfreies Fitnesstraining",
    companyWebsite: "https://example.test",
    adminName: "Test Coach",
    assistantName: "Nora",
    brandVoice: "freundlich und präzise",
    defaultBookingUrl: "https://calendly.com/coach/kennenlernen",
    companyOfferSummary: "8-Wochen-Begleitung",
  });
  assert.equal(first.settings.companyName, "Coach Testmarke");
  assert.equal(first.settings.assistantName, "Nora");

  const second = await patch({
    defaultBookingUrl: "https://calendly.com/coach/neuer-termin",
  });
  assert.equal(second.settings.companyName, "Coach Testmarke");
  assert.equal(second.settings.companyNiche, "Stressfreies Fitnesstraining");
  assert.equal(second.settings.assistantName, "Nora");
  assert.equal(second.settings.companyOfferSummary, "8-Wochen-Begleitung");
  assert.equal(second.settings.defaultBookingUrl, "https://calendly.com/coach/neuer-termin");

  const repeat = await patch({
    companyName: "Coach Testmarke 2",
    assistantName: "Nora 2",
    openAiApiKeyConfigured: true,
    openAiModelConfigured: false,
    arbitraryInternalFlag: "not-persisted",
    prototype: { polluted: true },
    companyAudience: ["wrong type"],
  });
  assert.equal(repeat.settings.companyName, "Coach Testmarke 2");
  assert.equal(repeat.settings.assistantName, "Nora 2");
  assert.equal(repeat.settings.companyAudience, "Berufstätige Eltern 35–55");
  assert.equal(repeat.settings.openAiApiKeyConfigured, undefined);
  assert.equal(repeat.settings.arbitraryInternalFlag, undefined);
  assert.equal(repeat.settings.prototype, undefined);

  const afterRestart = await fetch(base + "/settings-config");
  assert.equal(afterRestart.status, 200);
  const reloaded = await afterRestart.json() as { settings: Record<string, unknown> };
  assert.equal(reloaded.settings.companyName, "Coach Testmarke 2");
  assert.equal(reloaded.settings.defaultBookingUrl, "https://calendly.com/coach/neuer-termin");
  assert.equal(reloaded.settings.companyOfferSummary, "8-Wochen-Begleitung");

  const stored = JSON.parse(fs.readFileSync(path.join(dataDir, "settings.json"), "utf8"));
  assert.equal(stored.companyName, "Coach Testmarke 2");
  assert.equal(stored.openAiApiKeyConfigured, undefined);
  assert.equal(stored.arbitraryInternalFlag, undefined);

  assert.equal(readSettings().assistantName, "Nora 2");
  assert.equal(writeSettings({ assistantName: "Neue Nora" }).companyName, "Coach Testmarke 2");
  assert.equal(readSettings().defaultBookingUrl, "https://calendly.com/coach/neuer-termin");
});
