import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const launcher = readFileSync(new URL("./start-owner-laptop.ps1", import.meta.url), "utf8");
const repair = readFileSync(new URL("./owner-replace-api-key.ps1", import.meta.url), "utf8");
const cmd = readFileSync(new URL("../FunnelPilot-API-Key-Reparieren.cmd", import.meta.url), "utf8");

test("explicit owner DPAPI selection beats stale environment and .env keys", () => {
  const override = launcher.indexOf("if (Test-Path -LiteralPath $preferredFile)");
  const fallbackEnv = launcher.indexOf("if ($env:OPENAI_API_KEY -and $env:OPENAI_API_KEY.Trim()) { return }");
  const fallbackDotenv = launcher.indexOf('Select-String -LiteralPath $envFile');
  assert.ok(override > -1 && fallbackEnv > override && fallbackDotenv > fallbackEnv);
  assert.match(launcher, /\$env:OPENAI_API_KEY = \$key/);
  assert.match(launcher, /ConvertTo-SecureString/);
});

test("owner repair is an explicit protected local action, never a provider call", () => {
  assert.match(repair, /Read-Host .* -AsSecureString/);
  assert.match(repair, /ConvertFrom-SecureString/);
  assert.match(repair, /owner-dpapi-preferred\.flag/);
  assert.match(repair, /Move-Item .* -Force/);
  assert.doesNotMatch(repair, /Invoke-WebRequest|Invoke-RestMethod|\bfetch\(|api\.openai\.com\/v1\/|setx\b/i);
  assert.doesNotMatch(repair, /\.env.*Set-Content|pete-api-budget\.json|WHATSAPP_SEND_ENABLED.*true|INSTAGRAM_SEND_ENABLED.*true/i);
});

test("owner shortcut only runs protected repair and no secret is an argument", () => {
  assert.match(cmd, /owner-replace-api-key\.ps1/);
  assert.doesNotMatch(cmd, /OPENAI_API_KEY\s*=|sk-proj-|sk-[a-z0-9]{20}/i);
});
