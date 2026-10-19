import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createXWingOfflineSettings } from "./xwingOfflineSettings.js";
// Git may check out files with CRLF on Windows. Normalize newlines before
// asserting source guards, without loosening any safety condition.
const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8")
  .replace(/\r\n?/g, "\n");

test("X-Wing: every rehearsal starts with fresh empty identity and no live links or provider tokens", () => {
  const a = createXWingOfflineSettings();
  assert.equal(a.companyName, "");
  assert.equal(a.adminName, "");
  assert.equal(a.apiBaseUrl, "");
  assert.equal(a.defaultBookingUrl, "");
  assert.equal(a.starterCheckoutUrl, "");
  a.companyName = "Dummy-Marke";
  a.coachOnboardingDraft.offers.push({ name: "Demo-Angebot" });
  const b = createXWingOfflineSettings();
  assert.equal(b.companyName, "");
  assert.deepEqual(b.coachOnboardingDraft.offers, []);
  assert.ok(!("openAiApiKey" in b));
  assert.ok(!("instagramAccessToken" in b));
});

test("X-Wing: dashboard uses isolated state and does not save real settings or completion flag", () => {
  const app = read("../App.dashboard.jsx");
  const home = read("../dashboard/DashboardHome.jsx");
  assert.ok(home.includes("X-Wing: Erststart offline testen"));
  assert.ok(app.includes("const [xwingSettings, setXwingSettings] = useState(createXWingOfflineSettings)"));
  assert.ok(app.includes('settings={xwingDryRunOpen ? xwingSettings : settings}'));
  assert.ok(app.includes('onSettingsChange={xwingDryRunOpen ? setXwingSettings : setSettings}'));
  assert.ok(app.includes('onSaveSettings={xwingDryRunOpen ? async () => ({ ...xwingSettings }) : handleSaveSettings}'));
  assert.ok(app.includes('if (xwingDryRunOpen) {'));
  assert.ok(app.includes('return; // Never touch real onboarding state or browser storage.'));
  assert.ok(app.includes('if (!xwingDryRunOpen) {'));
  assert.ok(app.includes('funnelpilot-onboarding-complete-v1'));
});

test("X-Wing: onboarding dryRun guards ALL direct API and external provider actions", () => {
  const wizard = read("./SetupWizardModal.jsx");
  for (const required of [
    "if (dryRun) return;",
    "if (dryRun) {",
    "if (!dryRun && stage >= 3) reload();",
    "dryRun ?",
    "X-WING TROCKENLAUF",
    "Kampagneneditor im Trockenlauf nicht öffnen",
    "Trockenlauf verwerfen und schließen",
    "onFinish",
  ]) assert.ok(wizard.includes(required), required);
  for (const fn of ["authStart", "verifyConnection", "disconnect", "testPurchase"]) {
    const scope = wizard.split(`function ${fn}(`)[1] || wizard.split(`function ${fn}()`)[1];
    assert.ok(scope?.slice(0, 120).includes("if (dryRun) return;"), fn);
  }
  assert.ok(wizard.includes('if (dryRun) return; // Never mutate URL'));
  assert.ok(wizard.includes('if (dryRun) {\n      setReadiness(null);'));
  assert.ok(wizard.includes('!dryRun && /^https:'));
  assert.ok(wizard.includes('!dryRun && <div style={box}>'));
});

test("X-Wing: closing real wizard is not a completion signal", () => {
  const app = read("../App.dashboard.jsx");
  const close = app.split("const handleCloseWizard = useCallback")[1]
    .split("const handleFinishWizard = useCallback")[0];
  const finish = app.split("const handleFinishWizard = useCallback")[1]
    .split("function renderContent")[0];
  assert.ok(close.includes("funnelpilot-onboarding-modal-seen-v2"));
  assert.ok(!close.includes("funnelpilot-onboarding-complete-v1"));
  assert.ok(finish.includes("funnelpilot-onboarding-complete-v1"));
  assert.ok(finish.includes("if (!xwingDryRunOpen)"));
});

test("X-Wing: skipping essential steps cannot mark real wizard complete", () => {
  const wizard = read("./SetupWizardModal.jsx");
  assert.ok(wizard.includes("const [savedSetupSteps, setSavedSetupSteps]"));
  assert.ok(wizard.includes("if (!dryRun && (!savedSetupSteps.brand || !savedSetupSteps.offers))"));
  assert.ok(wizard.includes("setSavedSetupSteps(previous => ({ ...previous,"));
  assert.ok(wizard.includes('onClick={completeWizard}'));
  assert.ok(!wizard.includes("onClick={onFinish}"));
});
