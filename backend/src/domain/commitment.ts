import type { ConversationState } from "../types/types.js";

const REALLY_START_KEYWORDS = [
  "a",
  "wirklich angehen",
  "ich will es angehen",
  "ich will das angehen",
  "wirklich",
  "angehen",
  "ja ich will",
  "ja",
];

const INFO_FIRST_KEYWORDS = [
  "b",
  "erstmal infos",
  "erst mal infos",
  "infos",
  "nur infos",
  "erstmal nur infos",
  "ich will erstmal infos",
  "ich möchte erstmal infos",
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function includesAnyKeyword(input: string, keywords: string[]): string | null {
  const normalized = normalizeText(input);

  for (const keyword of keywords) {
    if (normalized === normalizeText(keyword) || normalized.includes(normalizeText(keyword))) {
      return keyword;
    }
  }

  return null;
}

export function parseCommitmentChoice(
  input: string,
): "really_start" | "info_first" | null {
  const normalized = normalizeText(input);

  if (!normalized) {
    return null;
  }

  const infoFirstMatch = includesAnyKeyword(normalized, INFO_FIRST_KEYWORDS);
  if (infoFirstMatch) {
    return "info_first";
  }

  const reallyStartMatch = includesAnyKeyword(normalized, REALLY_START_KEYWORDS);
  if (reallyStartMatch) {
    return "really_start";
  }

  return null;
}

export function isReadyForBooking(state: ConversationState): boolean {
  return state.answers.commitmentChoice === "really_start";
}

export function isInfoOnlyCommitment(state: ConversationState): boolean {
  return state.answers.commitmentChoice === "info_first";
}
