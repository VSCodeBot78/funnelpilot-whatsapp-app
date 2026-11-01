/** Only synthetic authenticated local-laptop sessions may retry technical
 * provider/budget failures without taking over as a human. Real leads and
 * genuine model/safety handoffs retain the existing human ownership gates. */
export function isRetryableDesktopTechnicalFailure(
  reason: string, isDesktopSession: boolean,
): boolean {
  return isDesktopSession && [
    "not_authorized", "provider_unavailable", "budget_unavailable", "budget_exhausted",
  ].includes(reason);
}
