import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-coach-draft-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dataDir;
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.DISABLE_DESTRUCTIVE_ROUTES = "true";
delete process.env.OPENAI_API_KEY;

const { default: app } = await import("../app.js");
const {
  emptyCoachOnboardingDraft, readCoachOnboardingDraft,
  validateCoachOnboardingDraft,
} = await import("../services/coach-onboarding-draft.js");
const { readSettings } = await import("../services/settings-store.js");

test("Inert coach template persists independently of Jochen's active settings and offers", async t => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const info = server.address();
  assert.ok(info && typeof info !== "string");
  const base = "http://127.0.0.1:" + info.port;
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  const request = async (body: unknown) => fetch(base + "/coach-onboarding-draft", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const current = readSettings();
  const original = await fetch(base + "/coach-onboarding-draft");
  assert.equal(original.status, 200);
  const firstRead = await original.json() as {
    draft: { status: string; offers: unknown[]; brand: { name: string } };
  };
  assert.equal(firstRead.draft.status, "draft");
  assert.equal(firstRead.draft.brand.name, "");
  assert.deepEqual(firstRead.draft.offers, []);

  const draft = emptyCoachOnboardingDraft();
  draft.brand = {
    name: "Beispiel Coachwerk",
    coachName: "Mara Demo",
    niche: "Stressmanagement",
    audience: "Menschen mit engem Arbeitsalltag",
    websiteUrl: "https://example.org",
  };
  draft.assistant = {
    name: "Nora", voice: "kurz, freundlich, verständlich",
    language: "Deutsch", escalation: "Bei Krisen oder persönlichem Wunsch übernimmt ein Mensch.",
    boundaries: "Keine Diagnosen oder erfundenen Ergebnisse.",
    objections: "Zeit\nKosten\nUnsicherheit",
  };
  draft.links = {
    guideUrl: "https://example.org/guide",
    checkUrl: "https://example.org/check",
    videoUrl: "", bookingUrl: "https://example.org/termin",
  };
  draft.offers = [
    { name: "Grundkurs", forWhom: "Einsteiger", priceText: "Preis auf Anfrage",
      linkUrl: "https://example.org/grundkurs" },
    { name: "Coaching", forWhom: "Menschen mit Wunsch nach Begleitung",
      priceText: "49 € einmalig (nur Entwurf)", linkUrl: "" },
  ];
  const payload = {
    schemaVersion: draft.schemaVersion, brand: draft.brand,
    assistant: draft.assistant, links: draft.links, offers: draft.offers,
  };
  const saved = await request(payload);
  assert.equal(saved.status, 200);
  const content = await saved.json() as {
    draft: { status: string; updatedAt: string; offers: unknown[]; assistant: { name: string } };
  };
  assert.equal(content.draft.status, "draft");
  assert.equal(content.draft.assistant.name, "Nora");
  assert.equal(content.draft.offers.length, 2);
  assert.match(content.draft.updatedAt, /^20\d\d-/);
  assert.deepEqual(readSettings(), current, "active Jochen settings may not be changed");
  assert.equal(fs.existsSync(path.join(dataDir, "coach-onboarding-draft.json")), true);

  const after = await fetch(base + "/coach-onboarding-draft");
  const reloaded = await after.json() as { draft: {
    offers: Array<{ name: string; priceText: string }>; status: string };
  };
  assert.equal(reloaded.draft.offers[1].priceText, "49 € einmalig (nur Entwurf)");
  assert.equal(reloaded.draft.status, "draft");
  assert.equal(readCoachOnboardingDraft().brand.name, "Beispiel Coachwerk");

  const updated = { ...payload, brand: { ...draft.brand, audience: "Berufstätige Eltern" } };
  assert.equal((await request(updated)).status, 200);
  assert.equal(readCoachOnboardingDraft().brand.audience, "Berufstätige Eltern");
  assert.equal(readSettings().companyName, current.companyName);
});

test("Coach draft requires HTTPS links and whitelist; never allows activation, secrets or tenant IDs", async () => {
  const model = emptyCoachOnboardingDraft();
  const payload = () => ({
    schemaVersion: 1, brand: { ...model.brand },
    assistant: { ...model.assistant },
    links: { ...model.links }, offers: [...model.offers],
  });
  for (const dangerous of [
    { status: "active" }, { workspaceId: "other-tenant" },
    { aiEnabled: true }, { webhookVerifyToken: "secret" },
    { apiKey: "never-store" }, { assistant: { ...model.assistant, apiKey: "secret" } },
    { brand: { ...model.brand, companyName: "outside-whitelist" } },
  ]) {
    const result = validateCoachOnboardingDraft({ ...payload(), ...dangerous });
    assert.equal(result.ok, false, JSON.stringify(dangerous));
  }
  for (const invalidUrl of [
    "http://example.org", "javascript:alert(1)", "ftp://example.org",
    "https://username:password@example.org", "https://example.org/path#token",
    "not a url",
  ]) {
    const draft = payload();
    draft.brand.websiteUrl = invalidUrl;
    assert.equal(validateCoachOnboardingDraft(draft).ok, false, invalidUrl);
  }
  assert.equal(validateCoachOnboardingDraft({
    ...payload(), offers: Array.from({ length: 4 }, () => ({
      name: "Unzulässig", priceText: "", linkUrl: "", forWhom: "",
    })),
  }).ok, false);
  assert.equal(validateCoachOnboardingDraft({
    ...payload(), offers: [{ name: "", priceText: "300 €", forWhom: "", linkUrl: "" }],
  }).ok, false);
  assert.equal(validateCoachOnboardingDraft({
    ...payload(), brand: { ...model.brand, name: "x".repeat(121) },
  }).ok, false);
  assert.equal(validateCoachOnboardingDraft({
    ...payload(), schemaVersion: 42,
  }).ok, false);
});

test("Corrupt existing draft is never silently overwritten", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-draft-corrupt-"));
  const file = path.join(dir, "coach-onboarding-draft.json");
  // Isolated module's DATA_DIR was set before import, so manipulate that one.
  fs.writeFileSync(path.join(dataDir, "coach-onboarding-draft.json"), "{broken", "utf8");
  assert.throws(() => readCoachOnboardingDraft(), /coach_draft_invalid_restore_required/);
  const result = emptyCoachOnboardingDraft();
  const { saveCoachOnboardingDraft } = requireDraftFunctions();
  assert.throws(() => saveCoachOnboardingDraft({
    schemaVersion: 1, brand: result.brand, assistant: result.assistant,
    links: result.links, offers: [],
  }), /coach_draft_invalid_restore_required/);
  assert.equal(fs.readFileSync(path.join(dataDir, "coach-onboarding-draft.json"), "utf8"), "{broken");
  fs.rmSync(dir, { recursive: true, force: true });
});

// Assigned after ESM import at module scope, no CommonJS require.
function requireDraftFunctions() {
  return { saveCoachOnboardingDraft: savedFunction };
}
const { saveCoachOnboardingDraft: savedFunction } = await import("../services/coach-onboarding-draft.js");
