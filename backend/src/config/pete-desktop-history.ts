/** Immutable evidence floor, NOT a second ledger or an OpenAI balance.
 * Read on 2026-10-23 from the existing project's budget branch. Historical
 * booked amounts include conservative charges for uncertain requests.
 * Earlier laptop usage has NOT been reconciled. This snapshot alone can
 * never unlock paid desktop calls.
 */
export const PETE_DESKTOP_HISTORY = Object.freeze({
  ledgerCommit: "5822b3d7e35ac74b62ff0eaba221755cb46bdf30",
  ledgerBlob: "0f15a243416eeab53f527d2f88d4d280f0fe1f07",
  originalBookedMicroUsd: 7_817_830,
  extraBookedMicroUsd: 3_340_942,
  knownBookedMicroUsd: 11_158_772,
  // Existing USD8 + conservative USD5 project envelopes, never a new grant.
  projectCeilingMicroUsd: 13_000_000,
});

export const PETE_DESKTOP_BUDGET_CHOICES = [250_000, 500_000, 1_000_000, 2_000_000] as const;
