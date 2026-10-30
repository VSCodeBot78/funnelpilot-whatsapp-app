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
  await expect(page.getByRole("heading", { level: 1, name: "Kommandozentrale" })).toBeVisible();
  // Regression: the previous attempt exposed the legacy 1.0 dashboard under a V2 shell.
  await expect(page.getByRole("heading", { level: 2, name: /Dein nächster Schritt/ })).toBeVisible();
  await expect(page.getByText("Funktionaler Coach-Workspace", { exact: true })).toBeVisible();
  await expect(page.locator(".fp-app-shell")).toHaveCount(0);
  await page.screenshot({ path: "test-results/dashboard-v2-operational-home.png", fullPage: true });


  const navigation = page.getByRole("navigation", { name: "Dashboard-Bereiche" });
  await navigation.getByRole("button", { name: "Kampagnen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Kampagnen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kampagne anlegen" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Kampagne speichern" })).toBeEnabled();

  await navigation.getByRole("button", { name: "Pete testen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pete testen" })).toBeVisible();
  await expect(page.getByText("Pete im Testchat", { exact: false })).toBeVisible();
  await expect(page.locator(".v2-operational")).toBeVisible();

  await navigation.getByRole("button", { name: "Einstellungen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeVisible();

  expect(requests.some((r) => r.method === "POST" && r.path === "/test-chat/desktop/session")).toBe(true);
  expect(requests.some((r) => /\/meta|\/webhook|\/ghosting\/send|\/conversations\/send/i.test(r.path))).toBe(false);
  expect(pageErrors).toEqual([]);
});
