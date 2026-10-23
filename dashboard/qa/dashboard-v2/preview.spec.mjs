import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fixtureResponse } from "./fixtures.mjs";

// Resolved from dashboard/qa/dashboard-v2 -> repository/docs.
const screenshotDir = fileURLToPath(
  new URL("../../../docs/qa/dashboard-v2/screenshots/", import.meta.url),
);
const apiPattern =
  /^\/(health|leads|campaigns|conversations|settings-config|ghosting|booking-events|availability-config|scheduling-config)(\/|$)/;

async function mockBackend(page, options = {}) {
  const requests = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!apiPattern.test(url.pathname)) {
      if (url.hostname !== "127.0.0.1")
        throw new Error(`External network request: ${url.origin}`);
      return route.continue();
    }
    requests.push({ method: request.method(), path: url.pathname });
    // The legacy comparison can attempt writes on load; intercept and reject.
    if (request.method() !== "GET")
      return route.fulfill({
        status: 403,
        json: { ok: false, error: "QA_no_writes" },
      });
    if (options.offline || options.fail === url.pathname)
      return route.fulfill({ status: 503, json: { ok: false } });
    const data = fixtureResponse(url.pathname, options);
    if (data) return route.fulfill({ status: 200, json: data });
    return route.fulfill({ status: 404, json: { ok: false } });
  });
  return requests;
}
async function openPreview(page, options = {}) {
  const requests = await mockBackend(page, options);
  await page.goto("/preview-v2.html");
  await expect(
    page.getByRole("button", { name: "Aktualisieren", exact: true }),
  ).toBeEnabled();
  return requests;
}
async function navigate(page, section) {
  if (page.viewportSize().width <= 900)
    await page.getByRole("button", { name: "Navigation öffnen" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: section, exact: true })
    .click();
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
async function screenshot(
  page,
  filename,
  label = "QA-TESTDATEN · KEINE ECHTEN LEADS · KEINE LIVE-VERBINDUNG",
) {
  await mkdir(screenshotDir, { recursive: true });
  await page.evaluate((text) => {
    document.getElementById("qa-evidence-label")?.remove();
    const label = document.createElement("div");
    label.id = "qa-evidence-label";
    label.textContent = text;
    Object.assign(label.style, {
      position: "relative",
      width: "100%",
      background: "#2e2c2c",
      color: "#ffffff",
      textAlign: "center",
      padding: "7px 10px",
      font: "600 10px sans-serif",
      boxSizing: "border-box",
    });
    document.body.prepend(label);
    window.scrollTo(0, 0);
  }, label);
  await page.screenshot({
    path: `${screenshotDir}/${filename}`,
    fullPage: true,
    animations: "disabled",
  });
  await page.evaluate(() =>
    document.getElementById("qa-evidence-label")?.remove(),
  );
}

test("default-off entry makes no backend request and does not mount the CRM preview", async ({
  page,
  request,
}) => {
  const requests = await mockBackend(page);
  await page.goto("http://127.0.0.1:5176/preview-v2.html?dashboardV2=true&ai=1");
  await expect(
    page.getByRole("heading", { name: "Dashboard 2.0 ist deaktiviert." }),
  ).toBeVisible();
  expect(requests).toEqual([]);
  expect((await request.get("http://127.0.0.1:5176/leads")).status()).toBe(403);
  await screenshot(
    page,
    "preview-disabled.png",
    "ECHTER STANDARDZUSTAND · VORSCHAU AUS · KEIN DATENABRUF",
  );
});

test("preview server rejects all write methods and unapproved routes before proxying", async ({
  request,
}) => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await request.fetch("/leads", {
      method,
      data: { name: "must never persist" },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error).toBe("dashboard_v2_read_only");
  }
  for (const path of [
    "/conversations/ensure",
    "/ghosting/send-due/x/y",
    "/settings-config/reset",
  ])
    expect((await request.get(path)).status()).toBe(403);
});

test("all preview navigation uses only GETs; save/send/takeover stay disabled", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests = await openPreview(page);
  for (const section of [
    "Inbox",
    "Leads",
    "Kampagnen",
    "Nachfassaktionen",
    "Termine",
    "Buchungsprotokoll",
    "Einstellungen",
    "Einrichtung",
  ]) {
    await navigate(page, section);
    await expect(
      page.getByRole("heading", { level: 1, name: section }),
    ).toBeVisible();
  }
  expect(requests.every((item) => item.method === "GET")).toBe(true);
  expect(
    requests.some((item) =>
      /test-chat|send|takeover|ensure|release|api\.openai/.test(item.path),
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
});

for (const width of [360, 768, 1440])
  for (const dark of [false, true]) {
    test(`responsive ${width}px ${dark ? "dark" : "light"}: navigation, inbox and setup`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: width === 360 ? 800 : 1050 });
      await openPreview(page);
      if (dark) {
        if (width <= 900)
          await page.getByRole("button", { name: "Navigation öffnen" }).click();
        await page
          .getByRole("button", { name: "Dunkelmodus einschalten" })
          .click();
        if (width <= 900)
          await page
            .getByRole("button", { name: "Navigation schließen" })
            .click();
      }
      await noOverflow(page);
      if (width === 1440 || (width === 360 && !dark))
        await screenshot(
          page,
          `dashboard-${width}-${dark ? "dark" : "light"}.png`,
        );
      await navigate(page, "Inbox");
      await expect(
        page.getByRole("button", { name: /Ada Winter/ }).first(),
      ).toBeVisible();
      if (width <= 900)
        await page
          .getByRole("button", { name: /Ada Winter/ })
          .first()
          .click();
      await expect(
        page.getByText("Ich möchte wissen, ob das zu meinem Alltag passt.", {
          exact: false,
        }),
      ).toBeVisible();
      await noOverflow(page);
      if ((width === 1440 && !dark) || (width === 360 && !dark))
        await screenshot(page, `inbox-${width}-light.png`);
      if (width <= 900) {
        await page
          .getByRole("button", { name: "Kontakt", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "Kontaktinformationen" }),
        ).toBeVisible();
      }
      await navigate(page, "Einrichtung");
      for (let index = 0; index < 5; index++) {
        await noOverflow(page);
        await page.getByRole("button", { name: "Weiter", exact: true }).click();
      }
      await expect(
        page.getByText("Keine Freigabe gespeichert.", { exact: false }),
      ).toBeVisible();
      await noOverflow(page);
    });
  }

test("filters combine, explain zero results, reset and preserve the selected contact context", async ({
  page,
}) => {
  await openPreview(page);
  await navigate(page, "Leads");
  await page.getByRole("searchbox", { name: "Leads durchsuchen" }).fill("Ada");
  await page.getByLabel("Quelle filtern").selectOption("WhatsApp");
  await expect(
    page.getByText("Keine passenden Leads", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filter zurücksetzen" }).click();
  await page.getByLabel("Status filtern").selectOption("human");
  await expect(page.locator(".v2-contact-row")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Ada Winter", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Status filtern").selectOption("unknown");
  await expect(page.locator(".v2-contact-row")).toHaveCount(1);
  await expect(
    page.getByRole("heading", {
      name: "Elena Langnamen-Darstellungsprüfung",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Nicht bestätigt", { exact: true }).first(),
  ).toBeVisible();
});

test("inbox uses persisted messages, labels dry runs and blocks all sending and owner changes", async ({
  page,
}) => {
  await openPreview(page);
  await navigate(page, "Inbox");
  await expect(page.getByText("Trockenlauf", { exact: true })).toBeVisible();
  for (const name of ["Senden", "Übernehmen", "An Pete"])
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
  await expect(
    page.getByRole("textbox", { name: "Nachricht in der Vorschau gesperrt" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: /Ben Sommer/ })
    .first()
    .click();
  await expect(page.locator(".v2-conversation-heading")).toContainText(
    "Ben Sommer",
  );
  await expect(page.locator(".v2-contact-profile")).toContainText("Ben Sommer");
});

test("empty and partial error states are explicit; unavailable metrics are never zero", async ({
  page,
}) => {
  await openPreview(page, { empty: true });
  await expect(page.locator(".v2-metric > strong").first()).toHaveText("0");
  await expect(
    page.getByText("Noch keine Leads vorhanden", { exact: true }),
  ).toBeVisible();
  await screenshot(page, "dashboard-empty.png");
  await page.unroute("**/*");
  await mockBackend(page, { fail: "/conversations" });
  await page
    .getByRole("button", { name: "Aktualisieren", exact: true })
    .click();
  await expect(page.locator(".v2-error-summary")).toContainText(
    "1 Datenquelle",
  );
  await expect(page.locator(".v2-metric > strong").nth(2)).toHaveText("—");
  await expect(page.locator(".v2-metric > strong").first()).toHaveText("5");
});

test("offline display contains no invented contacts or successful safety checks", async ({
  page,
}) => {
  await openPreview(page, { offline: true });
  for (const metric of await page
    .locator(".v2-metric > strong")
    .allTextContents())
    expect(metric).toBe("—");
  await expect(page.getByText("Readiness-Nachweis fehlt")).toBeVisible();
  await expect(
    page.getByText("Lead-Daten fehlen", { exact: true }),
  ).toBeVisible();
  await screenshot(
    page,
    "dashboard-offline.png",
    "QA · OFFLINE-ZUSTAND · ALLE DATENQUELLEN NICHT VERFÜGBAR",
  );
});

test("keyboard focus is trapped in mobile navigation, Escape returns it and section changes focus content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openPreview(page);
  await page.getByRole("button", { name: "Navigation öffnen" }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Hauptnavigation" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(() => !!document.activeElement.closest(".v2-sidebar")),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Navigation öffnen" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await dialog.getByRole("button", { name: "Leads", exact: true }).click();
  await expect(page.locator("#v2-main")).toBeFocused();
});

test("untrusted lead text renders as text and never executes HTML", async ({
  page,
}) => {
  await mockBackend(page);
  await page.route("**/leads", (route) =>
    route.fulfill({
      json: {
        ok: true,
        leads: [
          {
            id: "xss",
            name: '<img src=x onerror="window.__xss=1">',
            campaignId: "q",
            tags: [],
          },
        ],
      },
    }),
  );
  await page.goto("/preview-v2.html");
  await expect(
    page.getByRole("button", { name: "Aktualisieren", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText('<img src=x onerror="window.__xss=1">', { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await expect(page.locator(".v2-priority-list img")).toHaveCount(0);
});

test("loading is visible until the real request resolves; refreshing recovers an error", async ({
  page,
}) => {
  await mockBackend(page);
  let release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/leads", async (route) => {
    await waiting;
    await route.fulfill({ json: fixtureResponse("/leads") });
  });
  await page.goto("/preview-v2.html");
  await expect(
    page.getByText("Gespeicherte Daten werden lesend geladen …"),
  ).toBeVisible();
  await expect(page.locator(".v2-metric > strong").first()).toHaveText("…");
  release();
  await expect(
    page.getByRole("button", { name: "Aktualisieren", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".v2-metric > strong").first()).toHaveText("5");
  await page.unroute("**/leads");
  await page.route("**/leads", (route) =>
    route.fulfill({ status: 500, json: { ok: false } }),
  );
  await page
    .getByRole("button", { name: "Aktualisieren", exact: true })
    .click();
  await expect(
    page.getByText("Lead-Daten fehlen", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/leads");
  await page
    .getByRole("button", { name: "Aktualisieren", exact: true })
    .click();
  await expect(page.locator(".v2-metric > strong").first()).toHaveText("5");
});

test("mismatched conversation details are not displayed under another contact", async ({
  page,
}) => {
  await openPreview(page);
  await page.route("**/conversations/qa-campaign/qa-ada", (route) =>
    route.fulfill({
      json: {
        ok: true,
        state: {
          campaignId: "qa-campaign",
          leadId: "someone-else",
          messages: [{ text: "private wrong person" }],
        },
      },
    }),
  );
  await navigate(page, "Inbox");
  await expect(
    page.getByText("Gesprächsidentität stimmt nicht überein.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("private wrong person")).toHaveCount(0);
});

for (const dark of [false, true])
  test(`WCAG A/AA audits across all sections and setup steps (${dark ? "dark" : "light"})`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await openPreview(page);
    if (dark)
      await page
        .getByRole("button", { name: "Dunkelmodus einschalten" })
        .click();
    async function audit() {
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((item) => ({
          id: item.id,
          nodes: item.nodes.map((node) => node.target),
        })),
      ).toEqual([]);
    }
    await audit();
    for (const section of [
      "Inbox",
      "Leads",
      "Kampagnen",
      "Nachfassaktionen",
      "Termine",
      "Buchungsprotokoll",
      "Einstellungen",
      "Einrichtung",
    ]) {
      await navigate(page, section);
      await audit();
      if (section === "Kampagnen" && !dark)
        await screenshot(page, "campaigns-1440-light.png");
      if (section === "Einrichtung") {
        await screenshot(
          page,
          `onboarding-1440-${dark ? "dark" : "light"}.png`,
        );
        for (let index = 0; index < 5; index++) {
          await page
            .getByRole("button", { name: "Weiter", exact: true })
            .click();
          await audit();
        }
      }
    }
  });

test("unchanged legacy dashboard comparison uses the same explicitly synthetic fixture", async ({
  page,
}) => {
  await mockBackend(page);
  await page.addInitScript(() =>
    localStorage.setItem("funnelpilot-onboarding-modal-seen-v2", "true"),
  );
  await page.goto("http://127.0.0.1:5177/");
  await expect(
    page.getByText("Dein Arbeitsplatz", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Ada Winter", { exact: true }).first(),
  ).toBeVisible();
  await screenshot(page, "dashboard-before-1440.png");
  await page
    .getByRole("button", { name: "Inbox", exact: true })
    .first()
    .click();
  await expect(
    page
      .getByText("Gespeicherte Inbox-Nachrichten")
      .or(page.getByText("Ada Winter", { exact: true }).first()),
  ).toBeVisible();
  await screenshot(page, "inbox-before-1440.png");
});
