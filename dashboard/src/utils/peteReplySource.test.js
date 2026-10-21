import assert from "node:assert/strict";
import test from "node:test";
import { describePeteReplySource } from "./peteReplySource.js";

test("real model replies are distinguishable from hardcoded templates", () => {
  assert.match(describePeteReplySource("llm"), /OpenAI-KI-Modell/);
  for (const source of [
    "verified_transaction", "guarded_safety", "deterministic",
    "legacy", "human_handoff", "llm_handoff", "safe_noncritical",
  ]) {
    assert.doesNotMatch(describePeteReplySource(source), /echte Modellantwort/, source);
  }
  assert.equal(describePeteReplySource(undefined), "Antwortquelle nicht verifiziert");
});
