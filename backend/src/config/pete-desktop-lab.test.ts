import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// ALL billing documents/keys/responses below are synthetic fixtures. The
// production checkout deliberately contains NO complete history review.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "fp-desktop-budget-"));
Object.assign(process.env, {
  NODE_ENV: "development", DATA_DIR: temp, PORT: "3001", GITHUB_ACTIONS: "false",
  FUNNELPILOT_LOCAL_TEST_MODE: "true", DISABLE_DESTRUCTIVE_ROUTES: "true",
  INSTAGRAM_ENGINE_ENABLED: "false", INSTAGRAM_SEND_ENABLED: "false",
  WHATSAPP_SEND_ENABLED: "false", WHATSAPP_ALLOW_ALL_RECIPIENTS: "false",
  INSTAGRAM_ALLOW_ALL_SENDERS: "false", INSTAGRAM_AUTO_ENABLE_NEW_LEADS: "false",
  ENABLE_GENERIC_WEBHOOKS: "false", WHATSAPP_ALLOWED_RECIPIENT_IDS: "",
  INSTAGRAM_ALLOWED_SENDER_IDS: "", PETE_MOBILE_LAB_ENABLED: "false",
  PETE_LLM_CONVERSATION_ENABLED: "true", PETE_LLM_API_CALLS_APPROVED: "false",
  OPENAI_MODEL: "gpt-6.1-sol", OPENAI_API_KEY: "fake-desktop-key-never-network",
});
const { default: app } = await import("../app.js");
const budgetService = await import("../services/pete-api-budget.service.js");
const { PETE_DESKTOP_HISTORY } = await import("./pete-desktop-history.js");
const { getConversationState, clearConversationStore } = await import("../data/store.js");
const { takeOverByHuman, persistConversationState } = await import("../core/state-manager.js");
const ledgerFile = path.join(temp, "pete-api-budget.json");
const reviewFile = path.join(temp, "pete-desktop-history-review.json");
const hashFile = (p: string) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
function resetFiles() {
  for (const name of fs.readdirSync(temp)) fs.rmSync(path.join(temp, name), { recursive: true, force: true });
  clearConversationStore();
}
function fakeReview(priorMicroUsd: number = PETE_DESKTOP_HISTORY.knownBookedMicroUsd) {
  const oldFile = path.join(temp, "FAKE-old-local-ledger.json");
  const providerFile = path.join(temp, "FAKE-provider-cost-statement.txt");
  fs.writeFileSync(oldFile, JSON.stringify({ version: 1, committedMicroUsd: 0,
    confirmedMicroUsd: 0, reservedMicroUsd: 0 }));
  fs.writeFileSync(providerFile, "SYNTHETIC BILLING FIXTURE. NOT REAL EXPENDITURE EVIDENCE.");
  fs.writeFileSync(reviewFile, JSON.stringify({ version: 1,
    kind: "owner-reviewed-desktop-history", knownCloudLedgerCommit: PETE_DESKTOP_HISTORY.ledgerCommit,
    knownCloudLedgerBlob: PETE_DESKTOP_HISTORY.ledgerBlob, priorMicroUsd,
    unresolvedSources: 0, ownerReviewedComplete: true, reviewedAt: new Date().toISOString(),
    dataDir: fs.realpathSync(temp), initialTargetLedgerSha256: fs.existsSync(ledgerFile) ? hashFile(ledgerFile) : "absent",
    localLedgers: [{ path: oldFile, sha256: hashFile(oldFile) }],
    providerStatement: { path: providerFile, sha256: hashFile(providerFile) },
  }));
}

test("Desktop owner scope and durable budget, real HTTP with mocked providers only", async t => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const nativeFetch = globalThis.fetch;
  let providerCalls = 0;
  let responseUsage: unknown = { input_tokens: 100, output_tokens: 20 };
  let holdProvider = false;
  let waiting: Array<() => void> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith(base + "/")) return new Promise<Response>((resolve, reject) => {
      // Raw local HTTP lets negative tests actually transmit a forged Host.
      // Node's fetch deliberately ignores Host overrides on some versions.
      const request = http.request(url, { method: init?.method ?? "GET",
        headers: init?.headers as Record<string, string> }, response => {
        const chunks: Buffer[] = [];
        response.on("data", chunk => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(response.headers))
            if (value !== undefined) for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
          resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers }));
        });
      });
      request.on("error", reject);
      request.end(init?.body === undefined ? undefined : String(init.body));
    });
    assert.equal(url, "https://api.openai.com/v1/responses", "unexpected external request");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "gpt-6.1-sol");
    assert.equal(body.store, false);
    providerCalls++;
    if (holdProvider) await new Promise<void>(resolve => waiting.push(resolve));
    return new Response(JSON.stringify({ usage: responseUsage,
      output: [{ content: [{ type: "output_text", text: JSON.stringify({
        reply: "Der Abend nach der Arbeit ist bei dir besonders anstrengend. Was fällt dir dann am schwersten?",
        needsHuman: false,
      }) }] }],
    }), { status: 200 });
  };
  t.after(async () => {
    globalThis.fetch = nativeFetch;
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const originHeaders = { Origin: "http://127.0.0.1:5173", Host: "127.0.0.1:3001",
    "Content-Type": "application/json", "X-Pete-Desktop": "1" };
  async function client() {
    const response = await fetch(base + "/test-chat/desktop/session", {
      method: "POST", headers: originHeaders, body: "{}",
    });
    assert.equal(response.status, 200);
    const data = await response.json() as any;
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    assert.match(response.headers.get("set-cookie")!, /HttpOnly/i);
    assert.match(response.headers.get("set-cookie")!, /SameSite=Strict/i);
    const headers = { ...originHeaders, Cookie: cookie, "X-Pete-CSRF": data.csrfToken };
    const call = async (route: string, body?: unknown, overrides: Record<string, string> = {}) => {
      const response = await fetch(base + "/test-chat/desktop/" + route, {
        method: body === undefined ? "GET" : "POST", headers: { ...headers, ...overrides },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() as any };
    };
    const lead = async () => (await call("lead", {})).body.leadId as string;
    const message = (leadId: string, messageText = "Ich bin nach der Arbeit müde und bekomme meine Ernährung nicht geregelt.") =>
      call("message", { leadId, campaignId: "eltern-vital-fit", messageText });
    const hash = crypto.createHash("sha256").update(cookie.slice(cookie.indexOf("=") + 1)).digest("hex");
    return { call, lead, message, headers, hash };
  }
  async function granted(amount = "0.25") {
    resetFiles(); fakeReview();
    const c = await client();
    assert.equal((await c.call("budget", { enabled: true, budgetUsd: amount })).status, 200);
    return c;
  }
  async function ownerGranted(amount = "0.25") {
    resetFiles();
    const c = await client();
    assert.equal((await c.call("budget", { enabled: true, budgetUsd: amount, ownerManagedCosts: true })).status, 200);
    return c;
  }

  await t.test("missing history displays the known floor and locks paid calls, no implicit provider check", async () => {
    resetFiles();
    const c = await client();
    const before = providerCalls;
    const status = (await c.call("status")).body;
    assert.equal(status.budget.knownHistoricalBookedUsd, 11.158772);
    assert.equal(status.budget.historyVerified, false);
    assert.equal(status.budget.projectRemainingUsd, null);
    assert.equal(status.budget.enabled, false);
    assert.equal((await c.call("budget", { enabled: true, budgetUsd: "0.25" })).status, 409);
    assert.equal((await c.message(await c.lead())).status, 200);
    assert.equal(providerCalls, before);
    assert.equal(fs.existsSync(ledgerFile), false, "status cannot manufacture or reset a ledger");
  });
  await t.test("exact origin, host, cookie, CSRF and no forwarded headers are all required", async () => {
    const c = await granted();
    const invalidHeaders: Record<string, string>[] = [
      { Origin: "https://evil.example" }, { Origin: "null" }, { Origin: "" },
      { Host: "evil.example:3001" }, { "X-Pete-CSRF": "f".repeat(64) },
      { Cookie: "" }, { "X-Pete-Desktop": "" }, { "X-Forwarded-For": "127.0.0.1" },
    ];
    for (const override of invalidHeaders)
      assert.equal((await c.call("budget", { enabled: false }, override)).status, 403);
    const before = providerCalls;
    assert.equal((await c.call("message", { leadId: await c.lead(), campaignId: "eltern-vital-fit",
      messageText: "Hallo" }, { "X-Pete-CSRF": "" })).status, 403);
    assert.equal(providerCalls, before);
  });
  await t.test("explicit owner-managed activation needs no historical file and meters the scoped mocked model path", async () => {
    resetFiles();
    const c = await client();
    const before = providerCalls;
    assert.equal((await c.call("status")).body.budget.ownerManagedApprovalAvailable, true);
    for (const ownerManagedCosts of [false, "true", 1, null, {}])
      assert.equal((await c.call("budget", { enabled: true, budgetUsd: "0.25", ownerManagedCosts })).status, 400);
    assert.equal((await c.call("budget", { enabled: true, budgetUsd: "0.25", ownerManagedCosts: true },
      { "X-Pete-CSRF": "" })).status, 403);
    assert.equal((await c.call("budget", { enabled: true, budgetUsd: "0.25", ownerManagedCosts: true },
      { Origin: "https://evil.invalid" })).status, 403);
    assert.equal((await c.call("budget", { enabled: true, budgetUsd: "0.25", ownerManagedCosts: true })).status, 200);
    assert.equal(providerCalls, before, "activation itself must not call the provider");
    assert.equal(fs.existsSync(reviewFile), false);
    const result = await c.message(await c.lead());
    assert.equal(result.body.replySource, "llm");
    assert.equal(providerCalls, before + 1);
    assert.equal(result.body.budget.ownerManagedCosts, true);
    assert.equal(result.body.budget.historyVerified, false);
    assert.equal(result.body.budget.historicalBookedUsd, null);
    assert.equal(result.body.budget.projectRemainingUsd, null);
    assert.equal(result.body.budget.confirmedUsd, 0.0004);
    assert.equal(result.body.budget.remainingUsd, 0.2496);
    assert.equal(process.env.PETE_LLM_API_CALLS_APPROVED, "false");
    assert.equal(process.env.INSTAGRAM_SEND_ENABLED, "false");
    assert.equal(process.env.WHATSAPP_SEND_ENABLED, "false");
  });
  await t.test("owner approval preserves prior ledger charges, pending amounts and OFF across a real restart", async () => {
    resetFiles();
    const c = await client();
    budgetService.setPeteDesktopBudget({ enabled: false, sessionHash: c.hash });
    const old = JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
    old.confirmedMicroUsd = 50_000; old.reservedMicroUsd = 60_000; old.committedMicroUsd = 110_000;
    old.requestsStarted = 1;
    old.pending.previous = { microUsd: 60_000, createdAt: new Date().toISOString(), model: "gpt-6.1-sol" };
    fs.writeFileSync(ledgerFile, JSON.stringify(old));
    const grant = await c.call("budget", { enabled: true, budgetUsd: "2.00", ownerManagedCosts: true });
    assert.equal(grant.status, 200);
    assert.equal(grant.body.budget.remainingUsd, 1.731228, "known booking ceiling remains stricter than selected USD2");
    const retained = JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
    assert.deepEqual(retained.pending, old.pending);
    assert.equal(retained.confirmedMicroUsd, old.confirmedMicroUsd);
    assert.equal(retained.reservedMicroUsd, old.reservedMicroUsd);
    responseUsage = undefined;
    await c.message(await c.lead());
    responseUsage = { input_tokens: 100, output_tokens: 20 };
    const before = (await c.call("status")).body.budget;
    assert.ok(before.reservedUsd > 0);
    assert.equal(before.enabled, true);
    const modulePath = fileURLToPath(new URL("../services/pete-api-budget.service.ts", import.meta.url));
    const probe = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
      "const b=await import(" + JSON.stringify(pathToFileURL(modulePath).href) +
      ");process.stdout.write(JSON.stringify(b.getPeteDesktopBudgetStatus(" + JSON.stringify(c.hash) + ")));"],
      { cwd: process.cwd(), env: { ...process.env }, encoding: "utf8" });
    assert.equal(probe.status, 0, probe.stderr);
    const after = JSON.parse(probe.stdout.trim().split("\n").at(-1)!);
    assert.equal(after.enabled, false);
    assert.equal(after.ownerManagedCosts, true);
    assert.equal(after.historyVerified, false);
    assert.equal(after.authorizedUsd, 2);
    assert.equal(after.reservedUsd, before.reservedUsd);
    assert.equal(after.remainingUsd, before.remainingUsd);
    assert.equal((await c.call("budget", { enabled: false })).status, 200);
    const again = await c.call("budget", { enabled: true, budgetUsd: "2.00", ownerManagedCosts: true });
    assert.equal(again.status, 200);
    assert.equal(again.body.budget.reservedUsd, before.reservedUsd);
  });
  await t.test("owner-managed parallel requests still reserve under the hard cumulative test cap", async () => {
    const c = await ownerGranted();
    holdProvider = true;
    const leads = await Promise.all(Array.from({ length: 16 }, () => c.lead()));
    const inFlight = leads.map(id => c.message(id));
    await new Promise(resolve => setTimeout(resolve, 150));
    const during = (await c.call("status")).body.budget;
    assert.ok(waiting.length > 0 && waiting.length < 16);
    assert.ok(during.reservedUsd > 0 && during.committedUsd <= 0.25);
    holdProvider = false;
    const releases = waiting; waiting = []; releases.forEach(resolve => resolve());
    await Promise.all(inFlight);
    const after = (await c.call("status")).body.budget;
    assert.ok(after.committedUsd <= 0.25);
    const spent = after.confirmedUsd;
    await c.call("budget", { enabled: false });
    const again = await c.call("budget", { enabled: true, budgetUsd: "0.25", ownerManagedCosts: true });
    assert.equal(again.body.budget.confirmedUsd, spent);
  });
  await t.test("owner-managed activation cannot override a sealed changed review or accounting/corruption blocks", async () => {
    resetFiles(); fakeReview(PETE_DESKTOP_HISTORY.knownBookedMicroUsd + 150_000);
    const reviewed = await client();
    const retainedHistory = await reviewed.call("budget", { enabled: true, budgetUsd: "0.25", ownerManagedCosts: true });
    assert.equal(retainedHistory.status, 200);
    assert.equal(retainedHistory.body.budget.historyVerified, true);
    assert.equal(retainedHistory.body.budget.historicalBookedUsd, 11.308772);
    assert.equal(retainedHistory.body.budget.projectRemainingUsd, 1.691228);
    fs.appendFileSync(path.join(temp, "FAKE-provider-cost-statement.txt"), "changed");
    assert.equal((await reviewed.call("budget", { enabled: true, budgetUsd: "0.25", ownerManagedCosts: true })).status, 409);
    const c = await ownerGranted();
    responseUsage = { input_tokens: 1_000_000, output_tokens: 0 };
    await c.message(await c.lead());
    responseUsage = { input_tokens: 100, output_tokens: 20 };
    const status = (await c.call("status")).body.budget;
    assert.equal(status.blockReason, "accounting_review_required");
    assert.equal(status.ownerManagedApprovalAvailable, false);
    assert.equal(status.enabled, false);
    assert.equal((await c.call("budget", { enabled: true, budgetUsd: "2.00", ownerManagedCosts: true })).status, 409);
    fs.writeFileSync(ledgerFile, "corrupted");
    assert.equal((await c.call("budget", { enabled: true, budgetUsd: "0.25", ownerManagedCosts: true })).status, 409);
    assert.equal(fs.readFileSync(ledgerFile, "utf8"), "corrupted");
  });
  await t.test("forged, foreign-session and wrong-campaign test IDs never reach the model", async () => {
    const c = await granted();
    const other = await client();
    const before = providerCalls;
    for (const id of ["real_customer_123", "lab_desktop_" + "a".repeat(48), await other.lead()])
      assert.equal((await c.message(id)).status, 403);
    assert.equal((await c.call("message", { leadId: await c.lead(), campaignId: "foreign-campaign",
      messageText: "Hallo" })).status, 403);
    assert.equal(providerCalls, before);
  });
  await t.test("client budget/history injection cannot grant or reset authorization", async () => {
    const c = await granted();
    for (const amount of [0.25, -1, "NaN", "0.01", "100.00", "0.250"])
      assert.equal((await c.call("budget", { enabled: true, budgetUsd: amount })).status, 400);
    assert.equal((await c.call("budget", { enabled: true, budgetUsd: "0.25", historyVerified: true })).status, 400);
    assert.equal((await c.call("entry", { keyword: "CHECK", source: "instagram_dm",
      leadId: "lab_desktop_chosen_by_client" })).status, 400);
  });
  await t.test("ON reaches the real application model path via mocked Responses and meters usage", async () => {
    const c = await granted();
    const before = providerCalls;
    const result = await c.message(await c.lead());
    assert.equal(result.status, 200);
    assert.equal(result.body.replySource, "llm", JSON.stringify(result.body));
    assert.deepEqual(result.body.providerUsage, { model: "gpt-6.1-sol", inputTokens: 100, outputTokens: 20 });
    assert.equal(providerCalls, before + 1);
    assert.equal(result.body.budget.confirmedUsd, 0.0004);
    assert.equal(result.body.budget.reservedUsd, 0);
    assert.equal(result.body.budget.remainingUsd, 0.2496);
    const health = await (await fetch(base + "/health/readiness")).json() as any;
    assert.equal(health.peteLlmCostGateApproved, false);
    assert.equal(health.instagramSendEnabled, false);
    assert.equal(health.whatsappSendEnabled, false);
    // A normal engine entry has no AsyncLocalStorage desktop authority.
    const raw = await fetch(base + "/test-chat/message", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: "ordinary_test_lead",
        campaignId: "eltern-vital-fit", messageText: "Ich bin nach der Arbeit müde.", desktopOwner: true }) });
    assert.equal(raw.status, 200);
    assert.equal(providerCalls, before + 1, "global paid gate stays closed");
  });
  await t.test("OFF and new contacts preserve cumulative spend and cannot make new calls", async () => {
    const c = await granted();
    await c.message(await c.lead());
    const before = providerCalls;
    assert.equal((await c.call("budget", { enabled: false })).status, 200);
    const offline = await c.message(await c.lead());
    assert.notEqual(offline.body.replySource, "llm");
    assert.equal(providerCalls, before);
    const again = await c.call("budget", { enabled: true, budgetUsd: "0.25" });
    assert.equal(again.body.budget.confirmedUsd, 0.0004);
    assert.equal(again.body.budget.remainingUsd, 0.2496);
  });
  await t.test("parallel HTTP requests reserve under the same hard cap before each provider call", async () => {
    const c = await granted();
    holdProvider = true;
    const leads = await Promise.all(Array.from({ length: 16 }, () => c.lead()));
    const inFlight = leads.map(id => c.message(id));
    await new Promise(resolve => setTimeout(resolve, 150));
    const during = (await c.call("status")).body.budget;
    assert.ok(waiting.length > 0);
    assert.ok(waiting.length < 16, "some requests must be rejected before the provider");
    assert.ok(during.reservedUsd > 0 && during.committedUsd <= 0.25);
    assert.ok(during.remainingUsd >= 0);
    holdProvider = false;
    const releases = waiting; waiting = []; releases.forEach(resolve => resolve());
    await Promise.all(inFlight);
    assert.ok((await c.call("status")).body.budget.committedUsd <= 0.25);
  });
  await t.test("unknown usage retains the whole reservation across a real process restart; KI starts OFF", async () => {
    const c = await granted();
    responseUsage = undefined;
    const result = await c.message(await c.lead());
    responseUsage = { input_tokens: 100, output_tokens: 20 };
    assert.notEqual(result.body.replySource, "llm");
    assert.equal(result.body.providerUsage, null);
    const before = (await c.call("status")).body.budget;
    assert.ok(before.reservedUsd > 0);
    const modulePath = fileURLToPath(new URL("../services/pete-api-budget.service.ts", import.meta.url));
    const probe = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
      "const b=await import(" + JSON.stringify(pathToFileURL(modulePath).href) +
      ");process.stdout.write(JSON.stringify(b.getPeteDesktopBudgetStatus(" + JSON.stringify(c.hash) + ")));"],
    { cwd: process.cwd(), env: { ...process.env }, encoding: "utf8" });
    assert.equal(probe.status, 0, probe.stderr);
    const after = JSON.parse(probe.stdout.trim().split("\n").at(-1)!);
    assert.equal(after.enabled, false);
    assert.equal(after.reservedUsd, before.reservedUsd);
    assert.equal(after.authorizedUsd, 0.25);
    assert.equal(after.remainingUsd, before.remainingUsd);
  });
  await t.test("OFF during an in-flight call suppresses its model output without refunding usage", async () => {
    const c = await granted();
    holdProvider = true;
    const leadId = await c.lead();
    const pending = c.message(leadId);
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.ok(waiting.length > 0);
    assert.equal((await c.call("budget", { enabled: false })).status, 200);
    holdProvider = false;
    const releases = waiting; waiting = []; releases.forEach(resolve => resolve());
    const result = await pending;
    assert.notEqual(result.body.replySource, "llm");
    assert.equal(result.body.replySuppressedReason, "desktop_switched_off");
    assert.equal(result.body.budget.confirmedUsd, 0.0004);
    assert.equal(getConversationState(leadId, "eltern-vital-fit")?.owner, "ai");
    const before = providerCalls;
    await c.message(await c.lead());
    assert.equal(providerCalls, before);
    assert.equal((await c.call("budget", { enabled: true, budgetUsd: "0.25" })).status, 200);
    assert.equal((await c.message(leadId, "Mir geht es vor allem um mein Essen am Abend.")).body.replySource, "llm");
  });
  await t.test("changed evidence, a stale target ledger and understated history all fail closed", async () => {
    const c = await granted();
    fs.appendFileSync(path.join(temp, "FAKE-provider-cost-statement.txt"), "changed");
    assert.equal((await c.call("status")).body.budget.historyVerified, false);
    const before = providerCalls;
    await c.message(await c.lead());
    assert.equal(providerCalls, before);
    resetFiles(); fakeReview(PETE_DESKTOP_HISTORY.knownBookedMicroUsd - 1);
    assert.equal(budgetService.getPeteDesktopBudgetStatus().historyVerified, false);
    resetFiles(); fakeReview();
    // Creating a target ledger AFTER the review invalidates its migration hash.
    budgetService.setPeteDesktopBudget({ enabled: false, sessionHash: c.hash });
    assert.equal((await c.call("budget", { enabled: true, budgetUsd: "0.25" })).status, 409);
  });
  await t.test("an old local spend ledger is included rather than treated as zero", async () => {
    resetFiles(); fakeReview();
    const filename = path.join(temp, "FAKE-old-local-ledger.json");
    fs.writeFileSync(filename, JSON.stringify({ version: 1, committedMicroUsd: 150_000,
      confirmedMicroUsd: 100_000, reservedMicroUsd: 50_000 }));
    const review = JSON.parse(fs.readFileSync(reviewFile, "utf8"));
    review.localLedgers[0].sha256 = hashFile(filename);
    fs.writeFileSync(reviewFile, JSON.stringify(review));
    assert.equal(budgetService.getPeteDesktopBudgetStatus().historyVerified, false);
    review.priorMicroUsd += 150_000;
    fs.writeFileSync(reviewFile, JSON.stringify(review));
    const status = budgetService.getPeteDesktopBudgetStatus();
    assert.equal(status.ok && status.historyVerified, true);
    assert.equal(status.ok && status.historicalBookedUsd, 11.308772);
  });
  await t.test("project ceiling overrides a larger owner choice", async () => {
    resetFiles(); fakeReview(12_995_000);
    const c = await client();
    assert.equal((await c.call("budget", { enabled: true, budgetUsd: "2.00" })).status, 200);
    const before = providerCalls;
    await c.message(await c.lead());
    assert.equal(providerCalls, before, "worst-case reservation cannot fit the remaining project envelope");
    assert.equal((await c.call("status")).body.budget.projectRemainingUsd, 0.005);
  });
  await t.test("held lock and corrupt ledger cannot be reset from the UI", async () => {
    const c = await granted();
    fs.writeFileSync(path.join(temp, "pete-api-budget.lock"), "crash lock");
    assert.equal((await c.call("status")).body.budget.ok, false);
    assert.equal((await c.call("budget", { enabled: true, budgetUsd: "0.25" })).status, 409);
    fs.rmSync(path.join(temp, "pete-api-budget.lock"));
    fs.writeFileSync(ledgerFile, "corrupted");
    assert.equal((await c.call("budget", { enabled: false })).status, 409);
    assert.equal(fs.readFileSync(ledgerFile, "utf8"), "corrupted");
  });
  await t.test("usage above its reservation stops the budget and records at least the reported charge", async () => {
    const c = await granted();
    responseUsage = { input_tokens: 1_000_000, output_tokens: 0 };
    const result = await c.message(await c.lead());
    responseUsage = { input_tokens: 100, output_tokens: 20 };
    assert.notEqual(result.body.replySource, "llm");
    const status = (await c.call("status")).body.budget;
    assert.equal(status.enabled, false);
    assert.equal(status.blockReason, "accounting_review_required");
    assert.equal(status.reservedUsd, 2);
    assert.equal(status.remainingUsd, 0);
  });
  await t.test("STOP, human ownership and scripted campaign entry cost nothing and never send", async () => {
    const c = await granted();
    const before = providerCalls;
    const stopped = await c.lead();
    assert.equal((await c.message(stopped, "STOP")).status, 200);
    assert.equal(getConversationState(stopped, "eltern-vital-fit")?.flags.stopped, true);
    assert.equal((await c.message(stopped)).body.replySuppressedReason, "stopped");
    const human = await c.lead();
    const state = getConversationState(human, "eltern-vital-fit")!;
    takeOverByHuman(state); persistConversationState(state);
    assert.equal((await c.message(human)).body.replySuppressedReason, "human_owned");
    const entry = await c.call("entry", { keyword: "CHECK", source: "instagram_reel_comment" });
    assert.equal(entry.status, 200);
    assert.equal(entry.body.replySource, "scripted_context");
    assert.ok(entry.body.state.messages.every((m: any) => m.syntheticAutomation === true));
    assert.equal(providerCalls, before);
    assert.equal(process.env.PETE_LLM_API_CALLS_APPROVED, "false");
    assert.equal(process.env.INSTAGRAM_SEND_ENABLED, "false");
    assert.equal(process.env.WHATSAPP_SEND_ENABLED, "false");
  });
  await t.test("unsafe runtime drift rejects the owner session rather than opening a real channel", async () => {
    const c = await granted();
    for (const [key, unsafe] of [["INSTAGRAM_SEND_ENABLED", "true"], ["WHATSAPP_SEND_ENABLED", "true"],
      ["PETE_LLM_API_CALLS_APPROVED", "true"], ["NODE_ENV", "production"], ["GITHUB_ACTIONS", "true"]]) {
      const previous = process.env[key]; process.env[key] = unsafe;
      try { assert.equal((await c.call("budget", { enabled: true, budgetUsd: "0.25" })).status, 403); }
      finally { process.env[key] = previous; }
    }
  });
});
