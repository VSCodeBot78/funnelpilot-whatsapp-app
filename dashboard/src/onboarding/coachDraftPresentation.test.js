import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  emptyCoachDraft, editableCoachDraft,
  coachDraftChecklist, coachDraftCompletion,
} from "./coachDraftPresentation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = relative => fs.readFileSync(path.resolve(here, relative), "utf8");

test("new coach template starts blank and cannot inherit Jochen's active offers or brand", () => {
  const empty = emptyCoachDraft();
  assert.equal(empty.brand.name, "");
  assert.equal(empty.assistant.name, "");
  assert.equal(empty.offers.length, 0);
  assert.equal(empty.links.bookingUrl, "");
  assert.equal(empty.schemaVersion, 1);
  assert.equal(coachDraftCompletion(empty).readyForReview, false);
  assert.equal(coachDraftCompletion(empty).checked, 0);
});

test("draft completeness is transparent, not a live approval or billing state", () => {
  const draft = emptyCoachDraft();
  draft.brand.name = "Neue Coachmarke";
  draft.brand.coachName = "Mara";
  draft.brand.niche = "Coaching";
  draft.brand.audience = "Berufstätige";
  draft.assistant.name = "Nora";
  draft.assistant.voice = "freundlich";
  draft.assistant.escalation = "Mensch übernimmt bei Rückfragen";
  draft.assistant.boundaries = "Keine Diagnose";
  draft.offers = [{
    name: "Kurs", priceText: "", forWhom: "", linkUrl: "https://example.org/angebot",
  }];
  assert.deepEqual(coachDraftCompletion(draft), {
    readyForReview: true, checked: 6, total: 6,
  });
  assert.equal(coachDraftChecklist(draft).length, 6);
  assert.equal(draft.offers[0].priceText, "", "Never invent missing pricing");
});

test("the editable payload discards any accidental live, tenant and auth fields", () => {
  const clean = editableCoachDraft({
    schemaVersion: 1, status: "active", workspaceId: "other",
    aiEnabled: true, apiKey: "secret",
    brand: { name: "Coach", customSecret: "x", coachName: "Mara" },
    assistant: { name: "Nora", liveSend: true },
    links: { guideUrl: "https://example.org", oauthToken: "x" },
    offers: [{ name: "A", forWhom: "", priceText: "", linkUrl: "",
      confirmedPayment: true }],
  });
  assert.equal(clean.status, undefined);
  assert.equal(clean.workspaceId, undefined);
  assert.equal(clean.aiEnabled, undefined);
  assert.equal(clean.apiKey, undefined);
  assert.equal(clean.brand.customSecret, undefined);
  assert.equal(clean.assistant.liveSend, undefined);
  assert.equal(clean.links.oauthToken, undefined);
  assert.equal(clean.offers[0].confirmedPayment, undefined);
});

test("coach screen stays separate from live Pete and is reachable from management/setup", () => {
  const nav = read("../navigation/dashboardNavigation.js");
  const app = read("../App.dashboard.jsx");
  const wizard = read("./SetupWizardModal.jsx");
  const page = read("./CoachDraftView.jsx");
  assert.match(nav, /coach-draft/);
  assert.match(app, /section === "coach-draft"/);
  assert.match(app, /<CoachDraftView/);
  assert.match(wizard, /onOpenSection\("coach-draft"\)/);
  assert.match(page, /Vorlage speichern/);
  assert.match(page, /Vorschau/);
  assert.match(page, /get.+/);
  assert.match(page, /method: "POST"/);
  assert.match(page, /editableCoachDraft\(draft\)/);
  assert.doesNotMatch(page, /sendManualMessage|\/test-chat\/message|activatePete|INSTAGRAM_SEND_ENABLED/);
});
