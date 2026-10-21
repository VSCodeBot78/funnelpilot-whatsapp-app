import type { ConversationState } from "../types/types.js";

/** Lead language only, never model output. A question limit is not an opt-out. */
function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function refusesQuestions(value: string): boolean {
  return /\bkeine\s+(?:(?:weiteren?|zusatzlichen?|neuen?|mehr)\s+)?nachfragen\b/.test(value) ||
    /\bkeine\s+(?:weiteren?|neuen?|zusatzlichen?|mehr)\s+fragen\b/.test(value) ||
    /\b(?:bitte\s+keine\s+fragen\s+mehr|keine\s+fragen\s+mehr\s+bitte)\b/.test(value) ||
    /\b(?:hor|hort)\s+(?:bitte\s+)?auf[,\s]+(?:mich\s+)?auszufragen\b/.test(value) ||
    /\b(?:ich\s+)?(?:will|mochte|brauche)\s+(?:jetzt\s+)?keine\s+fragen\b/.test(value) ||
    /\b(?:nicht|ohne)\s+(?:dauernd\s+|standig\s+|weiter\s+)?ausgefragt\b/.test(value) ||
    /\b(?:ich\s+)?(?:will|mochte)\s+nicht\s+(?:dauernd|standig|weiter)\s+ausgefragt\b/.test(value) ||
    /\b(?:frag|frage)\s+(?:(?:mich|bitte)\s+){0,2}nicht\s+(?:mehr|weiter)\b/.test(value) ||
    /\b(?:hor|hort)\s+auf\s+(?:mit\s+)?(?:den\s+)?(?:fragen|nachfragen)\b/.test(value);
}

function invitesQuestions(value: string): boolean {
  return /\b(?:du\s+)?(?:darfst|kannst)\s+(?:mich\s+)?(?:(?:jetzt|wieder|ruhig|gerne)\s+){0,3}fragen\b/.test(value) ||
    /\b(?:frag|frage)\s+(?:mich\s+)?(?:(?:ruhig|gerne|wieder)\s+){1,3}(?:weiter|nach|etwas)?\b/.test(value) ||
    /\bfragen\s+sind\s+(?:jetzt\s+|wieder\s+)?(?:ok|okay|in\s+ordnung)\b/.test(value);
}

/**
 * Respect the user's most recent explicit instruction across messages.
 * An unrelated follow-up does not silently cancel an earlier boundary.
 */
export function hasPeteActiveNoQuestionBoundary(
  state: Pick<ConversationState, "messages">,
): boolean {
  for (const entry of [...(state.messages ?? [])].reverse()) {
    if (entry.role !== "user") continue;
    const text = normalize(String(entry.text ?? ""));
    if (refusesQuestions(text)) return true;
    if (invitesQuestions(text)) return false;
  }
  return false;
}
