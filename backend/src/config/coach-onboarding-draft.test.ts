import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "funnelpilot-coach-onboarding-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = temp;
process.env.DISABLE_DESTRUCTIVE_ROUTES = "true";
const { default: app } = await import("../app.js");
const { readSettings, DEFAULT_MASTER_PROMPT } = await import("../services/settings-store.js");
const { parseCoachOnboardingDraft } = await import("../services/coach-onboarding-draft.js");

const draft = {
  version: 1, preferredContact: "Persönliche DM-Übernahme",
  welcomeLine: "Ich bin Nora, die KI-Assistentin des Coaches.",
  offers: [
    { name: "8-Wochen-Begleitung", priceLabel: "499 € einmalig",
      url: "https://example.org/angebot?ref=coach" },
    { name: "Erstgespräch", priceLabel: "", url: "" },
  ],
  faqs: [{ question: "Für wen ist das?", answer: "Für berufstätige Eltern." }],
};

test("Coach draft validation keeps only bounded, harmless, draft-only strings", () => {
  const result = parseCoachOnboardingDraft(draft);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value, draft);
  assert.equal(parseCoachOnboardingDraft({ ...draft, version: 2 }).ok, false);
  assert.equal(parseCoachOnboardingDraft({ ...draft, adminRole: "superuser" }).ok, false);
  assert.equal(parseCoachOnboardingDraft({ ...draft, offers: Array(5).fill(draft.offers[0]) }).ok, false);
  assert.equal(parseCoachOnboardingDraft({ ...draft, faqs: Array(6).fill(draft.faqs[0]) }).ok, false);
  assert.equal(parseCoachOnboardingDraft({ ...draft, offers: [{ name: "Test", priceLabel: "",
    url: "http://example.org" }] }).ok, false);
  assert.equal(parseCoachOnboardingDraft({ ...draft, offers: [{ name: "Test", priceLabel: "",
    url: "https://user:password@example.org" }] }).ok, false);
  assert.equal(parseCoachOnboardingDraft({ ...draft, offers: [{ name: "Test", priceLabel: "",
    url: "https://localhost/private" }] }).ok, false);
  assert.equal(parseCoachOnboardingDraft({ ...draft, faqs: [{ question: "Frage", answer: "" }] }).ok, false);
  assert.equal(parseCoachOnboardingDraft({ ...draft, preferredContact: "x".repeat(181) }).ok, false);
  assert.equal(parseCoachOnboardingDraft({ ...draft, offers: [{ name: "x".repeat(101),
    priceLabel: "", url: "" }] }).ok, false);
  assert.equal(parseCoachOnboardingDraft({ ...draft, offers: [{ name: "",
    priceLabel: "", url: "" }] }).ok, true);
});

test("Guided coach draft survives actual HTTP save, reload and unrelated partial update without live activation", async t => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = "http://127.0.0.1:" + address.port;
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const post = async (body: unknown) => {
    const response = await fetch(base + "/settings-config", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as
      { ok: boolean; error?: string; settings?: Record<string, unknown> } };
  };

  const save = await post({ companyName: "Studio Nord", adminName: "Coach Ada",
    assistantName: "Nora", companyAudience: "Menschen mit wenig Zeit",
    coachOnboardingDraft: draft });
  assert.equal(save.status, 200);
  assert.deepEqual(save.body.settings?.coachOnboardingDraft, draft);
  const persisted = JSON.parse(fs.readFileSync(path.join(temp, "settings.json"), "utf8"));
  assert.deepEqual(persisted.coachOnboardingDraft, draft);

  const invalid = await post({ coachOnboardingDraft: {
    ...draft, offers: [{ name: "Bad", priceLabel: "", url: "javascript:alert(1)" }],
  } });
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.error || "", /coach_offer_draft_invalid/);
  const invalidOwner = await post({ coachOnboardingDraft: { ...draft, unknownRole: "admin" } });
  assert.equal(invalidOwner.status, 400);

  // Saving a coach draft alone must leave the active Jochen workspace untouched.
  const beforeDraftOnly = readSettings();
  const draftOnly = await post({ coachOnboardingDraft: {
    ...draft, welcomeLine: "Neuer Entwurf, nicht aktiv",
  } });
  assert.equal(draftOnly.status, 200);
  assert.equal(readSettings().companyName, beforeDraftOnly.companyName);
  assert.equal(readSettings().masterPrompt, beforeDraftOnly.masterPrompt);
  assert.equal(readSettings().assistantName, beforeDraftOnly.assistantName);
  assert.equal(readSettings().starterCheckoutUrl, beforeDraftOnly.starterCheckoutUrl);
  assert.equal(readSettings().aiEnabled, beforeDraftOnly.aiEnabled);
  assert.equal(readSettings().testMode, beforeDraftOnly.testMode);
  assert.equal(readSettings().coachOnboardingDraft.welcomeLine,
    "Neuer Entwurf, nicht aktiv");
  // Restore the earlier draft to keep the remaining roundtrip assertions meaningful.
  assert.equal((await post({ coachOnboardingDraft: draft })).status, 200);

  const unrelated = await post({ brandVoice: "ruhig, konkret und menschlich" });
  assert.equal(unrelated.status, 200);
  assert.deepEqual(unrelated.body.settings?.coachOnboardingDraft, draft);
  const loaded = await fetch(base + "/settings-config").then(r => r.json()) as
    { settings: Record<string, unknown> };
  assert.deepEqual(loaded.settings.coachOnboardingDraft, draft);

  // A preview or a draft must never change actual offer truth, campaign
  // mapping, active send flags, or the live master prompt by itself.
  assert.equal(readSettings().masterPrompt, DEFAULT_MASTER_PROMPT);
  assert.equal(readSettings().aiEnabled, false);
  assert.equal(readSettings().testMode, true);
  assert.equal(readSettings().starterCheckoutUrl,
    "https://portal.nutrilize.app/product/Vz5Yf8MBIue2MdQLQO9S");
  assert.equal(readSettings().companyName, "Studio Nord");
});
