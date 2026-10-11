import assert from "node:assert/strict";
import test from "node:test";
import {
  LAB_HISTORY_KEY, LAB_REVIEW_PREFIX, MAX_TESTS, MAX_NOTE_LENGTH,
  isSyntheticLabId, loadTestHistory, rememberTest, saveTestHistory,
  sanitizeReviews, loadReviews, saveReviews, buildReviewExport,
} from "./peteLabReview.js";

const id = "lab_123456789012345678901234";
function store() {
  const data = new Map();
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, String(value)); },
    items: data,
  };
}

test("only synthetic IDs can appear in local history", () => {
  assert.equal(isSyntheticLabId(id), true);
  assert.equal(isSyntheticLabId("instagram_12345678901234567890"), false);
  assert.equal(isSyntheticLabId("lab_short"), false);
  assert.equal(isSyntheticLabId("lab_../conversations/00000000000"), false);
  const storage = store();
  storage.setItem(LAB_HISTORY_KEY, JSON.stringify([
    { id: "lead_12345678901234567890123", title: "Existing customer" },
    { id, title: "Synthetic test" },
    { id, title: "Duplicate" },
    { id: "lab_abcdefghijklmnopqrstuvwxyz1234567", title: "" },
  ]));
  assert.deepEqual(loadTestHistory(storage), [{ id, title: "Synthetic test" }]);
});

test("tests can be resumed without persisting any conversation text", () => {
  const storage = store();
  let history = [];
  for (let i = 0; i < 15; i++)
    history = rememberTest(history, "lab_123456789012345678901" + String(i).padStart(3,"0"),
      "Test " + i);
  assert.equal(history.length, MAX_TESTS);
  assert.equal(history[0].title, "Test 14");
  assert.equal(saveTestHistory(storage, history), true);
  assert.deepEqual(loadTestHistory(storage), history);
  assert.equal(storage.getItem(LAB_HISTORY_KEY).includes("Meine private Nachricht"), false);
});

test("feedback notes and ratings survive reopen; malformed entries are discarded", () => {
  const storage = store();
  const reviews = {
    "reply-1": { rating: "verbessern", note: "Eine kürzere, empathische Antwort." },
    "reply-2": { rating: "gut", note: "" },
    "reply-3": { rating: "unknown", note: "" },
    "reply-4": { rating: "verbessern", note: "x".repeat(600) },
  };
  assert.equal(saveReviews(storage, id, reviews), true);
  const saved = loadReviews(storage, id);
  assert.deepEqual(saved["reply-1"], reviews["reply-1"]);
  assert.equal(saved["reply-3"], undefined);
  assert.equal(saved["reply-4"].note.length, MAX_NOTE_LENGTH);
  assert.ok(storage.items.has(LAB_REVIEW_PREFIX + id));
  assert.deepEqual(loadReviews(storage, "instagram_customer_real"), {});
  assert.equal(saveReviews(storage, "instagram_customer_real", reviews), false);
  storage.setItem(LAB_REVIEW_PREFIX + id, "{malformed");
  assert.deepEqual(loadReviews(storage, id), {});
  assert.deepEqual(sanitizeReviews({ [String("a").repeat(130)]: { rating: "gut" } }), {});
});

test("export pairs each Pete reply with latest preceding fictional parent input", () => {
  const messages = [
    { role: "user", id: "u1", text: "Bin eine müde Mama." },
    { role: "assistant", id: "p1", text: "Was ist gerade am schwierigsten?" },
    { role: "user", id: "u2", text: "Das Einschlafen." },
    { role: "assistant", id: "p2", text: "Willst du ein PDF?" },
  ];
  const out = buildReviewExport(messages, {
    p1: { rating: "gut", note: "" },
    p2: { rating: "verbessern", note: "Zu schnell zum PDF. Erst zuhören." },
  });
  assert.match(out, /Bin eine müde Mama/);
  assert.match(out, /Das Einschlafen/);
  assert.match(out, /Zu schnell zum PDF/);
  assert.match(out, /synthetische Gespräche/);
  assert.equal(buildReviewExport(messages, {}), "");
});
