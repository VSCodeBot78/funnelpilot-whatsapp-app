import assert from "node:assert/strict";
import test from "node:test";
import { saveCoachDraftOnly } from "./settingsApi.js";

test("Coach save POST includes only the draft, never unsaved Pete and booking settings", async () => {
  const original = globalThis.fetch;
  const draft = {
    version: 1, preferredContact: "Persönliche Antwort", welcomeLine: "",
    offers: [{ name: "8 Wochen", priceLabel: "499 €", url: "https://example.org/angebot" }],
    faqs: [],
  };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true, json: async () => ({ ok: true, settings: {
        coachOnboardingDraft: draft, masterPrompt: "Original", aiEnabled: false,
      } }),
    };
  };
  try {
    const result = await saveCoachDraftOnly(draft, "http://127.0.0.1:3001");
    assert.deepEqual(result, draft);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://127.0.0.1:3001/settings-config");
    assert.equal(calls[0].options.method, "POST");
    assert.deepEqual(JSON.parse(calls[0].options.body), { coachOnboardingDraft: draft });
    for (const key of ["masterPrompt", "aiEnabled", "starterCheckoutUrl", "companyName",
      "instagramSendEnabled", "defaultBookingUrl", "webhookVerifyToken"]) {
      assert.equal(Object.hasOwn(JSON.parse(calls[0].options.body), key), false, key);
    }
  } finally { globalThis.fetch = original; }
});

test("No successful draft result is reported when backend validation rejects", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false, json: async () => ({ ok: false, error: "coach_offer_draft_invalid" }),
  });
  try {
    await assert.rejects(
      () => saveCoachDraftOnly({ version: 1 }, "http://127.0.0.1:3001"),
      /coach_offer_draft_invalid/,
    );
  } finally { globalThis.fetch = original; }
});
