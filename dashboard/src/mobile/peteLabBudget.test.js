import fs from "node:fs";
import zlib from "node:zlib";
import assert from "node:assert/strict";
import test from "node:test";
import { readPeteBudget, formatUsd, budgetCounterChange } from "./peteLabBudget.js";

const sample = { ok: true, hardCapUsd: 8, committedUsd: 4.32,
  confirmedUsd: 4.30, reservedUsd: 0.02, remainingUsd: 3.68,
  requestsStarted: 20, requestsMetered: 19, inputTokens: 1400,
  outputTokens: 200, blocked: false };

test("Pete laboratory renders only valid backend ledger, not assumed API credit", () => {
  const budget = readPeteBudget(sample);
  assert.equal(budget.cap, 8);
  assert.equal(budget.spent, 4.32);
  assert.equal(budget.left, 3.68);
  assert.equal(budget.low, false);
  assert.equal(budget.inputTokens, 1400);
  assert.equal(readPeteBudget({ ok: false, reason: "ledger_unavailable" }), null);
  assert.equal(readPeteBudget({ ...sample, confirmedUsd: 0 }), null);
  assert.equal(readPeteBudget({ ...sample, remainingUsd: -2 }), null);
  assert.equal(readPeteBudget({ ...sample, hardCapUsd: NaN }), null);
});
test("private $2 GPT-5.4 session is distinct from cumulative $8 project meter", () => {
  const active = readPeteBudget({
    ...sample,
    hardCapUsd: 8, committedUsd: 4.5839, confirmedUsd: 4.5839, reservedUsd: 0,
    remainingUsd: 2, labAuthorizedUsd: 2, labCommittedUsd: 0, labRemainingUsd: 2,
    llmReady: true, mode: "gpt-5.4",
  });
  assert.ok(active);
  assert.equal(active.mode, "gpt-5.4");
  assert.equal(active.cap, 8);
  assert.equal(active.labCap, 2);
  assert.equal(active.labLeft, 2);
  assert.equal(active.labSpent, 0);
  const used = readPeteBudget({
    ...sample, committedUsd: 4.8839, confirmedUsd: 4.8839, reservedUsd: 0,
    remainingUsd: 1.7, labAuthorizedUsd: 2, labCommittedUsd: 0.3, labRemainingUsd: 1.7,
    llmReady: true, mode: "gpt-5.4",
  });
  assert.equal(used.labSpent, 0.3);
  assert.equal(used.labLeft, 1.7);
  assert.equal(readPeteBudget({ ...sample, mode: "deterministic",
    llmReady: false }).mode, "deterministic");
  assert.equal(readPeteBudget({ ...sample, llmReady: false,
    mode: "gpt-5.4" }).mode, "deterministic");
  assert.equal(readPeteBudget({ ...sample, labAuthorizedUsd: 2.5,
    labCommittedUsd: 0, labRemainingUsd: 2.5 }), null,
    "UI must reject an unauthorized larger cap");
});

test("clearly shows tiny call charges and fail-closed threshold", () => {
  assert.equal(formatUsd(0.00028), "0,0003 $");
  assert.equal(formatUsd(4602.4, 2), "4.602,40 $");
  assert.equal(formatUsd(1.9815, 4), "1,9815 $");
  assert.equal(formatUsd(undefined), "nicht verfügbar");
  assert.ok(Math.abs(budgetCounterChange(readPeteBudget(sample),
    readPeteBudget({ ...sample, committedUsd: 4.32028, confirmedUsd: 4.30028,
      remainingUsd: 3.67972 })) - 0.00028) < 1e-8);
  assert.equal(budgetCounterChange(readPeteBudget(sample), null), null);
  assert.equal(budgetCounterChange(readPeteBudget(sample),
    readPeteBudget({ ...sample, committedUsd: 3, confirmedUsd: 2.98,
      remainingUsd: 5 })), null);
  assert.equal(readPeteBudget({ ...sample, committedUsd: 7.4, confirmedUsd: 7.38,
    remainingUsd: .6 }).low, true);
  assert.equal(readPeteBudget({ ...sample, committedUsd: 8, confirmedUsd: 7.98,
    remainingUsd: 0, blocked: true }).blocked, true);
});


test("temporary Pete PWA manifest and generated icons are structurally valid", () => {
  const manifest = JSON.parse(fs.readFileSync(
    new URL("../../public/pete-lab.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.start_url, "/pete-test");
  assert.equal(manifest.scope, "/pete-test");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.length, 2);
  for (const size of [192, 512]) {
    const png = fs.readFileSync(new URL(
      "../../public/pete-lab-icon-" + size + ".png", import.meta.url));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    const idat = [];
    let cursor = 8;
    while (cursor < png.length - 12) {
      const length = png.readUInt32BE(cursor);
      const type = png.subarray(cursor + 4, cursor + 8).toString("ascii");
      if (type === "IDAT") idat.push(png.subarray(cursor + 8, cursor + 8 + length));
      cursor += length + 12;
      if (type === "IEND") break;
    }
    assert.ok(idat.length > 0, "PNG must have image data");
    assert.equal(zlib.inflateSync(Buffer.concat(idat)).length, size * (size + 1));
  }
  const sw = fs.readFileSync(new URL("../../public/pete-lab-sw.js", import.meta.url), "utf8");
  assert.doesNotMatch(sw, /caches\.open|CacheStorage|put\(/);
});
