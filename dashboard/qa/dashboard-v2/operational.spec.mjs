import { test, expect } from "@playwright/test";
import { fixtureResponse } from "./fixtures.mjs";

// Distinct from the intentionally read-only preview-v2.html tests.
// This exercises the existing normal dashboard entry on localhost:5177.
// No real backend, paid model call or Meta delivery is allowed by this fixture.
test("operational V2 exposes editable campaigns and Pete in the same workspace", async ({ page }) => {
  const requests = [];
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("funnelpilot-onboarding-modal-seen-v2", "true");
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1")
      throw new Error(`External request blocked by operational QA: ${url.origin}`);
    const api = /^\/(health|leads|campaigns|conversations|settings-config|ghosting|ghosting-config|availability-config|scheduling-config|integrations|booking-events|test-chat)(\/|$)/;
    if (!api.test(url.pathname)) return route.continue();
    requests.push({ method: request.method(), path: url.pathname });
    // Read-only synthetic fixture. Desktop lab's attempted local session
    // creation returns a failure; no paid provider path can be reached.
    if (request.method() !== "GET")
      return route.fulfill({
        status: 403,
        json: { ok: false, error: "QA_no_writes_or_provider_calls" },
      });
    if (url.pathname.startsWith("/test-chat"))
      return route.fulfill({
        status: 403,
        json: { ok: false, error: "QA_no_paid_provider" },
      });
    const data = url.pathname === "/integrations/oauth/status"
      ? { ok: true, providers: [] }
      : fixtureResponse(url.pathname);
    return route.fulfill(data
      ? { status: 200, json: data }
      : { status: 404, json: { ok: false, error: "fixture_unavailable" } });
  });

  await page.goto("http://127.0.0.1:5177/");
  await expect(page.locator(".v2-operational")).toBeVisible();
  await expect(page.getByText("Backend erreichbar", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Kommandozentrale" })).toBeVisible();
  // Regression: the previous attempt exposed the legacy 1.0 dashboard under a V2 shell.
  await expect(page.getByRole("heading", { level: 2, name: /Dein nächster Schritt/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pete-Labor öffnen" })).toBeVisible();
  // The owner-approved SettingPilot wordmark and Pete mascot must load as real image assets.
  await expect(page.locator(".v2-brand-wordmark")).toHaveJSProperty("naturalWidth", 355);
  await expect(page.locator(".v2-hero-note .v2-pete-mascot")).toHaveJSProperty("naturalWidth", 112);
  await expect(page.locator(".fp-app-shell")).toHaveCount(0);
  await page.screenshot({ path: "test-results/dashboard-v2-operational-home.png", fullPage: true });


  const navigation = page.getByRole("navigation", { name: "Dashboard-Bereiche" });
  await navigation.getByRole("button", { name: "Kampagnen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Kampagnen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kampagne anlegen" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Kampagne speichern" })).toBeEnabled();
  await expect(page.locator(".v2-native-campaigns .v2-native-campaign-grid")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Kampagnen verwalten" })).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard-v2-operational-campaigns.png", fullPage: true });

  await navigation.getByRole("button", { name: "Leads" }).click();
  await expect(page.locator(".v2-native-leads .v2-native-lead-grid")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Leads verwalten" })).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard-v2-operational-leads.png", fullPage: true });

  await navigation.getByRole("button", { name: "Inbox" }).click();
  await expect(page.locator(".v2-native-inbox .fp-inbox-grid")).toBeVisible();
  await expect(page.locator(".v2-native-inbox").getByText("GESPRÄCHE & VERANTWORTUNG")).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard-v2-operational-inbox.png", fullPage: true });

  await navigation.getByRole("button", { name: "Pete testen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pete testen" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Pete im Testchat" })).toBeVisible();
  await expect(page.locator(".v2-native-lab")).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard-v2-operational-pete.png", fullPage: true });
  await expect(page.getByText("Follower-Begrüßung (von Jochen manuell, nur Simulation)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Begrüßung 1 · Energie / Fitness" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Begrüßung 2 · mit Keto" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "CHECK", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "KETO", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "BULLSHIT", exact: true })).toBeEnabled();
  await expect(page.locator(".v2-operational")).toBeVisible();

  await navigation.getByRole("button", { name: "Einstellungen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeVisible();
  await expect(page.locator(".v2-native-settings")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Einstellungen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Einstellungen speichern" })).toBeEnabled();
  await page.screenshot({ path: "test-results/dashboard-v2-operational-settings.png", fullPage: true });

  expect(requests.some((r) => r.method === "POST" && r.path === "/test-chat/desktop/session")).toBe(true);
  expect(requests.some((r) => /\/meta|\/webhook|\/ghosting\/send|\/conversations\/send/i.test(r.path))).toBe(false);
  expect(pageErrors).toEqual([]);
});

test("six-stage synthetic Coach first-run never upgrades Meta test roles to live", async ({ page }) => {
  const requests = [];
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1")
      throw Error("External call blocked by First-Run QA: " + url.origin);
    const api = /^\/(health|leads|campaigns|conversations|settings-config|ghosting|ghosting-config|availability-config|scheduling-config|integrations|booking-events|test-chat)(\/|$)/;
    if (!api.test(url.pathname)) return route.continue();
    requests.push({ method: request.method(), path: url.pathname });
    if (request.method() !== "GET")
      return route.fulfill({ status: 403, json: { ok: false, error: "QA_offline_only" } });
    const data = url.pathname === "/integrations/oauth/status"
      ? { ok: true, providers: [] }
      : fixtureResponse(url.pathname);
    return route.fulfill(data
      ? { status: 200, json: data }
      : { status: 404, json: { ok: false, error: "QA_no_provider" } });
  });
  await page.goto("http://127.0.0.1:5177/");
  const realWizard = page.getByRole("dialog", { name: /Funnel Pilot einrichten/ });
  await expect(realWizard).toBeVisible();
  await realWizard.getByRole("button", { name: "4. Verbindungen" }).click();
  const realMeta = realWizard.getByRole("group", {
    name: "Meta-Status: App, Testberechtigung, Webhook, Live",
  });
  for (const [gate, status] of [
    ["app_exists", "not_verified"],
    ["authorized_test_ready", "not_verified"],
    ["webhook_verified", "blocked"],
    ["live_enabled", "off"],
  ]) await expect(realMeta.locator('[data-meta-gate="' + gate + '"]'))
    .toHaveAttribute("data-meta-state", status);
  await page.getByRole("button", { name: "X-Wing: Erststart offline testen" }).click();
  const wizard = page.getByRole("dialog", { name: /X-Wing: Erststart offline testen/ });
  await expect(wizard).toBeVisible();
  await expect(wizard.getByText("Schritt 1 von 6")).toBeVisible();
  await wizard.getByRole("button", { name: /Direkt einrichten/ }).click();
  await expect(wizard.getByText("Schritt 2 von 6")).toBeVisible();
  await wizard.getByLabel("Betreibername").fill("Synthetische Coach");
  await wizard.getByLabel("Assistentenname").fill("Offline Pete");
  await wizard.getByRole("button", { name: "Weiter →" }).click();
  await expect(wizard.getByText("Schritt 3 von 6")).toBeVisible();
  await wizard.getByRole("button", { name: "Weiter →" }).click();
  await expect(wizard.getByText("Schritt 4 von 6")).toBeVisible();
  const meta = wizard.getByRole("group", { name: "Meta-Status: App, Testberechtigung, Webhook, Live" });
  await expect(meta).toBeVisible();
  for (const [gate, status] of [
    ["app_exists", "documented_only"],
    ["authorized_test_ready", "test_ready_only"],
    ["webhook_verified", "blocked"],
    ["live_enabled", "off"],
  ]) await expect(meta.locator('[data-meta-gate="' + gate + '"]'))
    .toHaveAttribute("data-meta-state", status);
  await expect(meta.getByText("NUR TESTBEREIT", { exact: true })).toBeVisible();
  await expect(meta.getByText("AUS", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard-v2-six-step-xwing-meta-nosend.png", fullPage: true });
  await wizard.getByRole("button", { name: "Weiter →" }).click();
  await expect(wizard.getByText("Schritt 5 von 6")).toBeVisible();
  await expect(wizard.getByText(/Live-Pete, Inbox, Kalender und Testkäufe sind bewusst gesperrt/)).toBeVisible();
  await wizard.getByRole("button", { name: "Weiter →" }).click();
  await expect(wizard.getByText("Schritt 6 von 6")).toBeVisible();
  await wizard.getByRole("button", { name: "Trockenlauf schließen" }).click();
  const storage = await page.evaluate(() => ({
    completed: localStorage.getItem("funnelpilot-onboarding-complete-v1"),
    seen: localStorage.getItem("funnelpilot-onboarding-modal-seen-v2"),
  }));
  expect(storage).toEqual({ completed: null, seen: null });
  // The legacy dashboard shell tries /conversations/ensure in the background.
  // Every POST is intercepted with 403; X-Wing must not issue provider, Meta,
  // onboarding save or checkout requests.
  expect(requests.filter(r => r.method !== "GET" &&
    r.path !== "/conversations/ensure")).toEqual([]);
  expect(pageErrors).toEqual([]);
});
