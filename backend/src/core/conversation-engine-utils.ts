/** Shared pure helpers for the conversation engine. No business rules or side effects. */
export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function nowIso(): string {
  return new Date().toISOString();
}
