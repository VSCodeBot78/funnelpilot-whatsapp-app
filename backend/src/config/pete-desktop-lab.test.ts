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
const { saveCampaign } = await import("../data/campaigns.store.js");
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
  async function granted() {
    resetFiles();
    const c = await client();
    assert.equal((await c.call("budget", { enabled: true })).status, 200);
    return c;
  }

  await t.test("status never authorizes paid calls; owner toggle needs no history or tier", async () => {
    resetFiles();
    const c = await client();
    const before = providerCalls;
    const status = (await c.call("status")).body;
    assert.equal(status.budget.knownHistoricalBookedUsd, 11.158772);
    assert.equal(status.budget.historyVerified, false);
    assert.equal(status.budget.projectRemainingUsd, null);
    assert.equal(status.budget.enabled, false);
    assert.equal(providerCalls, before);
    assert.equal(fs.existsSync(ledgerFile), false, "status cannot manufacture or reset a ledger");
    assert.equal((await c.call("budget", { enabled: true })).status, 200);
    assert.equal((await c.call("budget", { enabled: false })).status, 200);
    assert.equal((await c.message(await c.lead())).status, 200);
    assert.equal(providerCalls, before, "switch OFF cannot make a paid model call");
  });
  await t.test("read-only POST aliases preserve strict origin, CSRF and no paid network", async () => {
    resetFiles();
    const c = await client();
    const before = providerCalls;
    const result = await c.call("status", {});
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.budget.enabled, false);
    const empty = await c.call("active", {});
    assert.equal(empty.status, 200);
    assert.equal(empty.body.leadId, null);
    const leadId = await c.lead();
    const state = await c.call("state/" + encodeURIComponent(leadId), {});
    assert.equal(state.status, 200);
    assert.equal(state.body.ok, true);
    const active = await c.call("active", {});
    assert.equal(active.status, 200);
    assert.equal(active.body.leadId, leadId);
    assert.deepEqual(active.body.state.messages, state.body.state.messages);
    const unrelatedSession = await client();
    assert.equal((await unrelatedSession.call("active", {})).body.leadId, null);
    for (const route of ["status", "active", "state/" + encodeURIComponent(leadId)]) {
      assert.equal((await c.call(route, {}, { Origin: "" })).status, 403);
      assert.equal((await c.call(route, {}, { "X-Pete-CSRF": "" })).status, 403);
      assert.equal((await c.call(route, {}, { Host: "evil.invalid:5173" })).status, 403);
    }
    assert.equal(providerCalls, before);
    assert.equal(fs.existsSync(ledgerFile), false);
  });
  await t.test("desktop active lab remains visible after handover and is isolated from another browser", async () => {
    resetFiles();
    const c = await client();
    const before = providerCalls;
    const leadId = await c.lead();
    const state = getConversationState(leadId, "eltern-vital-fit")!;
    takeOverByHuman(state); persistConversationState(state);
    const recovered = (await c.call("active", {})).body;
    assert.equal(recovered.leadId, leadId);
    assert.equal(recovered.replySuppressedReason, "human_owned");
    const outsider = await client();
    assert.equal((await outsider.call("active", {})).body.leadId, null);
    assert.equal(providerCalls, before, "opening an existing lab chat is free");
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
  await t.test("V2 saved flow executes only once in session-bound NoSend lab before Pete handoff", async () => {
    resetFiles();
    saveCampaign({
      id: "owner-check-flow", name: "Owner CHECK V2",
      peteCampaign: {
        sources: ["instagram_dm", "instagram_reel_comment"], keywords: ["CHECK"],
        openingText: "Dein CHECK Einstieg.", followUpEnabled: false,
        flowDraftEnabled: true, autoReplyEnabled: true,
        openingDmButtonEnabled: true, openingDmButtonLabel: "CHECK starten",
        linkEnabled: true, linkLabel: "Elterncheck", linkUrl: "https://check.jochen-kammerer.de",
        linkMessageText: "Hier geht es zum Check.",
        peteHandoffEnabled: true,
      },
    });
    const c = await client();
    const other = await client();
    const before = providerCalls;
    const entry = await c.call("entry", { keyword: "CHECK", source: "instagram_dm" });
    assert.equal(entry.status, 200);
    const { leadId } = entry.body;
    assert.equal(entry.body.matchedCampaignId, "owner-check-flow");
    assert.equal(entry.body.openingSource, "saved_campaign_draft");
    assert.equal(entry.body.flow.mode, "nosend_only");
    assert.equal(entry.body.flow.sendAllowed, false);
    assert.equal(entry.body.flow.campaignId, "owner-check-flow");
    assert.equal(entry.body.flow.stage, "await_button");
    assert.equal(entry.body.state.messages.filter((m: any) => m.syntheticAutomation).length, 1);
    assert.equal((await c.call("active", {})).body.flow.stage, "await_button");
    assert.equal((await c.call("flow-action", { leadId, action: "link" })).status, 409);
    assert.equal((await c.call("flow-action", { leadId, action: "button", campaignId: "forged" })).status, 400);
    assert.equal((await other.call("flow-action", { leadId, action: "button" })).status, 403);
    assert.equal((await c.message(leadId, "Kann Pete schon antworten?")).status, 409);
    const first = await c.call("flow-action", { leadId, action: "button" });
    assert.equal(first.status, 200);
    assert.equal(first.body.flow.stage, "await_link");
    assert.equal(first.body.state.messages.filter((m: any) => m.syntheticAutomation).length, 2);
    assert.equal(first.body.state.messages.at(-1).text.includes("https://check.jochen-kammerer.de/"), true);
    assert.equal((await c.call("flow-action", { leadId, action: "button" })).status, 409);
    const second = await c.call("flow-action", { leadId, action: "link" });
    assert.equal(second.status, 200);
    assert.equal(second.body.flow.stage, "pete_ready");
    assert.equal(second.body.state.messages.length, first.body.state.messages.length,
      "link click does not fake another DM");
    assert.equal((await c.call("flow-action", { leadId, action: "link" })).status, 409);
    const pete = await c.message(leadId, "Ich bin abends oft müde und snacke.");
    assert.equal(pete.status, 200);
    assert.equal(providerCalls, before, "flow and default KI-OFF handoff must not reach a provider");

    const stopped = await c.call("entry", { keyword: "CHECK", source: "instagram_dm" });
    assert.equal(stopped.status, 200);
    const stop = await c.message(stopped.body.leadId, "STOP");
    assert.equal(stop.status, 200);
    assert.equal(stop.body.replySuppressedReason, "stopped");
    assert.equal((await c.call("flow-action", { leadId: stopped.body.leadId, action: "button" })).status, 409);
    assert.equal(providerCalls, before);

    const human = await c.call("entry", { keyword: "CHECK", source: "instagram_dm" });
    const state = getConversationState(human.body.leadId, "eltern-vital-fit")!;
    takeOverByHuman(state); persistConversationState(state);
    assert.equal((await c.call("flow-action", { leadId: human.body.leadId, action: "button" })).status, 409);
    assert.equal(providerCalls, before);

    const reel = await c.call("entry", { keyword: "CHECK", source: "instagram_reel_comment" });
    assert.equal(reel.body.campaignMatchStatus, "manual_review");
    assert.equal(reel.body.flow, null);
    assert.equal(reel.body.savedOpeningUsed, false);
    assert.equal(providerCalls, before);
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
    assert.equal(result.body.budget.remainingUsd, null);
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
    const again = await c.call("budget", { enabled: true });
    assert.equal(again.body.budget.confirmedUsd, 0.0004);
    assert.equal(again.body.budget.remainingUsd, null);
  });
  await t.test("parallel paid HTTP requests reserve durable cost records", async () => {
    const c = await granted();
    holdProvider = true;
    const leads = await Promise.all(Array.from({ length: 16 }, () => c.lead()));
    const inFlight = leads.map(id => c.message(id));
    await new Promise(resolve => setTimeout(resolve, 150));
    const during = (await c.call("status")).body.budget;
    assert.ok(waiting.length > 0);
    assert.ok(waiting.length <= 16);
    assert.ok(during.reservedUsd > 0);
    assert.equal(during.remainingUsd, null);
    holdProvider = false;
    const releases = waiting; waiting = []; releases.forEach(resolve => resolve());
    await Promise.all(inFlight);
    assert.ok((await c.call("status")).body.budget.committedUsd > 0);
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
    assert.equal(after.authorizedUsd, null);
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
    assert.equal((await c.call("budget", { enabled: true })).status, 200);
    assert.equal((await c.message(leadId, "Mir geht es vor allem um mein Essen am Abend.")).body.replySource, "llm");
  });
  await t.test("old history review cannot bypass session consent or OFF", async () => {
    const c = await granted();
    const initial = (await c.call("status")).body.budget;
    assert.equal(initial.historyVerified, false);
    assert.equal(initial.ownerManagedCosts, true);
    const before = providerCalls;
    await c.call("budget", { enabled: false });
    await c.message(await c.lead());
    assert.equal(providerCalls, before, "switch OFF prevents paid model calls");
    assert.equal((await c.call("budget", { enabled: true })).status, 200);
    assert.equal((await c.call("status")).body.budget.confirmedUsd, initial.confirmedUsd);
  });
  await t.test("historical review cannot manufacture owner authorization or reset spending", async () => {
    resetFiles(); fakeReview();
    const first = budgetService.getPeteDesktopBudgetStatus();
    assert.equal(first.historyVerified, false);
    assert.equal(first.authorizedUsd, null);
    assert.equal(first.remainingUsd, null);
    const c = await client();
    assert.equal((await c.call("budget", { enabled: true })).status, 200);
    const status = (await c.call("status")).body.budget;
    assert.equal(status.authorizedUsd, null);
    assert.equal(status.confirmedUsd, 0);
    assert.equal(status.reservedUsd, 0);
  });
  await t.test("owner KI consent no longer inherits unrelated QA project ceiling", async () => {
    resetFiles(); fakeReview(12_995_000);
    const c = await client();
    assert.equal((await c.call("budget", { enabled: true })).status, 200);
    const before = providerCalls;
    const result = await c.message(await c.lead());
    assert.equal(result.body.replySource, "llm");
    assert.equal(providerCalls, before + 1);
    assert.equal((await c.call("status")).body.budget.projectRemainingUsd, null);
  });
  await t.test("held lock and corrupt ledger cannot be reset from the UI", async () => {
    const c = await granted();
    fs.writeFileSync(path.join(temp, "pete-api-budget.lock"), "crash lock");
    assert.equal((await c.call("status")).body.budget.ok, false);
    assert.equal((await c.call("budget", { enabled: true })).status, 409);
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
    assert.equal(status.remainingUsd, null);
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
    // WELCOME-001: These are the owner's exact two manually sent greetings,
    // NOT a fake follower DM. Later synthetic user text must reach Pete.
    const welcomes = [
      ["WELCOME_1", "Hi, herzlich willkommen bei mir auf dem Profil 🙌\nFreut mich wirklich, dass du da bist.\nWas beschäftigt dich gerade am meisten, mehr Energie, abnehmen oder endlich wieder fitter werden?"],
      ["WELCOME_2", "Hey, herzlich willkommen bei mir auf dem Profil 🙌\nFreut mich wirklich, dass du da bist.\nWas beschäftigt dich gerade am meisten, mehr Energie, abnehmen oder endlich wieder fitter werden?\nOder bist du gerade wegen Keto hier?"],
    ] as const;
    const welcomeLeads: string[] = [];
    for (const [keyword, text] of welcomes) {
      const started = await c.call("entry", { keyword, source: "instagram_dm" });
      assert.equal(started.status, 200);
      assert.equal(started.body.entryKeyword, keyword);
      assert.equal(started.body.matchedRealCampaign, false);
      assert.equal(started.body.state.messages.length, 1);
      assert.equal(started.body.state.messages[0].text, text);
      assert.equal(started.body.state.messages[0].actor, "human");
      assert.equal(started.body.state.messages[0].syntheticAutomation, false);
      assert.match(started.body.note, /Keine automatische Follower-DM/);
      const state = getConversationState(started.body.leadId, "eltern-vital-fit")!;
      assert.equal(state.messages[0].text, text);
      assert.equal(state.messages[0].actor, "human");
      assert.equal(state.messages[0].transport, "lab_manual_owner_greeting");
      assert.equal(state.messages[0].dryRun, true);
      assert.equal(state.messages[0].sent, false);
      assert.equal(state.lastUserMessageAt, undefined, "manual outgoing welcome must not fake a 24-hour inbound window");
      assert.equal(state.owner, "ai", "synthetic owner greeting must release Pete to answer a follower reply");
      assert.equal(state.aiPaused, false);
      welcomeLeads.push(started.body.leadId);
    }
    assert.equal((await c.call("entry", { keyword: "WELCOME_1", source: "instagram_reel_comment" })).status, 403);
    assert.equal((await c.call("entry", { keyword: "WELCOME_2", source: "instagram_story_reply" })).status, 403);
    assert.equal((await c.call("entry", { keyword: "WELCOME_3", source: "instagram_dm" })).status, 400);
    // A free conversation must continue without provider traffic.
    assert.equal((await c.call("budget", { enabled: false })).status, 200);
    const follower = await c.message(welcomeLeads[0], "Hallo Jochen, ich hätte gern wieder mehr Energie.");
    assert.equal(follower.status, 200);
    assert.notEqual(follower.body.replySuppressedReason, "human_owned");
    assert.ok(getConversationState(welcomeLeads[0], "eltern-vital-fit")?.lastUserMessageAt);
    assert.equal(providerCalls, before);
    assert.equal(process.env.PETE_LLM_API_CALLS_APPROVED, "false");
    assert.equal(process.env.INSTAGRAM_SEND_ENABLED, "false");
    assert.equal(process.env.WHATSAPP_SEND_ENABLED, "false");
  });
  await t.test("campaign entry distinguishes activated V2 draft from demo fallback (NoSend)", async () => {
    resetFiles();
    const c = await client();
    const before = providerCalls;
    saveCampaign({ id: "lab-enabled-check", name: "Check im Editor", peteCampaign: {
      sources: ["instagram_dm"], keywords: ["CHECK"],
      openingText: "Gespeicherte Check-Erstantwort, kein Versand.",
      followUpEnabled: false, flowDraftEnabled: true, autoReplyEnabled: true,
      peteHandoffEnabled: true,
    } });
    const enabled = await c.call("entry", { keyword: "CHECK", source: "instagram_dm" });
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.campaignMatchStatus, "matched");
    assert.equal(enabled.body.matchedCampaignId, "lab-enabled-check");
    assert.equal(enabled.body.matchedRealCampaign, true);
    assert.equal(enabled.body.openingSource, "saved_campaign_draft");
    assert.equal(enabled.body.savedOpeningUsed, true);
    assert.equal(enabled.body.peteHandoffDraftConfigured, true);
    assert.match(enabled.body.state.messages.at(-1).text, /Gespeicherte Check-Erstantwort/);
    assert.equal(enabled.body.state.messages.at(-1).syntheticAutomation, true);
    assert.match(enabled.body.note, /NoSend-Entwurf/);

    saveCampaign({ id: "lab-disabled-keto", name: "Keto ohne aktivierte Autoantwort", peteCampaign: {
      sources: ["instagram_story_reply"], keywords: ["KETO"],
      openingText: "Diese deaktivierte Antwort darf nicht als Automation gelten.",
      followUpEnabled: false, flowDraftEnabled: true, autoReplyEnabled: false,
      peteHandoffEnabled: false,
    } });
    const disabled = await c.call("entry", { keyword: "KETO", source: "instagram_story_reply" });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.campaignMatchStatus, "matched");
    assert.equal(disabled.body.matchedCampaignId, "lab-disabled-keto");
    assert.equal(disabled.body.savedOpeningUsed, false);
    assert.equal(disabled.body.openingSource, "demo_example");
    assert.equal(disabled.body.peteHandoffDraftConfigured, false);
    assert.doesNotMatch(disabled.body.state.messages.at(-1).text, /deaktivierte Antwort/);
    assert.match(disabled.body.note, /keine aktivierte Erstantwort/);

    const noMatch = await c.call("entry", { keyword: "BULLSHIT", source: "instagram_story_reply" });
    assert.equal(noMatch.status, 200);
    assert.equal(noMatch.body.campaignMatchStatus, "no_match");
    assert.equal(noMatch.body.matchedCampaignId, null);
    assert.equal(noMatch.body.openingSource, "demo_example");
    assert.equal(noMatch.body.savedOpeningUsed, false);
    assert.match(noMatch.body.note, /keine passende eindeutige Kampagne/);
    assert.equal(providerCalls, before, "synthetic entry must never call the model");
    for (const entry of [enabled, disabled, noMatch]) {
      assert.ok(entry.body.state.messages.every((m: any) => m.sent !== true));
      assert.ok(entry.body.state.messages.some((m: any) => m.syntheticAutomation === true));
    }
  });

  await t.test("unsafe runtime drift rejects the owner session rather than opening a real channel", async () => {
    const c = await granted();
    for (const [key, unsafe] of [["INSTAGRAM_SEND_ENABLED", "true"], ["WHATSAPP_SEND_ENABLED", "true"],
      ["PETE_LLM_API_CALLS_APPROVED", "true"], ["NODE_ENV", "production"], ["GITHUB_ACTIONS", "true"]]) {
      const previous = process.env[key]; process.env[key] = unsafe;
      try { assert.equal((await c.call("budget", { enabled: true })).status, 403); }
      finally { process.env[key] = previous; }
    }
  });
});
