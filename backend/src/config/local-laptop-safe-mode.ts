/**
 * Phase 39 – startup interlock for the unattended LOCAL Windows test.
 * Never interpret this mode as authorization for real Meta sends.
 * Pure validation allows negative CI tests without provider access.
 */
export function assertSafeLocalLaptopEnvironment(
  values: Record<string, string | undefined>,
): void {
  if (values.FUNNELPILOT_LOCAL_TEST_MODE !== "true") return;

  if (values.NODE_ENV !== "development") {
    throw new Error("local_laptop_lock_requires_development");
  }
  const mustBeFalse = [
    "INSTAGRAM_ENGINE_ENABLED",
    "INSTAGRAM_SEND_ENABLED",
    "WHATSAPP_SEND_ENABLED",
    "WHATSAPP_ALLOW_ALL_RECIPIENTS",
    "INSTAGRAM_ALLOW_ALL_SENDERS",
    "INSTAGRAM_AUTO_ENABLE_NEW_LEADS",
    "ENABLE_GENERIC_WEBHOOKS",
  ];
  for (const key of mustBeFalse) {
    if (values[key]?.trim().toLowerCase() !== "false") {
      throw new Error("local_laptop_lock_requires_false_" + key);
    }
  }
  if (values.WHATSAPP_ALLOWED_RECIPIENT_IDS?.trim() !== "") {
    throw new Error("local_laptop_lock_requires_empty_whatsapp_allowlist");
  }
  if (values.INSTAGRAM_ALLOWED_SENDER_IDS?.trim() !== "") {
    throw new Error("local_laptop_lock_requires_empty_instagram_allowlist");
  }
  if (values.DISABLE_DESTRUCTIVE_ROUTES?.trim().toLowerCase() !== "true") {
    throw new Error("local_laptop_lock_requires_destructive_routes_disabled");
  }
}
