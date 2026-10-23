import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "../dashboard/node_modules/playwright/index.mjs";

// Real Chromium + production React/client + real Vite/Express. In particular,
// NEVER add Origin in a fixture: the browser must supply its own headers.
test("desktop browser reads pass the unchanged Origin/CSRF guard without provider network", { timeout: 90000 }, async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-desktop-browser-"));
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
  const nativeWarn = console.warn;
  const diagnostics = [];
  const observed = [];
  let externalCalls = 0;
  let blockedBrowserRequests = 0;
  globalThis.fetch = async () => { externalCalls++; throw Error("provider_network_forbidden_in_browser_test"); };
  console.warn = (...args) => { diagnostics.push(args.join(" ")); };
  let app, vite, browser;
  const backend = http.createServer((req, res) => {
    if (req.url.startsWith("/test-chat/desktop/")) {
      // Booleans/status only. Never retain or log cookies or CSRF values.
      const record = { method: req.method, route: req.url, hasOrigin: Boolean(req.headers.origin) };
      observed.push(record);
      res.once("finish", () => { record.status = res.statusCode; });
    }
    app(req, res);
  });
  const origin = "http://127.0.0.1:5173";
  try {
    await new Promise((resolve, reject) => { backend.once("error", reject); backend.listen(0, "127.0.0.1", resolve); });
    process.env.PORT = String(backend.address().port);
    ({ default: app } = await import("../backend/src/app.ts"));
    const { createServer, loadConfigFromFile } = await import("../dashboard/node_modules/vite/dist/node/index.js");
    const root = fileURLToPath(new URL("../dashboard", import.meta.url));
    const configPath = path.join(root, "vite.config.js");
    const { config } = await loadConfigFromFile({ command: "serve", mode: "development" }, configPath, root);
    const productionRule = config.server.proxy["/test-chat"];
    const target = new URL(typeof productionRule === "string" ? productionRule : productionRule.target);
    target.port = process.env.PORT;
    const proxyRule = typeof productionRule === "string" ? target.href : { ...productionRule, target: target.href };
    vite = await createServer({ configFile: configPath, root, envFile: false, logLevel: "silent",
      plugins: [{ name: "isolated-desktop-browser-test", configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!["/__pete_browser_client", "/__pete_browser_ui"].includes(req.url)) return next();
          const component = req.url.endsWith("_ui") ? `<div id="root"></div><script type="module">
            import React from '/node_modules/.vite/deps/react.js';
            import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
            import ChatTest from '/src/App.chat.jsx';
            ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode, null, React.createElement(ChatTest)));
            </script>` : "";
          res.setHeader("Content-Type", "text/html");
          res.end(await server.transformIndexHtml(req.url,
            '<!doctype html><html lang="de"><head><title>Pete browser regression</title></head><body>' + component + '</body></html>'));
        });
      } }],
      server: { host: "127.0.0.1", port: 5173, strictPort: true, hmr: false, proxy: { "/test-chat": proxyRule } },
    });
    await vite.listen();
    browser = await chromium.launch({ headless: true });
    async function isolatedPage() {
      const context = await browser.newContext({ serviceWorkers: "block" });
      await context.route("**/*", route => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        blockedBrowserRequests++;
        return route.abort();
      });
      const page = await context.newPage();
      await page.goto(origin + "/__pete_browser_client");
      return { page, context };
    }
    const { page, context } = await isolatedPage();
    await t.test("real production client obtains session and budget status with browser-generated Origin", async () => {
      const result = await page.evaluate(async () => {
        const { createPeteDesktopClient } = await import("/src/services/peteDesktopLab.js");
        try {
          const status = await createPeteDesktopClient().status();
          return { ok: status.ok, historyVerified: status.budget.historyVerified,
            enabled: status.budget.enabled, blockReason: status.budget.blockReason,
            knownHistoricalBookedUsd: status.budget.knownHistoricalBookedUsd,
            globalApiCallsApproved: status.globalApiCallsApproved, sendsEnabled: status.sendsEnabled };
        } catch (error) { return { error: error.message }; }
      });
      assert.equal(result.ok, true, "real browser status must pass, not just a manually supplied Origin fixture");
      assert.equal(result.historyVerified, false);
      assert.equal(result.enabled, false);
      assert.equal(result.blockReason, "historical_spend_unverified");
      assert.equal(result.knownHistoricalBookedUsd, 11.158772);
      assert.equal(result.globalApiCallsApproved, false);
      assert.equal(result.sendsEnabled, false);
      assert.ok(observed.some(r => r.route.endsWith("/status") && r.method === "POST" && r.hasOrigin && r.status === 200));
    });
    await t.test("original same-origin GET omits Origin and remains denied even with valid cookie and CSRF", async () => {
      diagnostics.length = 0;
      const status = await page.evaluate(async () => {
        const session = await fetch("/test-chat/desktop/session", { method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-Pete-Desktop": "1" }, body: "{}" }).then(r => r.json());
        return (await fetch("/test-chat/desktop/status", { credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-Pete-Desktop": "1", "X-Pete-CSRF": session.csrfToken } })).status;
      });
      assert.equal(status, 403);
      assert.ok(observed.some(r => r.route.endsWith("/status") && r.method === "GET" && !r.hasOrigin && r.status === 403));
      assert.deepEqual(diagnostics, ["[pete-desktop] request_denied reason=desktop_origin_denied"]);
    });
    await t.test("server-issued test contact and state can be read by the real production client", async () => {
      const result = await page.evaluate(async () => {
        const { createPeteDesktopClient } = await import("/src/services/peteDesktopLab.js");
        const client = createPeteDesktopClient();
        const lead = await client.newLead();
        try { const state = await client.state(lead.leadId); return { ok: state.ok, count: state.state.messages.length }; }
        catch (error) { return { error: error.message }; }
      });
      assert.equal(result.ok, true);
      assert.equal(result.count, 0);
      assert.ok(observed.some(r => r.route.includes("/state/") && r.method === "POST" && r.hasOrigin && r.status === 200));
    });
    await t.test("POST read aliases still require real session, CSRF, marker and JSON", async () => {
      const invalid = await isolatedPage();
      try {
        const statuses = await invalid.page.evaluate(async () => {
          const statuses = [];
          for (const route of ["status", "state/lab_desktop_unissued"]) {
            for (const headers of [
              { "Content-Type": "application/json", "X-Pete-Desktop": "1" },
              { "Content-Type": "application/json" },
              { "Content-Type": "text/plain", "X-Pete-Desktop": "1" },
            ]) statuses.push((await fetch("/test-chat/desktop/" + route,
              { method: "POST", credentials: "same-origin", headers, body: "{}" })).status);
          }
          return statuses;
        });
        assert.deepEqual(statuses, [403, 403, 403, 403, 403, 403]);
      } finally { await invalid.context.close(); }
    });
    await t.test("actual React test chat displays verified budget data and preserves historical-spend lock", async () => {
      await page.goto(origin + "/__pete_browser_ui");
      await page.waitForFunction(() => document.body.innerText.includes("11.158772 USD") ||
        document.body.innerText.includes("desktop_local_session_required"), undefined, { timeout: 15000 });
      const text = await page.locator("body").innerText();
      assert.ok(text.includes("11.158772 USD"), "real React mount must receive budget data");
      assert.ok(text.includes("Frühere Laptop-Ausgaben und Kostenbelege sind nicht vollständig abgeglichen."));
      assert.ok(!text.includes("Der lokale Backend-Status ist nicht erreichbar."));
      const toggle = page.getByRole("switch", { name: "KI AN (kostenpflichtig)" });
      assert.equal(await toggle.isDisabled(), true);
      assert.equal(await toggle.getAttribute("aria-checked"), "false");
    });
    await context.close();
    await t.test("read-only regression creates no budget ledger and makes zero paid or external requests", () => {
      assert.equal(fs.existsSync(path.join(dataDir, "pete-api-budget.json")), false);
      assert.equal(observed.filter(r => /\/(budget|message)$/.test(r.route)).length, 0);
      assert.equal(externalCalls, 0);
      assert.equal(blockedBrowserRequests, 0);
    });
  } finally {
    await browser?.close();
    await vite?.close();
    backend.closeAllConnections();
    await new Promise(resolve => backend.close(resolve));
    globalThis.fetch = nativeFetch;
    console.warn = nativeWarn;
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
