import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { filterCampaigns } from "./campaignSearch.js";
import { getCampaignDraftChanges } from "./campaignDraftChanges.js";

const fixtures = [
  { id: "a", name: "Elterncheck DM", peteCampaign: {
    sources: ["instagram_dm"], keywords: ["CHECK"],
  } },
  { id: "b", name: "Reel BULLSHIT", peteCampaign: {
    sources: ["instagram_reel_comment"], keywords: ["BULLSHIT"],
  } },
  { id: "c", name: "Keto Story", peteCampaign: {
    sources: ["instagram_story_reply"], keywords: ["KETO"],
  } },
];

test("Desktop campaign finder searches names, keywords and sources without mutation", () => {
  assert.equal(filterCampaigns(fixtures, ""), fixtures);
  assert.equal(filterCampaigns(fixtures, "  ").length, 3);
  assert.deepEqual(filterCampaigns(fixtures, "kEtO").map((x) => x.id), ["c"]);
  assert.deepEqual(filterCampaigns(fixtures, "check").map((x) => x.id), ["a"]);
  assert.deepEqual(filterCampaigns(fixtures, "reel-kommentar").map((x) => x.id), ["b"]);
  assert.deepEqual(filterCampaigns(fixtures, "insta").map((x) => x.id), ["a"]);
  assert.deepEqual(filterCampaigns(fixtures, "unbekannt"), []);
  assert.equal(fixtures.length, 3);
});

test("Desktop campaign finder is visibly connected and accessible", () => {
  const list = fs.readFileSync(new URL("./CampaignList.jsx", import.meta.url), "utf8");
  assert.match(list, /filterCampaigns\(campaigns, query\)/);
  assert.match(list, /type="search"/);
  assert.match(list, /aria-label="Kampagnen nach Name, Keyword oder Einstieg durchsuchen"/);
  assert.match(list, /Keine Kampagne gefunden/);
  assert.match(list, /aria-current=\{activeCampaignId === camp.id/);
});

test("Desktop unsaved form guard compares confirmed baseline before switching or creating", () => {
  const view = fs.readFileSync(new URL("./campaignsView.jsx", import.meta.url), "utf8");
  const hook = fs.readFileSync(new URL("../hooks/useCampaigns.js", import.meta.url), "utf8");
  assert.match(view, /getCampaignDraftChanges\\(/);
  assert.match(view, /campaignForm, campaignFormBaseline, settings/);
  assert.match(view, /setPendingNavigation\\(\\{ type: "select", id \\}\\)/);
  assert.match(view, /setPendingNavigation\\(\\{ type: "create", templateId \\}\\)/);
  assert.match(view, /Speichern und fortfahren/);
  assert.match(view, /Änderungen verwerfen und fortfahren/);
  assert.match(view, /Zurück zum Bearbeiten/);
  assert.match(view, /const saved = await onSaveCampaign\\(\\)/);
  assert.match(view, /startedAtRevision === editRevisionRef.current/);
  assert.match(view, /onSelectCampaign=\\{requestCampaignSelection\\}/);
  assert.match(view, /onCampaignFormChange=\\{trackFormChange\\}/);
  assert.match(hook, /setCampaignFormBaseline\\(/);
  assert.match(hook, /setCampaignMessage\\("Kampagne und Buchungslogik gespeichert."\\);\\s*return true;/);
  assert.match(hook, /"Kampagne nicht im Backend gespeichert. Änderungen bleiben im Formular."\\);\\s*return false;/);
});

test("Desktop draft baseline ignores reverted changes but catches material edits", () => {
  const base = { id: "one", name: "Elterncheck",
    peteCampaign: { sources: ["instagram_dm"], keywords: ["CHECK"],
      openingText: "Hey!", autoReplyEnabled: false } };
  assert.equal(getCampaignDraftChanges(base, structuredClone(base)), false);
  const changed = structuredClone(base);
  changed.peteCampaign.autoReplyEnabled = true;
  assert.equal(getCampaignDraftChanges(changed, base), true);
  changed.peteCampaign.autoReplyEnabled = false;
  assert.equal(getCampaignDraftChanges(changed, base), false);
  changed.name = "Neue Kampagne";
  assert.equal(getCampaignDraftChanges(changed, base), true);
  const unrelated = { ...changed, id: "other" };
  assert.equal(getCampaignDraftChanges(unrelated, base), false);
});

test("Desktop selected template reaches backend, delete waits for confirmed result", () => {
  const app = fs.readFileSync(new URL("../App.dashboard.jsx", import.meta.url), "utf8");
  assert.match(app, /async function handleCreateNewCampaign\(templateId = "blank"\)/);
  assert.match(app, /await createNewCampaign\(templateId\)/);
  assert.match(app, /async function handleDeleteCampaign\(\)/);
  assert.match(app, /const result = await deleteCampaign\(\)/);
  assert.match(app, /return result;/);
});
