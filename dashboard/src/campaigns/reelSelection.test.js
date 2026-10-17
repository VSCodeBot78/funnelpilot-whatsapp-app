import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { MAX_REEL_IDS, parseReelMediaIds } from "./reelSelection.js";

test("Desktop reel picker: several IDs can be added without duplicates", () => {
  const original = ["17851537767246649"];
  const selection = parseReelMediaIds(
    "17851537767246649, 17851537767246650\n17851537767246651",
    original,
  );
  assert.equal(selection.ok, true);
  assert.deepEqual(selection.ids, [
    "17851537767246649", "17851537767246650", "17851537767246651",
  ]);
  assert.deepEqual(original, ["17851537767246649"]);
});

test("Desktop reel picker: rejects URL guesses, text, invalid digits and empty entries", () => {
  for (const raw of [
    "", "https://www.instagram.com/reel/ABC/", "ABC",
    "17851537767246649, UNSAFE", "123", "17851537767246649<script>",
  ]) {
    const choice = parseReelMediaIds(raw, ["17851537767246649"]);
    assert.equal(choice.ok, false, raw);
    assert.deepEqual(choice.ids, ["17851537767246649"]);
    assert.ok(choice.error);
  }
});

test("Desktop reel picker: refuses >40 selected IDs and accepts valid boundary", () => {
  const ids = Array.from({ length: MAX_REEL_IDS }, (_, i) => String(17851537767240000n + BigInt(i)));
  const full = parseReelMediaIds(ids.join("\n"));
  assert.equal(full.ok, true);
  assert.deepEqual(full.ids, ids);
  const exceeded = parseReelMediaIds("17851537767246649", ids);
  assert.equal(exceeded.ok, false);
  assert.deepEqual(exceeded.ids, ids);
});

test("Desktop reel picker: editable selected Reel cards and safe fallback are wired", () => {
  const picker = fs.readFileSync(new URL("./ReelSelectionEditor.jsx", import.meta.url), "utf8");
  const editor = fs.readFileSync(new URL("./CampaignEditor.jsx", import.meta.url), "utf8");
  assert.match(picker, /parseReelMediaIds\(draft, reelMediaIds\)/);
  assert.match(picker, /onChange\(reelMediaIds\.filter/);
  assert.match(picker, /campaignId\]/);
  assert.match(picker, /aria-label=\{`Reel-Media-ID/);
  assert.match(picker, /Ein Reel-Link ist nicht automatisch eine Media-ID/);
  assert.doesNotMatch(picker, /fetch\(|axios|MetaGraph|sendMessage/);
  assert.match(editor, /<ReelSelectionEditor/);
  assert.match(editor, /reelMediaIds=\{peteCampaign\.reelMediaIds\}/);
  assert.doesNotMatch(editor, /_reelMediaDraft/);
});

test("Desktop flow chat mock only displays configured steps without sending or opening links", () => {
  const preview = fs.readFileSync(new URL("./CampaignFlowPreview.jsx", import.meta.url), "utf8");
  const editor = fs.readFileSync(new URL("./CampaignFlowEditor.jsx", import.meta.url), "utf8");
  assert.ok(editor.includes("<CampaignFlowPreview colors={colors} config={config} />"));
  assert.match(preview, /config\.autoReplyEnabled === true/);
  assert.match(preview, /config\.linkEnabled === true/);
  assert.match(preview, /config\.peteHandoffEnabled === true/);
  assert.match(preview, /VORSCHAU · KEIN LIVE-VERSAND/);
  assert.match(preview, /Noch keine feste Nachricht/);
  assert.doesNotMatch(preview, /href=|onClick=|fetch\(|sendMessage|axios|MetaGraph|OpenAI/);
});
