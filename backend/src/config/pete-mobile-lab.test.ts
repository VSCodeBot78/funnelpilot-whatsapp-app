import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pete-lab-data-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.PETE_MOBILE_LAB_ENABLED = "false";
process.env.PETE_MOBILE_LAB_ISOLATED_DATA = "false";
process.env.PETE_PROJECT_PRIOR_SPEND_MICRO_USD = "4323801";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.INSTAGRAM_ENGINE_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
process.env.INSTAGRAM_ALLOW_ALL_SENDERS = "false";
process.env.WHATSAPP_ALLOW_ALL_RECIPIENTS = "false";
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
delete process.env.OPENAI_API_KEY;

const { default: app } = await import("../app.js");
const { clearConversationStore } = await import("../data/store.js");

async function withServer(run: (base: string) => Promise<void>) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await run("http://127.0.0.1:" + address.port);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()));
  }
}

test("Pete mobile lab is gated, synthetic-only, and never sends real messages", async t => {
  t.after(() => {
    process.env.PETE_MOBILE_LAB_ENABLED = "false";
    process.env.PETE_MOBILE_LAB_ISOLATED_DATA = "false";
    clearConversationStore();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await withServer(async base => {
    const url = base + "/test-chat/lab";
    const id = "lab_123456789012345678901234";
    const send = (leadId: string, messageText: string) => fetch(url + "/message", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, messageText, campaignId: "attacker-campaign" }),
    });

    await t.test("disabled by default even for budget info", async () => {
      assert.equal((await fetch(url + "/budget")).status, 404);
      assert.equal((await send(id, "Hallo!")).status, 404);
    });
    await t.test("explicit flag and isolated DATA_DIR acknowledgement both needed", async () => {
      process.env.PETE_MOBILE_LAB_ENABLED = "true";
      assert.equal((await fetch(url + "/budget")).status, 404);
      process.env.PETE_MOBILE_LAB_ISOLATED_DATA = "true";
      const res = await fetch(url + "/budget");
      assert.equal(res.status, 200);
      const budget = await res.json();
      assert.equal(budget.hardCapUsd, 8);
      assert.equal(budget.confirmedUsd, 4.323801);
      assert.equal(budget.priorConfirmedUsd, 4.323801);
      assert.equal(budget.remainingUsd, 3.676199);
      assert.equal(budget.requestsStarted, 0);
      assert.equal(res.headers.get("cache-control"), "no-store");
    });
    await t.test("rejects live IDs and oversized messages", async () => {
      assert.equal((await send("instagram:lead-real", "Hallo")).status, 400);
      assert.equal((await send("lab_1", "Hallo")).status, 400);
      assert.equal((await send(id, "a".repeat(1001))).status, 400);
      assert.equal((await fetch(url + "/state/instagram:lead-real")).status, 404);
    });
    await t.test("fixed simulated Instagram entries preserve true context and block forged starts", async () => {
      const available = await fetch(url + "/scenarios");
      assert.equal(available.status, 200);
      const options = (await available.json()).scenarios;
      for (const name of ["follower","check","bullshit","keto","guide","video",
        "reel_only","reel_casual","reel_question","free"])
        assert.ok(options.some((s: {id: string}) => s.id === name), name);
      const start = (leadId: string, scenarioId: string) => fetch(url + "/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, scenarioId,
          // Attempted override from the client must be ignored.
          campaignId: "attacker-campaign", text: "injected", reply: "fake" }),
      });
      assert.equal((await start("instagram:real", "follower")).status, 400);
      assert.equal((await start("lab_123456789012345678901299", "unknown")).status, 400);
      const followerId = "lab_123456789012345678901250";
      const greetingRes = await start(followerId,"follower");
      assert.equal(greetingRes.status,200);
      const greeting = await greetingRes.json();
      assert.equal(greeting.state.messages.length,1);
      assert.equal(greeting.state.messages[0].role,"assistant");
      assert.match(greeting.state.messages[0].text,/Ich bin Pete/);
      assert.equal(greeting.state.answers,undefined);
      assert.equal((await start(followerId,"follower")).status,409,"no duplicate start");
      const welcomeSaved = await (await fetch(url+"/state/"+followerId)).json();
      assert.equal(welcomeSaved.state.messages[0].id,greeting.state.messages[0].id);
      const reelId = "lab_123456789012345678901251";
      const reel = await (await start(reelId,"reel_only")).json();
      assert.equal(reel.replySuppressedReason,"shared_media_no_sales");
      assert.equal(reel.state.messages.length,1);
      assert.match(reel.state.messages[0].text,/Inhalt.*nicht zugänglich/);
      assert.ok(!reel.state.messages.some((m:{role:string})=>m.role==="assistant"));
      const casualId = "lab_123456789012345678901252";
      const casual = await (await start(casualId,"reel_casual")).json();
      assert.equal(casual.replySuppressedReason,"shared_media_no_sales");
      assert.deepEqual(casual.state.messages.map((m:{role:string})=>m.role),["user","user"]);
      assert.equal(casual.state.messages[1].text,"😂😂");
      const ketoId = "lab_123456789012345678901253";
      const keto = await (await start(ketoId,"keto")).json();
      assert.equal(keto.ok,true);
      assert.equal(keto.state.messages[0].text,"KETO");
      assert.ok(keto.state.messages.some((m:{role:string})=>m.role==="assistant"),
        "keyword must be processed by actual Pete engine");
      const parentId = "lab_123456789012345678901254";
      const question = await (await start(parentId,"reel_question")).json();
      assert.equal(question.ok,true);
      assert.match(question.state.messages[0].text,/Instagram-Reel geteilt/);
      assert.match(question.state.messages[1].text,/Training anfangen/);
      const cost = await (await fetch(url+"/budget")).json();
      assert.equal(cost.requestsStarted,0,"simulations must not use paid OpenAI API");
    });

    await t.test("synthetic roundtrip returns only messages and never contacts or keys", async () => {
      const result = await send(id, "Ich bin ein fiktiver Papa und möchte mehr Energie.");
      assert.equal(result.status, 200);
      const data = await result.json();
      assert.equal(data.ok, true);
      assert.ok(data.state.messages.length >= 1);
      assert.equal(data.state.leadId, undefined);
      assert.equal(data.state.answers, undefined);
      const state = await fetch(url + "/state/" + id);
      assert.equal(state.status, 200);
      const saved = await state.json();
      assert.equal(saved.state.messages[0].role, "user");
      assert.equal(saved.state.flags, undefined);
      const b = await (await fetch(url + "/budget")).json();
      assert.equal(b.requestsStarted, 0, "no unapproved model API calls");
      assert.equal(b.committedUsd, 4.323801, "historical spend preserved");
    });
  });
});
