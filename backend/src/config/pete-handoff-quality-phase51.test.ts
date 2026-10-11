import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-phase51-"));
process.env.NODE_ENV = "test";
process.env.DATA_DIR = dir;
process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
process.env.PETE_LLM_API_CALLS_APPROVED = "false";
process.env.INSTAGRAM_SEND_ENABLED = "false";
process.env.WHATSAPP_SEND_ENABLED = "false";
delete process.env.OPENAI_API_KEY;
const { getPeteLlmConversationReply, classifyPeteOutputRejection } =
  await import("../core/pete-llm-conversation.js");
const { reservePeteBudget, getPeteBudgetStatus } =
  await import("../services/pete-api-budget.service.js");
const { getPeteVerifiedTransactionAnswer } = await import("../core/pete-conversation-quality.js");
const { writeSettings } = await import("../services/settings-store.js");

function enable(model: string) {
  process.env.PETE_LLM_CONVERSATION_ENABLED = "true";
  process.env.PETE_LLM_API_CALLS_APPROVED = "true";
  process.env.OPENAI_API_KEY = "synthetic-fake-key";
  process.env.OPENAI_MODEL = model;
  writeSettings({ aiEnabled: true });
}
function state(text = "Ich habe ein Problem mit dem Elternalltag.") {
  return { campaignId: "synthetic", answers: {},
    messages: [{ role: "user", text }] } as any;
}
function provider(reply: unknown, usage = { input_tokens: 230, output_tokens: 160 }) {
  return new Response(JSON.stringify({
    output: [{ content: [{ type: "output_text", text: JSON.stringify(reply) }] }],
    usage,
  }), { status: 200 });
}

test("Phase 51: high-quality model headroom, no unverified cost claims", async t => {
  const prevFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = prevFetch;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_API_KEY;
    process.env.PETE_LLM_CONVERSATION_ENABLED = "false";
    process.env.PETE_LLM_API_CALLS_APPROVED = "false";
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await t.test("gpt-5.4 receives 800-token headroom and explicit low latency no-reasoning mode", async () => {
    enable("gpt-5.4");
    let calls = 0;
    globalThis.fetch = async (_url, init) => {
      calls++;
      const body = JSON.parse(String((init as RequestInit).body));
      assert.equal(body.model, "gpt-5.4");
      assert.equal(body.max_output_tokens, 800);
      assert.equal(body.reasoning.effort, "none");
      assert.equal(body.store, false);
      return provider({ reply: "Kinderkrankheit ist keine Trainingsniederlage. Ein flexibler Wiedereinstieg funktioniert auch nach Pausen.", needsHuman: false });
    };
    const result = await getPeteLlmConversationReply(state());
    assert.equal(result.kind, "llm");
    assert.equal(calls, 1);
    assert.ok(getPeteBudgetStatus().committedUsd > 0);
  });

  await t.test("gpt-4.1-mini retains cheap and bounded 400-token path", async () => {
    enable("gpt-4.1-mini");
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body));
      assert.equal(body.max_output_tokens, 400);
      assert.equal(body.reasoning, undefined);
      return provider({ reply: "Auch kurze Pausen gehören im Elternalltag dazu.", needsHuman: false });
    };
    assert.equal((await getPeteLlmConversationReply(state())).kind, "llm");
  });

  await t.test("incomplete API response has safe diagnostic without raw lead text", async () => {
    enable("gpt-5.4");
    globalThis.fetch = async () => new Response(JSON.stringify({
      status: "incomplete", incomplete_details: { reason: "max_output_tokens" },
      output: [], usage: { input_tokens: 300, output_tokens: 800 },
    }), { status: 200 });
    const result = await getPeteLlmConversationReply(state("Meine private Geschichte mit Kindern ..."));
    assert.equal(result.kind, "handoff");
    if (result.kind !== "handoff") throw Error("Expected fail-safe");
    assert.equal(result.reason, "invalid_output");
    assert.equal(result.detail, "response_incomplete_max_output_tokens");
    assert.doesNotMatch(result.detail || "", /private|geschichte|Kinder/);
  });

  await t.test("unsafe costs are not accepted and the reason is inspectable", async () => {
    enable("gpt-5.4");
    globalThis.fetch = async () => provider({
      reply: "Du hast bei uns garantiert keine versteckten Kosten.", needsHuman: false,
    });
    const result = await getPeteLlmConversationReply(state("Ich fürchte Zusatzkosten."));
    assert.equal(result.kind, "handoff");
    if (result.kind !== "handoff") throw Error("Expected fail-safe");
    assert.equal(result.reason, "invalid_output");
    assert.equal(result.detail, "unsupported_claim");
  });

  await t.test("fully checked hidden-fee response does NOT confirm unknown terms", () => {
    const r=getPeteVerifiedTransactionAnswer("Ich bin Vater und befürchte versteckte Kosten im Checkout.", state());
    assert.ok(r);
    assert.match(r.text, /Kaufübersicht/);
    assert.doesNotMatch(r.text, /keine versteckten Kosten|keine Extras/i);
    assert.equal(r.handoff, undefined);
  });

  await t.test("missing access after claimed purchase is human-owned, without confirming the payment", () => {
    const r=getPeteVerifiedTransactionAnswer("Ich habe eine Zahlung, mein Zugang fehlt. Bitte prüft das.", state());
    assert.ok(r);
    assert.equal(r.handoff, true);
    assert.match(r.text, /nicht|prüf/i);
    assert.doesNotMatch(r.text, /Zahlung ist bestätigt/i);
  });

  await t.test("blocked response categories are deterministic and contain no sensitive text", () => {
    assert.equal(classifyPeteOutputRejection({ reply: "A".repeat(751), needsHuman: false }), "too_long");
    assert.equal(classifyPeteOutputRejection({ reply: "Wie? Warum?", needsHuman: false }), "multiple_questions");
    assert.equal(classifyPeteOutputRejection({ reply: "Die Zahlung ist bestätigt.", needsHuman: false }), "unsupported_confirmation");
    assert.equal(classifyPeteOutputRejection({ reply: "Die Rechnung ist 500 Euro.", needsHuman: false }), "invented_price");
  });

  await t.test("Pete identity is canonical even when a model swaps ownership", async () => {
    enable("gpt-5.4");
    globalThis.fetch = async () => provider({
      reply: "Ich bin übrigens Petes KI-Assistent für Jochen, nicht Jochen selbst.",
      needsHuman: false,
    });
    const result = await getPeteLlmConversationReply(state("Ich habe Angst vor Doppelantworten."));
    assert.equal(result.kind, "llm");
    if (result.kind !== "llm") throw Error("expected repaired identity");
    assert.match(result.text, /Ich bin Pete, Jochens KI-Assistent/);
    assert.doesNotMatch(result.text, /Petes KI-Assistent/);
  });

  await t.test("an uncertain purchase without receipt must not become a sales quiz", () => {
    const answer = getPeteVerifiedTransactionAnswer(
      "Ich bin Selbststarter-Käufer, vermute eine Zahlung, finde aber keinen Beleg.",
      state(),
    );
    assert.equal(answer?.handoff, true);
    assert.match(answer?.text || "", /verifiziert|Bestell/);
  });

  await t.test("approved flagship envelope remains within 1.50 USD for 20 worst-case calls", () => {
    process.env.PETE_PHASE3_FLAGSHIP_ENVELOPE = "true";
    assert.throws(() => reservePeteBudget({
      model: "gpt-5.4", requestBody: "X".repeat(18001), maxOutputTokens: 800,
    }));
    const budget = getPeteBudgetStatus();
    assert.ok(budget.committedUsd < 8);
    delete process.env.PETE_PHASE3_FLAGSHIP_ENVELOPE;
  });
});
