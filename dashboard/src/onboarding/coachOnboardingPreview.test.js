import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getCoachOnboardingPreview } from "./coachOnboardingPreview.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.resolve(here, p), "utf8");

test("Preview is always draft only, never marks multi-tenant or provider delivery verified", () => {
  const view = getCoachOnboardingPreview({
    companyName: "Studio Nord", adminName: "Coach Ada",
    assistantName: "Nora", companyAudience: "Berufstätige",
    brandVoice: "kurz, direkt",
    masterPrompt: "Hallo, ich bin Jochen von Eltern fit & vital.",
    starterCheckoutUrl: "https://jochen-kammerer.de/produkt",
    coachOnboardingDraft: {
      version: 1, preferredContact: "DM bei Bedarf",
      welcomeLine: "Ich bin Nora, eine KI-Assistentin.",
      offers: [{ name: "8 Wochen Coaching", priceLabel: "499 €", url: "https://example.org" }],
      faqs: [{ question: "Wie läuft es?", answer: "Online." }],
    },
  });
  assert.equal(view.draftOnly, true);
  assert.equal(view.liveReady, false);
  assert.equal(view.tenantIsolated, false);
  assert.equal(view.assistant, "Nora");
  assert.equal(view.offers.length, 1);
  assert.equal(view.faqs.length, 1);
  assert.equal(view.preferredContact, "DM bei Bedarf");
  assert.ok(view.warnings.some(w => /Jochen|Vorlagen/.test(w)));
});

test("Independent draft identity never inherits Jochen's live brand, assistant, or target audience", () => {
  const view = getCoachOnboardingPreview({
    companyName: "Eltern fit & vital", adminName: "Jochen",
    assistantName: "Pete", companyAudience: "Berufstätige Eltern", brandVoice: "Jochen",
    coachOnboardingDraft: {
      version: 1, preferredContact: "", welcomeLine: "", offers: [], faqs: [],
      identity: {
        brandName: "Studio Nord", operatorName: "Coach Ada",
        assistantName: "", audience: "Berufstätige", tone: "Ruhig",
      },
    },
  });
  assert.equal(view.identitySource, "coach_draft");
  assert.equal(view.brand, "Studio Nord");
  assert.equal(view.operator, "Coach Ada");
  assert.equal(view.assistant, ""); // Never fallback to active Pete.
  assert.equal(view.audience, "Berufstätige");
  assert.equal(view.tone, "Ruhig");
  assert.equal(view.liveReady, false);
  assert.equal(view.tenantIsolated, false);
});

test("Missing details are visible in preview without fabricating offerings", () => {
  const view = getCoachOnboardingPreview({});
  assert.deepEqual(view.offers, []);
  assert.deepEqual(view.faqs, []);
  assert.ok(view.warnings.some(w => /Marke/.test(w)));
  assert.ok(view.warnings.some(w => /Angebot/.test(w)));
  assert.equal(view.liveReady, false);
});

test("Guided wizard wires editor to settings save and shows explicit non-live warning", () => {
  const wizard = read("./SetupWizardModal.jsx");
  const editor = read("./CoachDraftEditor.jsx");
  const preview = read("./CoachProfilePreview.jsx");
  const settings = read("../hooks/useSettingsConfig.js");
  const backend = read("../../../backend/src/services/settings-store.ts");
  assert.match(wizard, /<CoachDraftEditor/);
  assert.match(wizard, /<CoachProfilePreview/);
  assert.match(wizard, /update\("coachOnboardingDraft", value\)/);
  assert.match(wizard, /await onSaveSettings\(\)/);
  assert.match(editor, /Coach-Identität als Entwurf/);
  assert.match(editor, /Angebotsentwürfe/);
  assert.match(editor, /Häufige Fragen/);
  assert.match(editor, /maxLength=\{700\}/);
  assert.match(preview, /Nur Entwurf/);
  assert.match(preview, /getCoachOnboardingPreview/);
  assert.match(settings, /coachOnboardingDraft: \{ version: 1/);
  assert.match(backend, /parseCoachOnboardingDraft/);
});

test("Preview has no unsafe direct send, activate or API calls", () => {
  const preview = read("./CoachProfilePreview.jsx");
  const editor = read("./CoachDraftEditor.jsx");
  assert.doesNotMatch(preview + editor, /fetch\(|onOpenTestChat|window\.location|localStorage|sendMeta|activateLive/);
});
