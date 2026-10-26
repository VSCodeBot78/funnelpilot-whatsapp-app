import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../package.json", import.meta.url));
const proxyaddr = require("proxy-addr");
const express = require("express");
const backendDirectory = fileURLToPath(new URL("../", import.meta.url));

// Isolated dependency fixtures only: no product app, stores, credentials,
// outbound providers, real leads or Pete conversation engine are loaded.
test("a short IPv4-mapped IPv6 trust prefix never trusts arbitrary IPv4 peers", () => {
  const trust = proxyaddr.compile("::ffff:10.0.0.0/8");
  assert.equal(trust("203.0.113.23", 0), false);
  assert.equal(trust("198.51.100.24", 0), false);
});

test("an untrusted peer cannot supply its own client IP through X-Forwarded-For", () => {
  const request = {
    socket: { remoteAddress: "203.0.113.23" },
    headers: { "x-forwarded-for": "192.0.2.42" },
  };
  const trust = proxyaddr.compile("::ffff:10.0.0.0/8");
  assert.equal(proxyaddr(request, trust), "203.0.113.23");
  assert.deepEqual(proxyaddr.all(request, trust), ["203.0.113.23"]);
});

test("valid IPv4-mapped trust ranges still accept only their named IPv4 block", () => {
  const trust = proxyaddr.compile("::ffff:10.0.0.0/104");
  assert.equal(trust("10.20.30.40", 0), true);
  assert.equal(trust("203.0.113.23", 0), false);
});

test("an IPv6-only trust subnet does not implicitly trust IPv4 peers", () => {
  const trust = proxyaddr.compile("::/1");
  assert.equal(trust("203.0.113.23", 0), false);
  assert.equal(trust("2001:db8::42", 0), true);
});

test("three-parameter routes reject an ambiguous non-match within a bounded child process", () => {
  const script = `
    const assert = require("node:assert/strict");
    const pattern = require("path-to-regexp")("/:a-:b-:c");
    assert.equal(pattern.test("/alpha-beta-gamma"), true);
    assert.equal(pattern.test("/" + "a-".repeat(1000) + "a/extra"), false);
  `;
  const result = spawnSync(process.execPath, ["-e", script], {
    cwd: backendDirectory,
    timeout: 5000,
    encoding: "utf8",
    maxBuffer: 64 * 1024,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

async function withParserFixture(run) {
  const app = express();
  app.use(express.json());
  app.get("/health", (_request, response) => response.json({ ok: true }));
  app.post("/echo", (request, response) => response.json(request.body));
  app.use((error, _request, response, _next) => {
    response.status(error.status || 500).json({ rejected: true });
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(base);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("compressed JSON requests retain their normal parsing behavior", async () => {
  await withParserFixture(async (base) => {
    const response = await fetch(`${base}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json", "content-encoding": "gzip" },
      body: gzipSync(Buffer.from('{"fixture":"synthetic"}')),
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { fixture: "synthetic" });
  });
});

test("trailing bytes after a compressed JSON frame do not terminate the HTTP process", async () => {
  await withParserFixture(async (base) => {
    const response = await fetch(`${base}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json", "content-encoding": "gzip" },
      body: Buffer.concat([
        gzipSync(Buffer.from('{"fixture":"synthetic"}')),
        Buffer.from("invalid-trailing-data"),
      ]),
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { rejected: true });
    const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });
  });
});
