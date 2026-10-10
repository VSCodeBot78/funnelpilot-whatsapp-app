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
      version: 1, identity: {
        brandName: "Studio Nord", coachName: "Coach Ada", niche: "Fitness",
        audience: "Berufstätige", websiteUrl: "https://example.org",
        assistantName: "Nora", brandVoice: "kurz, direkt",
        escalation: "Mensch übernimmt", noGos: "Keine Diagnosen",
      },
      preferredContact: "DM bei Bedarf",
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

test("Existing active Jochen settings are never presented as a future coach identity", () => {
  const view = getCoachOnboardingPreview({
    companyName: "Eltern fit & vital", adminName: "Jochen Kammerer",
    assistantName: "Pete", companyAudience: "Eltern 35–55",
    brandVoice: "Jochen-Sprache",
    coachOnboardingDraft: {
      version: 1, preferredContact: "", welcomeLine: "",
      offers: [], faqs: [],
    },
  });
  assert.equal(view.brand, "");
  assert.equal(view.operator, "");
  assert.equal(view.assistant, "");
  assert.equal(view.audience, "");
  assert.equal(view.tone, "");
  assert.equal(view.liveReady, false);
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
  assert.match(wizard, /fetch\(buildApiUrl\("\/coach-onboarding-draft"/);
  assert.match(wizard, /body: JSON\.stringify\(settings\.coachOnboardingDraft\)/);
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
