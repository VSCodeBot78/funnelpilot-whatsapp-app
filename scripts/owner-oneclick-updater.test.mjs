import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const updater = fs.readFileSync(path.join(root, "scripts/update-owner-laptop.ps1"), "utf8");
const cmd = fs.readFileSync(path.join(root, "FunnelPilot-Laptop-GO.cmd"), "utf8");
const launcher = fs.readFileSync(path.join(root, "scripts/start-owner-laptop.ps1"), "utf8");
const preview = fs.readFileSync(path.join(root, "dashboard/src/preview/DashboardPreview.jsx"), "utf8");
const app = fs.readFileSync(path.join(root, "dashboard/src/App.chat.jsx"), "utf8");
const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
const viteLab = fs.readFileSync(path.join(root, "dashboard/vite.lab.config.js"), "utf8");

test("generated mobile lab bundle cannot block a clean owner update", () => {
  assert.match(viteLab, /outDir:\s*"\.\.\/mobile-lab-dist"/);
  assert.match(gitignore, /^\/mobile-lab-dist\/$/m);
});


test("owner desktop shortcut invokes protected update BEFORE starting the local launcher", () => {
  assert.match(cmd, /update-owner-laptop\.ps1/);
  assert.match(updater, /git\.exe -C \$root fetch --no-tags origin/);
  assert.match(updater, /merge-base --is-ancestor HEAD \$target/);
  // Regression: Windows PowerShell must not split a dynamic branch suffix,
  // which previously produced only "refs/remotes/origin/" at runtime.
  assert.match(updater, /Read-Git @\("rev-parse","refs\/remotes\/origin\/feat\/dashboard-v2-preview-20261023"\)/);
  assert.match(updater, /fetch --no-tags origin "\+refs\/heads\/feat\/dashboard-v2-preview-20261023:refs\/remotes\/origin\/feat\/dashboard-v2-preview-20261023"/);
  assert.doesNotMatch(updater, /Read-Git @\("rev-parse","refs\/remotes\/origin\/" \+ \$branch\)/);
  assert.match(updater, /git\.exe -C \$root merge --ff-only \$target/);
  assert.match(updater, /status --porcelain --untracked-files=normal/);
  assert.match(updater, /Ensure-PortFree 3001/);
  assert.match(updater, /Ensure-PortFree 5173/);
  assert.match(updater, /VSCodeBot78\/funnelpilot-whatsapp-app/);
  assert.match(updater, /start-owner-laptop\.ps1/);
  assert.match(launcher, /INSTAGRAM_SEND_ENABLED = "false"/);
  assert.match(launcher, /WHATSAPP_SEND_ENABLED = "false"/);
  assert.match(launcher, /PETE_LLM_API_CALLS_APPROVED = "false"/);
  assert.doesNotMatch(updater, /git\.exe[^\r\n]*(?:reset|push|clean|rebase|checkout|merge --no-ff)/i);
  assert.doesNotMatch(updater, /api\.openai\.com|Meta Graph|cloudflared/);
  assert.ok([...updater].every(c => c.charCodeAt(0) < 128));
});

test("visible owner build version comes from same Git commit as backend and Vite", () => {
  for (const literal of ["VITE_FP_BUILD_SHA", "VITE_FP_BUILD_DATE",
    "FUNNELPILOT_BUILD_SHA", "FUNNELPILOT_BUILD_DATE"]) {
    assert.ok(updater.includes(literal));
  }
  assert.match(preview, /Pete V5 \/ Dashboard V2/);
  assert.match(app, /frontendBuildSha !== backendBuildSha/);
});

test("any update must pass free offline checks before opening the dashboard", () => {
  const checks = [
    'run build',
    'src/config/pete-llm-phase46.test.ts',
    'start-owner-laptop.ps1',
  ];
  let previous = -1;
  for (const item of checks) {
    const position = updater.indexOf(item, previous + 1);
    assert.ok(position > previous, "missing sequential preflight: " + item);
    previous = position;
  }
  assert.match(updater, /SICHERHEITS-STOP/);
  assert.match(updater, /funnelpilot-owner-verified-sha/);
  assert.match(updater, /if \(\$lastVerified -ne \$after\)/);
  assert.match(updater, /run test:desktop/);
  assert.match(updater, /run test:relay/);
  assert.match(updater, /run test/);
  assert.ok(updater.indexOf("Move-Item -LiteralPath $tmp") >
    updater.indexOf("run test:relay"), "cannot mark commit before checks finish");
});
