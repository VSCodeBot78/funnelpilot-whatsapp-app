import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const file = fs.readFileSync(path.join(dirname, "start-local.ps1"), "utf8");

test("Windows one-click launcher is non-destructive and explicitly disables all live sends", () => {
  for (const value of [
    'INSTAGRAM_ENGINE_ENABLED = "false"',
    'INSTAGRAM_SEND_ENABLED = "false"',
    'INSTAGRAM_ALLOW_ALL_SENDERS = "false"',
    'INSTAGRAM_AUTO_ENABLE_NEW_LEADS = "false"',
    'INSTAGRAM_ALLOWED_SENDER_IDS = ""',
    'WHATSAPP_SEND_ENABLED = "false"',
    'ENABLE_GENERIC_WEBHOOKS = "false"',
    'DISABLE_DESTRUCTIVE_ROUTES = "true"',
    'FUNNELPILOT_LOCAL_TEST_MODE = "true"',
    'CORS_ORIGIN = "http://127.0.0.1:5173"',
    'LOCAL_ALLOW_CALENDLY_WEBHOOK = "false"',
  ]) {
    assert.ok(file.includes(value), "missing safe state: " + value);
  }
  assert.doesNotMatch(file, /cloudflared\.exe|cloudflared\s+tunnel\s+--url/i);
  assert.doesNotMatch(file, /&\s*git(?:\.exe)?\s+[^\r\n]*(reset|clean|push|checkout|pull)\b/i);
  assert.ok(file.includes('funnel-pilot-current'));
  assert.ok(file.includes('127.0.0.1:3001'));
  assert.ok(file.includes('127.0.0.1:5173'));
  assert.ok(file.includes('Port $port ist bereits belegt'));
});

test("Windows one-click launcher validates project before starting services", () => {
  assert.ok(file.includes('Invoke-Checked "Backend: Build und Tests"'));
  assert.ok(file.includes('Invoke-Checked "Dashboard: Build und Tests"'));
  assert.ok(file.indexOf('Invoke-Checked "Dashboard: Build und Tests"') <
    file.indexOf("Start-PowerShellWindow \"Funnel Pilot Backend"));
  assert.ok(file.includes("param([switch]$CheckOnly)"));
  assert.ok(file.includes('Test-Path -LiteralPath $envPath'));
  assert.ok(file.includes('Copy-Item -LiteralPath $examplePath -Destination $envPath'));
  assert.ok(file.includes('Start-Process $dashboardUrl'));
  assert.ok(file.includes('local-safety-preflight.mjs'));
  assert.ok(file.includes('Lokaler Sicherheits-Preflight'));
  assert.ok(file.includes('Webhook-Relay Port 3002 nicht bereit'));
  assert.ok(file.includes('SICHERHEITS-STOP'));
  assert.ok(
    file.indexOf('Invoke-Checked "Lokaler Sicherheits-Preflight') <
      file.indexOf('Start-Process $dashboardUrl'),
    "Open the dashboard only after dynamic HTTP safety gates pass",
  );
});
