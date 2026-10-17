import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { getCampaignDraftChanges } from "./campaignDraftChanges.js";

const settings = { defaultBookingUrl: "", maxSuggestions: 2 };
const saved = {
  id: "draft-1", name: "Elterncheck", trigger: "CHECK",
  peteCampaign: { sources: ["instagram_dm"], keywords: ["CHECK"],
    openingText: "Hey!", flowDraftEnabled: false },
  booking: { provider: "manual", externalBookingUrl: "" },
  followUp24h: "", followUp3d: "",
};

test("Desktop draft guard: initial values and reverted edit do not show false warning", () => {
  assert.equal(getCampaignDraftChanges(saved, saved, settings), false);
  assert.equal(getCampaignDraftChanges({ ...saved }, saved, settings), false);
  assert.equal(getCampaignDraftChanges({ ...saved, name: "Changed" }, saved, settings), true);
  assert.equal(getCampaignDraftChanges({ ...saved, name: "Elterncheck" }, saved, settings), false);
});

test("Desktop draft guard: catches campaign flow, booking, offer and message changes", () => {
  assert.equal(getCampaignDraftChanges({
    ...saved, peteCampaign: { ...saved.peteCampaign, flowDraftEnabled: true },
  }, saved, settings), true);
  assert.equal(getCampaignDraftChanges({
    ...saved, booking: { ...saved.booking, externalBookingUrl: "https://example.com/" },
  }, saved, settings), true);
  assert.equal(getCampaignDraftChanges({
    ...saved, offerContext: { infoLink1Url: "https://example.org/" },
  }, saved, settings), true);
  assert.equal(getCampaignDraftChanges({
    ...saved, followUp24h: "Hey nochmal!",
  }, saved, settings), true);
});

test("Desktop draft guard: ephemeral typing fields do not create false dirty markers", () => {
  const input = { ...saved, peteCampaign: {
    ...saved.peteCampaign, _keywordDraft: "CHECK, ", _reelMediaDraft: "123",
    _linkUrlDraft: "https://",
  } };
  assert.equal(getCampaignDraftChanges(input, saved, settings), false);
  assert.equal(getCampaignDraftChanges({ ...saved, id: "another-id" }, saved, settings), false);
});

test("Desktop draft guard: selection and create guard use persisted baseline; saving cannot clear a newer edit", () => {
  const view = fs.readFileSync(new URL("./campaignsView.jsx", import.meta.url), "utf8");
  const app = fs.readFileSync(new URL("../App.dashboard.jsx", import.meta.url), "utf8");
  const hook = fs.readFileSync(new URL("../hooks/useCampaigns.js", import.meta.url), "utf8");
  assert.match(view, /getCampaignDraftChanges\(/);
  assert.match(view, /campaignFormBaseline/);
  assert.match(view, /setPendingNavigation\(\{ type: "select", id \}\)/);
  assert.match(view, /setPendingNavigation\(\{ type: "create", templateId \}\)/);
  assert.match(view, /Speichern und fortfahren/);
  assert.match(view, /Änderungen verwerfen und fortfahren/);
  assert.match(app, /campaignFormBaseline=\{campaignFormBaseline\}/);
  assert.match(app, /const result = await deleteCampaign\(\)/);
  assert.match(hook, /setCampaignFormBaseline/);
  assert.match(hook, /getCampaignDraftChanges\(prev, campaignForm, settings\)/);
});
