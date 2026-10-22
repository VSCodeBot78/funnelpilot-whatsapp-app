/** Product-facing model list. Older test models must not reappear in Pete settings. */
export const PETE_PRODUCT_MODEL = "gpt-6.1-sol";

export const PETE_MODEL_OPTIONS = Object.freeze([
  Object.freeze({ value: PETE_PRODUCT_MODEL, label: "GPT-6.1 Sol (Qualitätsmodell)" }),
]);

/** Legacy persisted values render as current product model until the owner saves. */
export function normalizePeteDashboardModel(_value) {
  return PETE_PRODUCT_MODEL;
}
