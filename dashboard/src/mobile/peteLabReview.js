/**
 * Temporary mobile Pete laboratory review metadata.
 * Only references to synthetic test IDs and feedback are stored in browser storage.
 * Test-chat message text remains on the backend; real customer data is forbidden.
 */
export const LAB_HISTORY_KEY = "fp-pete-lab-history-v1";
export const LAB_REVIEW_PREFIX = "fp-pete-lab-review-v1:";
export const MAX_TESTS = 12;
export const MAX_REVIEWS = 60;
export const MAX_NOTE_LENGTH = 400;

export function isSyntheticLabId(value) {
  return typeof value === "string" && /^lab_[A-Za-z0-9_-]{20,90}$/.test(value);
}

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

export function loadTestHistory(storage) {
  let raw;
  try { raw = safeParse(storage?.getItem(LAB_HISTORY_KEY)); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.filter(item => {
    if (!item || !isSyntheticLabId(item.id) || seen.has(item.id) ||
        typeof item.title !== "string" || !item.title.trim()) return false;
    seen.add(item.id);
    return true;
  }).map(item => ({ id: item.id, title: item.title.slice(0, 64) }))
    .slice(0, MAX_TESTS);
}

export function rememberTest(history, id, title = "Fiktiver Test") {
  if (!isSyntheticLabId(id)) return Array.isArray(history) ? history : [];
  const valid = Array.isArray(history) ? history : [];
  const previous = valid.find(item => item.id === id);
  return [
    { id, title: previous?.title ?? String(title).slice(0, 64) },
    ...valid.filter(item => item.id !== id),
  ].slice(0, MAX_TESTS);
}

export function saveTestHistory(storage, history) {
  try { storage?.setItem(LAB_HISTORY_KEY, JSON.stringify(history)); return true; }
  catch { return false; }
}

export function sanitizeReviews(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [messageId, value] of Object.entries(raw).slice(0, MAX_REVIEWS)) {
    if (messageId.length > 120 || !messageId ||
        !value || typeof value !== "object" || Array.isArray(value)) continue;
    const rating = value.rating === "gut" || value.rating === "verbessern"
      ? value.rating : null;
    const note = typeof value.note === "string"
      ? value.note.slice(0, MAX_NOTE_LENGTH) : "";
    if (rating || note.trim()) out[messageId] = { rating, note };
  }
  return out;
}

export function loadReviews(storage, id) {
  if (!isSyntheticLabId(id)) return {};
  try { return sanitizeReviews(safeParse(storage?.getItem(LAB_REVIEW_PREFIX + id))); }
  catch { return {}; }
}

export function saveReviews(storage, id, reviews) {
  if (!isSyntheticLabId(id)) return false;
  try {
    storage?.setItem(LAB_REVIEW_PREFIX + id,
      JSON.stringify(sanitizeReviews(reviews)));
    return true;
  } catch { return false; }
}

export function buildReviewExport(messages, reviews) {
  if (!Array.isArray(messages)) return "";
  const lines = [];
  let previousUserText = "";
  const cleaned = sanitizeReviews(reviews);
  for (const m of messages) {
    if (m?.role === "user" && typeof m.text === "string") {
      previousUserText = m.text;
      continue;
    }
    if (m?.role !== "assistant" || typeof m.text !== "string") continue;
    const feedback = cleaned[String(m.id)];
    if (!feedback?.rating && !feedback?.note.trim()) continue;
    lines.push([
      "Test-Elternteil: " + (previousUserText || "(Kontext vorher im Testchat)"),
      "Pete: " + m.text,
      "Bewertung: " + (feedback.rating || "noch offen"),
      ...(feedback.note.trim() ? ["Notiz: " + feedback.note.trim()] : []),
    ].join("\n"));
  }
  return lines.length
    ? "Pete-Testfeedback (synthetische Gespräche)\n\n" + lines.join("\n\n---\n\n")
    : "";
}
