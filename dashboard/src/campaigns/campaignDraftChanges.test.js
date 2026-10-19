import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { getCampaignDraftChanges } from "./campaignDraftChanges.js";
import { getCampaignSaveInputError } from "./campaignSaveValidation.js";

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

test("Desktop draft guard: incomplete keyword and HTTPS typing is not silently discarded", () => {
  const input = { ...saved, peteCampaign: {
    ...saved.peteCampaign, _keywordDraft: "CHECK, ", _reelMediaDraft: "123",
    _linkUrlDraft: "https://",
  } };
  assert.equal(getCampaignDraftChanges(input, saved, settings), true);
  const unchangedKeyword = { ...saved, peteCampaign: {
    ...saved.peteCampaign, _keywordDraft: "CHECK",
  } };
  assert.equal(getCampaignDraftChanges(unchangedKeyword, saved, settings), false);
  const unfinishedLink = { ...saved, peteCampaign: {
    ...saved.peteCampaign, _linkUrlDraft: "https://",
  } };
  assert.equal(getCampaignDraftChanges(unfinishedLink, saved, settings), true);
  const unfinishedKeyword = { ...saved, peteCampaign: {
    ...saved.peteCampaign, _keywordDraft: "CHECK, INV",
  } };
  assert.equal(getCampaignDraftChanges(unfinishedKeyword, saved, settings), true);
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

test("Desktop typing: link and DM button labels keep a trailing space until save", () => {
  const editor = fs.readFileSync(new URL("./CampaignEditor.jsx", import.meta.url), "utf8");
  const flow = fs.readFileSync(new URL("./CampaignFlowEditor.jsx", import.meta.url), "utf8");
  for (const field of ["linkLabel", "openingDmButtonLabel"]) {
    assert.ok(editor.includes(`key === "${field}"`));
    assert.ok(flow.includes(`onChange={(e) => onChange("${field}", e.target.value)}`));
  }
  for (const field of ["_linkLabelDraft", "_openingDmButtonLabelDraft"]) {
    assert.ok(editor.includes(field));
  }
  assert.ok(flow.includes("linkLabelDraft ?? config.linkLabel"));
  assert.ok(flow.includes("openingDmButtonLabelDraft ?? config.openingDmButtonLabel"));
  const drafted = { ...saved, peteCampaign: {
    ...saved.peteCampaign, _linkLabelDraft: "Zum Eltern Check ",
  } };
  assert.equal(getCampaignDraftChanges(drafted, saved, settings), true);
  const dmDraft = { ...saved, peteCampaign: {
    ...saved.peteCampaign, _openingDmButtonLabelDraft: "Ja, zeig mir das Bundle ",
  } };
  assert.equal(getCampaignDraftChanges(dmDraft, saved, settings), true);
  assert.ok(flow.includes("Antwortvariante {i + 1}"));
  assert.ok(flow.includes("Alternative DM {i + 2}"));
  assert.ok(!flow.includes("Antwortvariante ${i + 1}"));
  assert.ok(!flow.includes("Alternative DM ${i + 2}"));
});

test("Desktop save: invalid keyword token and incomplete HTTPS link fail before backend writes", () => {
  const badKeyword = { ...saved, peteCampaign: {
    ...saved.peteCampaign, _keywordDraft: "CHECK, bad keyword",
  } };
  assert.match(getCampaignSaveInputError(badKeyword), /Keyword enthält ungültige/);
  const startedLink = { ...saved, peteCampaign: {
    ...saved.peteCampaign, _linkUrlDraft: "https://",
    linkEnabled: true,
  } };
  assert.match(getCampaignSaveInputError(startedLink), /HTTPS-Link ist noch unvollständig/);
  const maliciousLink = { ...saved, peteCampaign: {
    ...saved.peteCampaign, _linkUrlDraft: "javascript:alert(1)",
    linkEnabled: true,
  } };
  assert.match(getCampaignSaveInputError(maliciousLink), /HTTPS-Link/);
  const good = { ...saved, peteCampaign: {
    ...saved.peteCampaign,
    _keywordDraft: "CHECK, KETO", keywords: ["CHECK", "KETO"],
    _linkUrlDraft: "https://check.jochen-kammerer.de",
    linkUrl: "https://check.jochen-kammerer.de/",
    linkEnabled: true,
  } };
  assert.equal(getCampaignSaveInputError(good), null);
  assert.equal(getCampaignSaveInputError(saved), null);
  const hook = fs.readFileSync(new URL("../hooks/useCampaigns.js", import.meta.url), "utf8");
  assert.match(hook, /const inputError = getCampaignSaveInputError\(campaignForm\)/);
  assert.match(hook, /if \(inputError\) \{\s*setCampaignMessage\(inputError\);\s*return false;/);
});

test("Desktop editor retains incomplete typing across toggles before owner explicitly saves", () => {
  const editor = fs.readFileSync(new URL("./CampaignEditor.jsx", import.meta.url), "utf8");
  assert.match(editor, /function preserveTypedCampaignDrafts\(peteCampaign\)/);
  const hits = editor.match(/\.\.\.preserveTypedCampaignDrafts\(prev\.peteCampaign\)/g) || [];
  assert.equal(hits.length, 5, "all flow button-label, entry/keyword/link/reel edits must preserve in-progress typing");
  assert.match(editor, /key === "linkEnabled" && value === false/);
  assert.match(editor, /_linkUrlDraft: undefined/);
});
