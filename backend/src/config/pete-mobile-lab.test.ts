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

    await t.test("backend-owned entry scenarios create real conversation state and verified links", async () => {
      const ids = [
        ["check", "lab_checkscenario12345678901234567890", /check\.jochen-kammerer\.de/i],
        ["keto", "lab_ketoscenario123456789012345678901", /keto-guide/i],
        ["bullshit", "lab_bullshitscenario123456789012345", /no-bullshit-elternfitness/i],
      ] as const;
      for (const [scenarioId, leadId, link] of ids) {
        const response = await fetch(url + "/start", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, scenarioId, messageText: "ATTACKER OVERRIDE", campaignId: "other" }),
        });
        assert.equal(response.status, 200, scenarioId);
        const data = await response.json();
        assert.equal(data.scenarioId, scenarioId);
        assert.ok(data.state.messages.length >= 2, scenarioId + " should include real reply");
        assert.equal(data.state.messages[0].text.toUpperCase(), scenarioId.toUpperCase(),
          "scenario text must be server-owned");
        assert.match(String(data.reply), link, scenarioId + " should send verified resource");
        const stored = await (await fetch(url + "/state/" + leadId)).json();
        assert.deepEqual(stored.state.messages, data.state.messages,
          "must reopen the exact same persisted conversation");
        assert.equal((await fetch(url + "/start", {
          method:"POST", headers: {"Content-Type":"application/json"},
          body:JSON.stringify({leadId,scenarioId}),
        })).status, 409, "cannot silently restart or overwrite old test");
      }
    });

    await t.test("personal Jochen greeting hands over and Pete stays paused", async () => {
      const leadId="lab_manualwelcome12345678901234567890";
      const result = await fetch(url + "/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, scenarioId: "jochen_greeting" }),
      });
      assert.equal(result.status,200);
      const data=await result.json();
      assert.equal(data.replySuppressedReason,"human_owned");
      assert.equal(data.state.messages.length,1);
      assert.equal(data.state.messages[0].actor,"human");
      const after=await (await send(leadId,"Hey danke dir, bin Mama von zwei Kindern")).json();
      assert.equal(after.replySuppressedReason,"human_owned");
      assert.equal(after.state.messages.filter((m: any)=>m.role==="assistant").length,1,
        "no AI response following Jochen human message");
    });

    await t.test("realistic scripted entries are seeded silently and wait for a parent reply", async () => {
      const prepared = [
        ["follower_handoff", "lab_handoff_follower_synthetic_123456", 1, false],
        ["manychat_check_handoff", "lab_handoff_check_synthetic_123456789", 3, false],
        ["manychat_keto_handoff", "lab_handoff_keto_synthetic_1234567890", 3, false],
        ["manychat_bullshit_handoff", "lab_handoff_bullshit_synthetic_1234567", 2, false],
        ["reel_comment_bullshit_handoff", "lab_handoff_reelbull_synthetic_12345", 2, true],
        ["reel_comment_check_handoff", "lab_handoff_reelcheck_synthetic_1234", 2, true],
        ["story_reply_keto_handoff", "lab_handoff_storyketo_synthetic_1234", 2, false],
      ] as const;
      for (const [scenarioId, leadId, messageCount, hasPublicReply] of prepared) {
        const response = await fetch(url + "/start", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, scenarioId, messageText: "MALICIOUS OVERRIDE" }),
        });
        assert.equal(response.status, 200, scenarioId);
        const seeded = await response.json();
        assert.equal(seeded.ok, true);
        assert.equal(seeded.reply, null, scenarioId);
        assert.equal(seeded.replySource, "scripted_context");
        assert.equal(seeded.replySuppressedReason, "awaiting_synthetic_lead_reply");
        assert.equal(seeded.state.messages.length, messageCount, scenarioId);
        assert.equal(Boolean(seeded.publicReplyPreview), hasPublicReply, scenarioId);
        const fakeAutomation = seeded.state.messages.filter(
          (m: any) => m.syntheticAutomation === true);
        assert.equal(fakeAutomation.length, scenarioId === "follower_handoff" ? 0 :
          scenarioId === "manychat_check_handoff" || scenarioId === "manychat_keto_handoff" ? 2 : 1);
        for (const message of fakeAutomation) {
          assert.equal(message.role, "assistant");
          assert.equal(message.actor === "human", false);
        }
        assert.ok(seeded.state.messages.every((m: any) =>
          !m.text.includes("MALICIOUS OVERRIDE")));
        const reopened = await (await fetch(url + "/state/" + leadId)).json();
        assert.deepEqual(reopened.state.messages, seeded.state.messages);
        const b = await (await fetch(url + "/budget")).json();
        assert.equal(b.requestsStarted, 0, "scenario start must not consume tokens");
      }
      const afterWelcome = await send("lab_handoff_follower_synthetic_123456",
        "Danke dir. Ich will mehr Energie, der Alltag ist gerade stressig.");
      assert.equal(afterWelcome.status, 200);
      const continued = await afterWelcome.json();
      assert.notEqual(continued.replySuppressedReason, "human_owned",
        "explicit synthetic transfer allows Pete's next reply");
    });

    await t.test("Reel/emoji and Reel question are visibly recorded but never cause an AI pitch", async () => {
      for(const scenarioId of ["reel_only","reel_fun","reel_question"]) {
        const leadId="lab_mediatest"+scenarioId+"123456789012";
        const response=await fetch(url + "/start",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({leadId,scenarioId}),
        });
        assert.equal(response.status,200);
        const data=await response.json();
        assert.equal(data.replySuppressedReason,"shared_media_needs_human_review");
        assert.equal(data.replySource,"media_guard");
        assert.equal(data.state.messages.length,1,"no Pete reply for uninspected Reel");
        assert.match(data.state.messages[0].text,/nicht sichtbar/);
      }
      const bad=await fetch(url + "/start",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({leadId:"instagram:real",scenarioId:"reel_fun"}),
      });
      assert.equal(bad.status,400);
    });

    await t.test("Reel plus standalone KETO is deliberate keyword; no model API called", async () => {
      const leadId="lab_mediaKETOexplicit12345678901234";
      const result=await fetch(url + "/start",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({leadId,scenarioId:"reel_keyword"}),
      });
      assert.equal(result.status,200);
      const data=await result.json();
      assert.equal(data.replySuppressedReason,null);
      assert.match(String(data.reply),/keto-guide/i);
      const b=await (await fetch(url + "/budget")).json();
      assert.equal(b.requestsStarted,0);
    });
    await t.test("explicit private-lab approval returns a genuine mocked GPT-5.4 reply after synthetic handoff", async () => {
      const realFetch = globalThis.fetch;
      process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
      process.env.PETE_LLM_API_CALLS_APPROVED = "true";
      process.env.PETE_MOBILE_LAB_GPT54_CONSENT = "true";
      process.env.PETE_MOBILE_LAB_GPT54_CAP_MICRO_USD = "2000000";
      process.env.OPENAI_MODEL = "gpt-5.4";
      process.env.OPENAI_API_KEY = "offline-test-key";
      let calls = 0;
      globalThis.fetch = async (input, init) => {
        if (String(input) === "https://api.openai.com/v1/responses") {
          calls++;
          const req = JSON.parse(String(init?.body ?? "{}"));
          assert.equal(req.model, "gpt-5.4");
          assert.equal(req.store, false);
          assert.match(String(req.input?.[0]?.content), /Schichtarbeit/);
          return new Response(JSON.stringify({
            output: [{ content: [{ type: "output_text", text: JSON.stringify({
              reply: "Bei Schichtarbeit sind feste Zeiten schwierig. Was ist für dich gerade die größere Baustelle, Essen oder Schlaf?",
              needsHuman: false,
            }) }] }],
            usage: { input_tokens: 900, output_tokens: 100 },
          }), { status: 200 });
        }
        return realFetch(input, init);
      };
      try {
        const before = await (await fetch(url + "/budget")).json();
        assert.equal(before.llmReady, true);
        assert.equal(before.mode, "gpt-5.4");
        assert.equal(before.labAuthorizedUsd, 2);
        assert.equal(before.labRemainingUsd, 2);
        const leadId = "lab_gpt54parent123456789012345678";
        const start = await (await fetch(url + "/start", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, scenarioId: "follower_handoff" }),
        })).json();
        assert.equal(start.replySource, "scripted_context");
        assert.equal(calls, 0, "synthetic setup must not spend");
        const sent = await (await send(leadId,
          "Sowohl als auch. Wegen Schichtarbeit habe ich kaum Zeit.")).json();
        assert.equal(sent.ok, true);
        assert.equal(sent.replySource, "llm");
        assert.match(String(sent.reply), /Schichtarbeit/);
        assert.equal(calls, 1);
        const after = await (await fetch(url + "/budget")).json();
        assert.equal(after.requestsStarted, 1);
        assert.equal(after.requestsMetered, 1);
        assert.ok(after.labRemainingUsd < 2);
        assert.ok(after.labRemainingUsd > 1.99);
      } finally {
        globalThis.fetch = realFetch;
        process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
        process.env.PETE_LLM_API_CALLS_APPROVED = "false";
        delete process.env.PETE_MOBILE_LAB_GPT54_CONSENT;
        delete process.env.PETE_MOBILE_LAB_GPT54_CAP_MICRO_USD;
        delete process.env.OPENAI_MODEL;
        delete process.env.OPENAI_API_KEY;
      }
    });

  });
});
