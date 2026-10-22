/**
 * Product-facing AI model contract.
 *
 * Pete has exactly one supported product model. Older mini and the isolated
 * GPT-5.4 lab remain readable for historical QA and finance reconciliation,
 * but MUST NOT be product selectable or silently used on production sends.
 */
export const PETE_PRODUCT_MODEL = "gpt-6.1-sol" as const;

export function normalizePeteProductModel(_stored: unknown): typeof PETE_PRODUCT_MODEL {
  // Migration on read: a historical persisted model must never be offered.
  return PETE_PRODUCT_MODEL;
}

export type PeteRuntimeModel = "gpt-6.1-sol" | "gpt-4.1-mini" | "gpt-5.4";

/**
 * An env override is allowed ONLY if it matches the product setting.
 * A laptop still configured with mini must fail closed, not quietly bill mini
 * while the dashboard claims it uses Sol.
 *
 * Test-only historical fixtures keep mini. Existing GPT-5.4 laboratory
 * authorization is preserved separately from customer-facing selection.
 */
export function resolvePeteRuntimeModel(args: {
  envModel?: string | null;
  nodeEnv?: string | null;
  labGpt54Approved?: boolean;
}): PeteRuntimeModel | null {
  const supplied = (args.envModel ?? "").trim();
  // Test runners have historical Mini/5.4 cost and safety fixtures. Preserve
  // those only when NODE_ENV=test; no customer-facing product path uses them.
  if (!supplied) return args.nodeEnv === "test" ? "gpt-4.1-mini" : PETE_PRODUCT_MODEL;
  if (supplied === PETE_PRODUCT_MODEL) return PETE_PRODUCT_MODEL;
  if (supplied === "gpt-5.4" && (args.labGpt54Approved === true || args.nodeEnv === "test")) return "gpt-5.4";
  if (supplied === "gpt-4.1-mini" && args.nodeEnv === "test") return "gpt-4.1-mini";
  return null;
}
