import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runXWingOfflinePreflight } from "./xwing-offline-preflight.mjs";
const dir = path.dirname(fileURLToPath(import.meta.url));
const launcher = fs.readFileSync(path.join(dir, "start-xwing-offline.ps1"), "utf8");
const rootCmd = fs.readFileSync(path.join(dir, "../FunnelPilot-XWing-Offline-starten.cmd"), "utf8");

const ready = {
  ok: true, service: "funnel-pilot-backend", status: "ready",
  nodeEnv: "development", localLaptopSafeMode: true,
  instagramSendEnabled: false, whatsappSendEnabled: false,
  whatsappAllowAllRecipients: false, whatsappAllowedRecipientCount: 0,
  instagramEngineEnabled: false, instagramAllowAllSenders: false,
  instagramAutoEnableNewLeads: false, instagramAllowedSenderCount: 0,
  genericWebhooksEnabled: false, destructiveRoutesDisabled: true,
  openAiApiKeyConfigured: false, metaSendConfigured: false,
  instagramSendConfigured: false, publicBackendUrlConfigured: false,
  webhookBaseUrlConfigured: false,
  dataDir: fileURLToPath(new URL("../backend/data/xwing-offline", import.meta.url)),
};
function fakeFetch(state = ready, html = '<script type="module" src="/src/main.jsx"></script>') {
  return async (url, opts) => {
    assert.ok(url === "http://127.0.0.1:3001/health/readiness" ||
      url === "http://127.0.0.1:5173/");
    assert.equal(opts.redirect, "manual");
    return url.includes("/health/")
      ? { status: 200, json: async () => state }
      : { status: 200, text: async () => html };
  };
}

test("X-Wing launcher is detached-worktree-only with offline credentials and local ports", () => {
  for (const required of [
    'FunnelPilot-Desktop-Test', 'branch --show-current', 'Node.js 20',
    'node_modules', 'Test-LocalPortFree', '127.0.0.1',
    "data\\xwing-offline", 'OPENAI_API_KEY', 'CALENDLY_PAT',
    'OAUTH_TOKEN_ENCRYPTION_KEY', 'INSTAGRAM_SEND_ENABLED = "false"',
    'WHATSAPP_SEND_ENABLED = "false"', 'INSTAGRAM_ENGINE_ENABLED = "false"',
    'DISABLE_DESTRUCTIVE_ROUTES = "true"', 'FUNNELPILOT_LOCAL_TEST_MODE = "true"',
    'WHATSAPP_ALLOWED_RECIPIENT_IDS = " "', 'INSTAGRAM_ALLOWED_SENDER_IDS = " "',
    'ENABLE_GENERIC_WEBHOOKS = "false"', 'xwing-offline-preflight.mjs',
    'if (-not $ready)', 'Start-Process "http://127.0.0.1:5173/"',
  ]) assert.ok(launcher.includes(required), required);
  assert.equal([...launcher].filter(char => char.charCodeAt(0) > 127).length, 0);
  assert.doesNotMatch(launcher, /cloudflared|--host 0\.0\.0\.0|git\s+(?:pull|push|reset|checkout|switch)|npm\.cmd\s+ci/);
  assert.ok(rootCmd.includes('start-xwing-offline.ps1'));
});

test("Windows detached HEAD branch check handles empty git output without bypassing safety", () => {
  // In Windows PowerShell 5.1, a command that prints nothing can yield $null.
  // The launcher must coerce git output to an array before .Trim().
  assert.ok(launcher.includes('(@(& git.exe -C $repo branch --show-current) -join "").Trim()'));
  assert.ok(launcher.includes('if ($LASTEXITCODE -ne 0 -or $branch)'));
  assert.ok(!launcher.includes('([string](& git.exe -C $repo branch --show-current)).Trim()'));
});

test("X-Wing Windows backend startup keeps DATA_DIR and npm as separate commands", () => {
  // A concatenation followed immediately by a comma in PowerShell 5.1
  // turns the two intended lines into an invalid single command.
  assert.ok(launcher.includes("$dataDirAssignment = '$env:DATA_DIR = ' +"));
  const commandSection = launcher.split("$backendCommand = @(")[1]
    ?.split("$dashboardCommand = @(")[0] || "";
  assert.ok(commandSection.includes("$dataDirAssignment,"));
  assert.ok(commandSection.includes("'npm.cmd run dev'"));
  assert.doesNotMatch(commandSection, /'\\$env:DATA_DIR = '\\s*\\+[^\\n]*,[\\r\\n]+\\s*'npm\\.cmd run dev'/);
});

test("X-Wing local preflight passes only when known local services are safe", async () => {
  const pass = await runXWingOfflinePreflight({ fetchImpl: fakeFetch() });
  assert.deepEqual(pass, { passed: true, failures: [] });
  const drifted = await runXWingOfflinePreflight({
    fetchImpl: fakeFetch({ ...ready, instagramSendEnabled: true,
      dataDir: "/not-the-xwing-sandbox", openAiApiKeyConfigured: true }),
  });
  assert.equal(drifted.passed, false);
  assert.ok(drifted.failures.some(v => v.includes("instagramSendEnabled")));
  assert.ok(drifted.failures.some(v => v.includes("isolierten")));
  assert.ok(drifted.failures.some(v => v.includes("openAiApiKeyConfigured")));
});

test("X-Wing local preflight rejects absent or unexpected frontend/backend", async () => {
  assert.equal((await runXWingOfflinePreflight({
    fetchImpl: fakeFetch(ready, "Unexpected local service"),
  })).passed, false);
  assert.equal((await runXWingOfflinePreflight({
    fetchImpl: async () => { throw new Error("offline"); },
  })).passed, false);
});
