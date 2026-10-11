/**
 * Safe, deliberately conservative treatment of Instagram shares/attachments.
 * We have NOT inspected the Reel/photo itself and MUST NOT infer its content.
 * Pure explicit keywords remain actionable even when a share accompanies them.
 * Contextual questions about an uninspected share require a human review.
 */
export type InstagramSharedMediaPolicy =
  | "normal_text"
  | "explicit_keyword"
  | "human_review";

export function evaluateInstagramSharedMedia(
  hasAttachments: boolean,
  text: string,
): InstagramSharedMediaPolicy {
  if (!hasAttachments) return "normal_text";
  const keyword = String(text || "").trim().normalize("NFKC").toUpperCase();
  // Only standalone, deliberate triggers. "Check das Reel 😂" is not CHECK.
  return /^(CHECK|KETO|BULLSHIT)$/.test(keyword)
    ? "explicit_keyword"
    : "human_review";
}
