/** Production-facing model policy for Pete. Historical models remain in QA ledgers only.
 * Never silently expose an unpriced or deprecated model to customers.
 */
export const PETE_PRODUCT_MODEL = "gpt-6.1-sol" as const;
export const PETE_PRODUCT_MODEL_LABEL = "GPT-6.1 Sol";

export function isPeteProductModel(value: unknown): value is typeof PETE_PRODUCT_MODEL {
  return value === PETE_PRODUCT_MODEL;
}

/** Existing persisted mini/blank values are migrated in memory. No API calls on read. */
export function normalizePersistedPeteModel(_value: unknown): typeof PETE_PRODUCT_MODEL {
  return PETE_PRODUCT_MODEL;
}
