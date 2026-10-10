import { env } from "../config/env.js";

/**
 * Provider-trial guard: explicit WhatsApp E.164 recipient allowlist.
 * Safe default is "nobody"; blank or malformed numbers never pass.
 * An explicit allow-all is reserved for a separately approved cutover.
 * When a list is populated it always wins over allow-all, like Instagram.
 */
export function normalizeWhatsappRecipient(value: unknown): string {
  const text = String(value ?? "").trim();
  return /^\+?[1-9]\d{6,14}$/.test(text) ? text.replace(/^\+/, "") : "";
}

export function isWhatsappRecipientAllowed(
  recipient: string,
  allowlist = env.WHATSAPP_ALLOWED_RECIPIENT_IDS,
  allowAllRecipients = env.WHATSAPP_ALLOW_ALL_RECIPIENTS,
): boolean {
  const id = normalizeWhatsappRecipient(recipient);
  if (!id) return false;
  const allowed = new Set(allowlist.map(normalizeWhatsappRecipient).filter(Boolean));
  if (allowed.size > 0) return allowed.has(id);
  return allowAllRecipients === true;
}
