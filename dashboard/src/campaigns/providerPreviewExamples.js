// Synthetic envelopes only. Never insert real access tokens, user IDs or
// personal messages into test examples. All endpoint results are preview-only.
export const PROVIDER_PREVIEW_EXAMPLES = [
  ["instagram_dm", "Instagram-DM (Text)"],
  ["instagram_echo", "Instagram-Echo (eigene Nachricht)"],
  ["instagram_comment", "Reel-Kommentar (noch nicht verifiziert)"],
  ["instagram_share", "Instagram-Share (manuelle Prüfung)"],
  ["whatsapp_dm", "WhatsApp-DM"],
  ["whatsapp_ctwa", "WhatsApp aus Meta-Anzeige"],
  ["whatsapp_status", "WhatsApp-Zustellstatus (kein Lead)"],
];

export function getSyntheticProviderPreviewExample(kind, messageText = "") {
  const text = String(messageText).slice(0, 2000);
  const ig = (extra = {}) => ({
    provider: "instagram",
    payload: {
      object: "instagram",
      entry: [{ messaging: [{
        sender: { id: "synthetic-sender" },
        recipient: { id: "synthetic-business" },
        message: { mid: "synthetic-id", text, ...extra },
      }] }],
    },
  });
  const wa = (extra = {}) => ({
    provider: "whatsapp",
    payload: {
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: {
        messages: [{
          id: "synthetic-id", from: "synthetic-sender",
          type: "text", text: { body: text }, ...extra,
        }],
      }}] }],
    },
  });
  if (kind === "instagram_dm") return ig();
  if (kind === "instagram_echo") return ig({ is_echo: true });
  if (kind === "instagram_share") return ig({ attachments: [{ type: "share" }] });
  if (kind === "instagram_comment") return {
    provider: "instagram",
    payload: {
      object: "instagram",
      entry: [{ changes: [{ field: "comments",
        value: { text, id: "synthetic-comment-id" } }] }],
    },
  };
  if (kind === "whatsapp_dm") return wa();
  if (kind === "whatsapp_ctwa") return wa({
    referral: { source_type: "ad", ad_id: "synthetic-ad-id" },
  });
  if (kind === "whatsapp_status") return {
    provider: "whatsapp",
    payload: {
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages",
        value: { statuses: [{ id: "synthetic-id", status: "sent" }] } }] }],
    },
  };
  return null;
}
