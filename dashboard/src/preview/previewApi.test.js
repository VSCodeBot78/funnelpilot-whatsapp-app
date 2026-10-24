import test from "node:test";
import assert from "node:assert/strict";
import {
  loadPreviewSnapshot,
  previewResourcePath,
  readPreviewResource,
} from "./previewApi.js";

test("preview resources allow only explicit existing GET routes", () => {
  assert.equal(previewResourcePath("leads"), "/leads");
  assert.equal(
    previewResourcePath("conversation", {
      campaignId: "fit",
      leadId: "lead_1",
    }),
    "/conversations/fit/lead_1",
  );
  assert.equal(
    previewResourcePath("followUp", { campaignId: "fit", leadId: "lead 1" }),
    "/ghosting/preview/fit/lead%201",
  );
  for (const resource of [
    "/leads",
    "ensure",
    "POST",
    "takeover",
    "test-chat",
    "https://api.openai.com",
    "__proto__",
    "constructor",
  ])
    assert.throws(() => previewResourcePath(resource), /gesperrt/);
});

test("path traversal, URL delimiters and ambiguous identity encoding fail closed", () => {
  for (const id of [
    "",
    ".",
    "..",
    "../ensure",
    "a/b",
    "a\\b",
    "%2e%2e",
    "a?x=1",
    "a#x",
    "a\u0000",
    "x".repeat(201),
  ]) {
    assert.throws(
      () =>
        previewResourcePath("conversation", { campaignId: "fit", leadId: id }),
      /ID/,
    );
    assert.throws(
      () => previewResourcePath("followUp", { campaignId: id, leadId: "1" }),
      /ID/,
    );
  }
});

test("reader cannot be changed into a credentialed paid or write request", async () => {
  const calls = [];
  await readPreviewResource("leads", {
    method: "POST",
    body: "danger",
    apiBaseUrl: "https://api.openai.com",
    fetchImpl: async (...args) => {
      calls.push(args);
      return { ok: true, json: async () => ({ ok: true, leads: [] }) };
    },
  });
  const [url, options] = calls[0];
  assert.equal(url, "/leads");
  assert.equal(options.method, "GET");
  assert.equal(options.body, undefined);
  assert.equal(options.credentials, "omit");
  assert.equal(options.redirect, "error");
  assert.equal(options.cache, "no-store");
  assert.deepEqual(options.headers, { Accept: "application/json" });
});

test("unapproved resources fail before any network request", async () => {
  let calls = 0;
  await assert.rejects(
    readPreviewResource("human-message", {
      fetchImpl: () => {
        calls++;
      },
    }),
    /gesperrt/,
  );
  assert.equal(calls, 0);
});

test("malformed lists and unsuccessful backend responses are unavailable, never zero", async () => {
  for (const data of [
    { ok: true },
    { ok: false, leads: [] },
    { ok: true, leads: {} },
  ])
    await assert.rejects(
      readPreviewResource("leads", {
        fetchImpl: async () => ({ ok: true, json: async () => data }),
      }),
    );
  await assert.rejects(
    readPreviewResource("leads", {
      fetchImpl: async () => ({ ok: false, status: 503 }),
    }),
    /503/,
  );
});

test("a mismatched private conversation is rejected", async () => {
  await assert.rejects(
    readPreviewResource("conversation", {
      identity: { campaignId: "fit", leadId: "1" },
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          state: { campaignId: "other", leadId: "1", messages: [] },
        }),
      }),
    }),
    /identität/,
  );
  await assert.rejects(
    readPreviewResource("followUp", {
      identity: { campaignId: "fit", leadId: "1" },
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ ok: true, campaignId: "fit", leadId: "other" }),
      }),
    }),
    /identität/,
  );
});

test("partial failure preserves other confirmed sources and records missing evidence", async () => {
  const snapshot = await loadPreviewSnapshot({
    read: async (resource) => {
      if (resource === "conversations") throw new Error("offline");
      return { ok: true, resource };
    },
  });
  assert.equal(Object.keys(snapshot).length, 8);
  assert.equal(snapshot.leads.data.resource, "leads");
  assert.equal(snapshot.conversations.data, null);
  assert.equal(snapshot.conversations.error, "offline");
});

test("abort signals propagate to the GET request", async () => {
  const controller = new AbortController();
  controller.abort();
  await readPreviewResource("leads", {
    signal: controller.signal,
    fetchImpl: async (path, options) => {
      assert.equal(options.signal.aborted, true);
      return { ok: true, json: async () => ({ ok: true, leads: [] }) };
    },
  });
});
