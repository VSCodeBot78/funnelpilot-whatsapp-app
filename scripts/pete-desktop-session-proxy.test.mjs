import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Real Express + installed Vite + loopback HTTP. No browser, provider key,
// billing evidence or paid/model request is needed for session/status.
test("desktop login through the real dashboard proxy, no external requests", async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-session-proxy-"));
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("PETE_") && /QA.*ENABLED|QA_2026/.test(key)) process.env[key] = "false";
  }
  Object.assign(process.env, {
    NODE_ENV: "development", DATA_DIR: dataDir, GITHUB_ACTIONS: "false",
    FUNNELPILOT_LOCAL_TEST_MODE: "true", DISABLE_DESTRUCTIVE_ROUTES: "true",
    INSTAGRAM_ENGINE_ENABLED: "false", INSTAGRAM_SEND_ENABLED: "false",
    WHATSAPP_SEND_ENABLED: "false", WHATSAPP_ALLOW_ALL_RECIPIENTS: "false",
    INSTAGRAM_ALLOW_ALL_SENDERS: "false", INSTAGRAM_AUTO_ENABLE_NEW_LEADS: "false",
    ENABLE_GENERIC_WEBHOOKS: "false", WHATSAPP_ALLOWED_RECIPIENT_IDS: "",
    INSTAGRAM_ALLOWED_SENDER_IDS: "", PETE_MOBILE_LAB_ENABLED: "false",
    PETE_LLM_CONVERSATION_ENABLED: "false", PETE_LLM_API_CALLS_APPROVED: "false",
    OPENAI_MODEL: "gpt-6.1-sol", OPENAI_API_KEY: "", CORS_ORIGIN: "",
  });
  const nativeFetch = globalThis.fetch;
  let externalCalls = 0;
  globalThis.fetch = async () => { externalCalls++; throw Error("network_forbidden_in_session_test"); };
  const nativeWarn = console.warn;
  const diagnostics = [];
  console.warn = (...args) => { diagnostics.push(args.join(" ")); };
  let app;
  let observedHost;
  const backend = http.createServer((req, res) => { observedHost = req.headers.host; app(req, res); });
  const proxies = [];
  const request = (port, route, { method = "POST", headers = {}, body = "{}" } = {}) =>
    new Promise((resolve, reject) => {
      const req = http.request({ hostname: "127.0.0.1", port, path: "/test-chat/desktop/" + route,
        method, headers: { Host: "127.0.0.1:5173", Origin: "http://127.0.0.1:5173",
          "X-Pete-Desktop": "1", "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json", ...headers } }, res => {
        const chunks = [];
        res.on("data", chunk => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString();
          resolve({ status: res.statusCode, headers: res.headers,
            body: raw.startsWith("{") ? JSON.parse(raw) : null });
        });
      });
      req.on("error", reject);
      req.end(method === "GET" ? undefined : body);
    });
  try {
    await new Promise((resolve, reject) => { backend.once("error", reject); backend.listen(0, "127.0.0.1", resolve); });
    const backendPort = backend.address().port;
    process.env.PORT = String(backendPort);
    ({ default: app } = await import("../backend/src/app.ts"));
    const { assertDesktopRuntimeSafe } = await import("../backend/src/services/pete-api-budget.service.ts");
    const { createServer, loadConfigFromFile } = await import("../dashboard/node_modules/vite/dist/node/index.js");
    const root = fileURLToPath(new URL("../dashboard", import.meta.url));
    const configPath = path.join(root, "vite.config.js");
    const { config } = await loadConfigFromFile({ command: "serve", mode: "development" }, configPath, root);
    async function proxy(legacy = false) {
      const productionRule = config.server.proxy["/test-chat"];
      // Only the ephemeral test port changes. Preserve the real rule's hostname
      // and changeOrigin semantics; never "fix" headers in the test harness.
      const target = new URL(typeof productionRule === "string" ? productionRule : productionRule.target);
      target.port = String(backendPort);
      const rule = legacy || typeof productionRule === "string" ? target.href
        : { ...productionRule, target: target.href };
      const server = await createServer({ configFile: configPath, root, envFile: false,
        logLevel: "silent", server: { middlewareMode: true, hmr: false,
          proxy: { "/test-chat": rule } } });
      const listener = http.createServer(server.middlewares);
      proxies.push({ server, listener });
      await new Promise((resolve, reject) => { listener.once("error", reject); listener.listen(0, "127.0.0.1", resolve); });
      return listener.address().port;
    }
    const port = await proxy();
    let session;
    await t.test("runtime and direct session accept the owner's safe IPv4 request", async () => {
      assert.doesNotThrow(assertDesktopRuntimeSafe);
      assert.equal((await request(backendPort, "session")).status, 200);
    });
    await t.test("actual Vite rule preserves the browser Host and accepts IPv4 login", async () => {
      diagnostics.length = 0;
      session = await request(port, "session");
      if (session.status !== 200) console.info("[desktop-proxy-diagnostic] " + JSON.stringify({
        status: session.status, runtimeSafe: true,
        hostMatchesOrigin: new URL("http://" + observedHost).hostname === "127.0.0.1",
        reason: diagnostics.find(line => line.startsWith("[pete-desktop]")) ?? "no_safe_diagnostic",
      }));
      assert.equal(session.status, 200, "actual dashboard proxy must preserve the guarded browser hostname");
      assert.equal(observedHost, "127.0.0.1:5173");
      assert.match(session.headers["set-cookie"][0], /HttpOnly/);
      assert.match(session.headers["set-cookie"][0], /SameSite=Strict/);
    });
    await t.test("legacy Vite string proxy reproduces exactly desktop_host_denied", async () => {
      const oldPort = await proxy(true);
      diagnostics.length = 0;
      const old = await request(oldPort, "session");
      assert.equal(old.status, 403);
      assert.equal(old.body.error, "desktop_local_session_required");
      assert.equal(observedHost, "localhost:" + backendPort);
      assert.deepEqual(diagnostics, ["[pete-desktop] request_denied reason=desktop_host_denied"]);
    });
    await t.test("same-host localhost remains a valid desktop origin", async () => {
      assert.equal((await request(port, "session", { headers: { Host: "localhost:5173", Origin: "http://localhost:5173" } })).status, 200);
    });
    await t.test("forged host, missing marker, forwarded headers, cross-site and non-JSON stay denied", async () => {
      for (const headers of [
        { Host: "evil.invalid:5173" }, { Host: "localhost:5173" }, { "X-Pete-Desktop": "" },
        { Forwarded: "for=127.0.0.1" }, { "X-Forwarded-Host": "127.0.0.1:5173" },
        { "Sec-Fetch-Site": "cross-site" }, { "Content-Type": "text/plain" },
      ]) assert.equal((await request(port, "session", { headers })).status, 403);
    });
    await t.test("unsafe runtime flags still block the session; diagnostics never echo request values", async () => {
      diagnostics.length = 0;
      for (const key of ["GITHUB_ACTIONS", "PETE_MOBILE_LAB_ENABLED", "PETE_REPEATABLE_QA_ENABLED", "PETE_LLM_API_CALLS_APPROVED"]) {
        const old = process.env[key]; process.env[key] = "true";
        try { assert.equal((await request(port, "session")).status, 403); }
        finally { if (old === undefined) delete process.env[key]; else process.env[key] = old; }
      }
      const canary = "DO_NOT_LOG_REQUEST_VALUES";
      await request(backendPort, "session", { headers: { Host: "%" + canary, Cookie: canary, "X-Pete-CSRF": canary } });
      assert.ok(diagnostics.includes("[pete-desktop] request_denied reason=desktop_runtime_unsafe"));
      assert.ok(diagnostics.includes("[pete-desktop] request_denied reason=desktop_guard_denied"));
      assert.ok(diagnostics.every(line => /^\[pete-desktop\] request_denied reason=desktop_[a-z_]+$/.test(line)));
      assert.ok(diagnostics.every(line => !line.includes(canary)));
    });
    await t.test("proxied cookie/CSRF status succeeds but unverified history and paid gate remain locked", async () => {
      // Obtain afresh so this test stays independent of an earlier login failure.
      const valid = await request(backendPort, "session");
      const headers = { Cookie: valid.headers["set-cookie"][0].split(";")[0], "X-Pete-CSRF": valid.body.csrfToken };
      const result = await request(port, "status", { method: "GET", headers });
      assert.equal(result.status, 200);
      assert.equal(result.body.budget.historyVerified, false);
      assert.equal(result.body.budget.enabled, false);
      assert.equal(result.body.budget.blockReason, "historical_spend_unverified");
      assert.equal(result.body.globalApiCallsApproved, false);
      assert.equal(result.body.sendsEnabled, false);
      assert.equal((await request(port, "status", { method: "GET", headers: { ...headers, "X-Pete-CSRF": "" } })).status, 403);
      assert.equal(fs.existsSync(path.join(dataDir, "pete-api-budget.json")), false);
      assert.equal(externalCalls, 0);
    });
  } finally {
    for (const { server, listener } of proxies) {
      listener.closeAllConnections();
      await new Promise(resolve => listener.close(resolve));
      await server.close();
    }
    backend.closeAllConnections();
    await new Promise(resolve => backend.close(resolve));
    globalThis.fetch = nativeFetch;
    console.warn = nativeWarn;
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
