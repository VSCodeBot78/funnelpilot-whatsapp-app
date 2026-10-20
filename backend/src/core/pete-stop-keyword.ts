/**
 * STOP/STOPP are commands only as standalone words.
 * "stopfe", "Stopfen", "Stoppuhr" or "Ausstopfen" must never end a chat.
 * Other explicit opt-out phrases keep their existing matching semantics.
 */
const STOP_WORD = /(?:^|[^\p{L}\p{N}])stop(?=$|[^\p{L}\p{N}])/iu;
const STOPP_WORD = /(?:^|[^\p{L}\p{N}])stopp(?=$|[^\p{L}\p{N}])/iu;

export function findPeteStopKeyword(
  normalizedInput: string,
  keywords: readonly string[],
): string | undefined {
  return keywords.find((keyword) => {
    if (keyword === "stop") return STOP_WORD.test(normalizedInput);
    if (keyword === "stopp") return STOPP_WORD.test(normalizedInput);
    return normalizedInput.includes(keyword);
  });
}
