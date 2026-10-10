import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "fp-oauth-test-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = temp;
process.env.OAUTH_TOKEN_ENCRYPTION_KEY = "d0".repeat(32);
process.env.GOOGLE_OAUTH_CLIENT_ID = "google-local-test";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "only-for-the-test";
process.env.GOOGLE_OAUTH_REDIRECT_URI =
  "http://localhost:3001/integrations/oauth/google_calendar/callback";
process.env.CALENDLY_OAUTH_CLIENT_ID = "";
process.env.HUBSPOT_OAUTH_CLIENT_ID = "";

const service = await import("../services/oauth-connect.service.js");
const { default: app } = await import("../app.js");

test("Provider one-click foundation: PKCE, CSRF, encryption and truthful status", async (t) => {
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));

  await t.test("setup-required providers have no sign-in URL", () => {
    const statuses = service.listConnectionStatuses();
    assert.equal(statuses.find(x => x.provider === "google_calendar")?.status, "ready_to_connect");
    assert.equal(statuses.find(x => x.provider === "hubspot")?.status, "setup_required");
    assert.throws(() => service.createAuthorization("hubspot"));
  });

  await t.test("one-click URL uses provider host, PKCE and exact redirect", () => {
    const { url, state } = service.createAuthorization("google_calendar");
    const oauth = new URL(url);
    assert.equal(oauth.hostname, "accounts.google.com");
    assert.equal(oauth.searchParams.get("client_id"), "google-local-test");
    assert.equal(oauth.searchParams.get("state"), state);
    assert.equal(oauth.searchParams.get("code_challenge_method"), "S256");
    assert.ok(oauth.searchParams.get("code_challenge"));
    assert.equal(
      oauth.searchParams.get("redirect_uri"),
      "http://localhost:3001/integrations/oauth/google_calendar/callback",
    );
    assert.throws(() => service.consumeAuthorization("google_calendar", state, "forged-cookie"));
    assert.throws(() => service.consumeAuthorization("google_calendar", state, state));
  });

  await t.test("successful exchange stores encrypted token; still not synced", async () => {
    const { state } = service.createAuthorization("google_calendar");
    const pending = service.consumeAuthorization("google_calendar", state, state);
    const originalFetch = globalThis.fetch;
    const simulatedToken = "provider-access-token-synthetic";
    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://oauth2.googleapis.com/token");
      assert.equal(init?.method, "POST");
      const body = init?.body as URLSearchParams;
      assert.equal(body.get("code_verifier"), pending.verifier);
      assert.equal(body.get("client_secret"), "only-for-the-test");
      return new Response(JSON.stringify({
        access_token: simulatedToken,
        refresh_token: "synthetic-refresh-token",
        expires_in: 3600,
        scope: "calendar.readonly",
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    try {
      await service.exchangeAuthorization("google_calendar", "synthetic-code", pending);
    } finally {
      globalThis.fetch = originalFetch;
    }
    const stored = fs.readFileSync(path.join(temp, "oauth-connections.enc.json"), "utf8");
    assert.ok(!stored.includes(simulatedToken));
    assert.ok(!stored.includes("synthetic-refresh-token"));
    const google = service.listConnectionStatuses().find(x => x.provider === "google_calendar");
    assert.equal(google?.status, "authorized_not_synced");
    assert.equal(google?.syncActive, false);
    assert.equal((await service.verifyProviderConnection("hubspot")).status, "not_authorized");

    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      assert.equal(
        String(url),
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
      );
      assert.equal(options?.method, "GET");
      assert.equal(options?.headers?.authorization, "Bearer " + simulatedToken);
      return new Response(JSON.stringify({ items: [{ id: "primary", summary: "Private Calendar" }] }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    };
    try {
      const checked = await service.verifyProviderConnection("google_calendar");
      assert.equal(checked.status, "api_verified_no_sync");
      assert.equal(checked.syncActive, false);
      assert.ok(checked.verifiedAt);
    } finally {
      globalThis.fetch = previousFetch;
    }
    const checkedStatus = service.listConnectionStatuses().find(x => x.provider === "google_calendar");
    assert.equal(checkedStatus?.status, "api_verified_no_sync");
    assert.equal(checkedStatus?.syncActive, false);
    const encryptedAfterCheck = fs.readFileSync(path.join(temp, "oauth-connections.enc.json"), "utf8");
    assert.ok(!encryptedAfterCheck.includes("Private Calendar"));
    assert.ok(!encryptedAfterCheck.includes(simulatedToken));

    service.disconnectProvider("google_calendar");
    assert.equal(
      service.listConnectionStatuses().find(x => x.provider === "google_calendar")?.status,
      "ready_to_connect",
    );
  });

  await t.test("status endpoint never returns provider tokens or secrets", async () => {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    try {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const base = "http://127.0.0.1:" + address.port;
      const blocked = await fetch(base + "/integrations/oauth/google_calendar/verify", {
        method: "POST",
      });
      assert.equal(blocked.status, 403, "API checks require the local dashboard origin");
      const status = await fetch(base + "/integrations/oauth/status");
      assert.equal(status.status, 200);
      const body = await status.text();
      assert.ok(body.includes("ready_to_connect"));
      assert.ok(body.includes("requires_meta_app_setup"));
      assert.ok(!body.includes("only-for-the-test"));
      assert.ok(!body.includes("provider-access-token-synthetic"));
      const forbiddenCallback = await fetch(
        base + "/integrations/oauth/google_calendar/callback?code=forged&state=forged",
        { redirect: "manual" },
      );
      assert.equal(forbiddenCallback.status, 303);
      const redirect = new URL(forbiddenCallback.headers.get("location") || "");
      assert.equal(redirect.searchParams.get("result"), "error");
      assert.ok(!redirect.toString().includes("forged"));
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
