/** Match explicit STOP phrases as complete words, never as fragments of normal language.
 * E.g. "stopfe" and "Stoppuhr" must not silence a conversation.
 * This is intentionally limited to hard-stop detection, not general keyword scoring.
 */
function normalizedWords(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchExplicitStopPhrase(
  inputText: string,
  keywords: readonly string[],
): string | undefined {
  const normalized = normalizedWords(inputText);
  if (!normalized) return undefined;
  const inputWithBoundaries = ` ${normalized} `;
  return keywords.find((keyword) => {
    const phrase = normalizedWords(keyword);
    return Boolean(phrase && inputWithBoundaries.includes(` ${phrase} `));
  });
}
