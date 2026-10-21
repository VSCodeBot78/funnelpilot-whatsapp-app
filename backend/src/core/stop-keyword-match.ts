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
    if (!phrase) return false;
    // A standalone STOP command can have punctuation/spaces, but must not
    // match "stopfe", "Stoppuhr" or compound terms such as "Stop-Loss".
    if (phrase === "stop" || phrase === "stopp") {
      return /(?:^|[^\p{L}\p{N}-])stopp?(?=$|[^\p{L}\p{N}-])/iu.test(inputText);
    }
    return inputWithBoundaries.includes(` ${phrase} `);
  });
}
