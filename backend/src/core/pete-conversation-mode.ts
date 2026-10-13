import { readSettings } from "../services/settings-store.js";

/**
 * One shared source of truth for inbound DM routing.
 * Pete's natural/LLM conversation must not accidentally fall through into the
 * historical A/B/C question chain when a channel forgets conversationMode.
 *
 * Legacy remains an explicit, reversible compatibility choice until the
 * future migration is finished; no feature flag or paid API gate is changed.
 */
export function getConfiguredPeteConversationMode(): "natural" | "legacy" {
  return readSettings().dmConversationMode === "legacy" ? "legacy" : "natural";
}
