import assert from "node:assert/strict";
import test from "node:test";
import { assertSafeLocalLaptopEnvironment } from "./local-laptop-safe-mode.js";

const locked = {
  FUNNELPILOT_LOCAL_TEST_MODE: "true",
  NODE_ENV: "development",
  INSTAGRAM_ENGINE_ENABLED: "false",
  INSTAGRAM_SEND_ENABLED: "false",
  WHATSAPP_SEND_ENABLED: "false",
  INSTAGRAM_ALLOW_ALL_SENDERS: "false",
  INSTAGRAM_AUTO_ENABLE_NEW_LEADS: "false",
  ENABLE_GENERIC_WEBHOOKS: "false",
  INSTAGRAM_ALLOWED_SENDER_IDS: "",
  DISABLE_DESTRUCTIVE_ROUTES: "true",
};

test("Phase 39 startup lock accepts only explicit safe laptop test configuration", () => {
  assert.doesNotThrow(() => assertSafeLocalLaptopEnvironment(locked));
  for (const key of [
    "INSTAGRAM_ENGINE_ENABLED", "INSTAGRAM_SEND_ENABLED",
    "WHATSAPP_SEND_ENABLED", "INSTAGRAM_ALLOW_ALL_SENDERS",
    "INSTAGRAM_AUTO_ENABLE_NEW_LEADS", "ENABLE_GENERIC_WEBHOOKS",
  ]) {
    assert.throws(
      () => assertSafeLocalLaptopEnvironment({ ...locked, [key]: "true" }),
      new RegExp(key), key);
    assert.throws(
      () => assertSafeLocalLaptopEnvironment({ ...locked, [key]: undefined }),
      new RegExp(key), "missing "+key);
  }
  assert.throws(() => assertSafeLocalLaptopEnvironment({
    ...locked, INSTAGRAM_ALLOWED_SENDER_IDS: "test-id",
  }), /empty_instagram_allowlist/);
  assert.throws(() => assertSafeLocalLaptopEnvironment({
    ...locked, DISABLE_DESTRUCTIVE_ROUTES: "false",
  }), /destructive_routes_disabled/);
  assert.throws(() => assertSafeLocalLaptopEnvironment({
    ...locked, NODE_ENV: "production",
  }), /requires_development/);
  // Regular existing test/prod environments do not acquire this local lock.
  assert.doesNotThrow(() => assertSafeLocalLaptopEnvironment({
    ...locked, FUNNELPILOT_LOCAL_TEST_MODE: "false",
    INSTAGRAM_SEND_ENABLED: "true",
  }));
});
