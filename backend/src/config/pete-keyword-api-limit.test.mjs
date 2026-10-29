import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";

// A local loopback-only HTTP regression. No real webhooks, Meta or AI.
test("Campaign POST/PUT rejects 21 unique keywords without silent truncation", async (t) => {
  const previousDataDir = process.env.DATA_DIR;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousLaptopFlag = process.env.FUNNELPILOT_LOCAL_TEST_MODE;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fp-keyword-api-"));
  process.env.DATA_DIR = dataDir;
  process.env.NODE_ENV = "test";
  delete process.env.FUNNELPILOT_LOCAL_TEST_MODE;
  const { default: campaignsRouter } = await import("../routes/campaigns.ts");
  const app = express();
  app.use(express.json());
  app.use("/campaigns", campaignsRouter);
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw Error("no local test address");
  const base = `http://127.0.0.1:${address.port}/campaigns`;
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const [name, value] of [
      ["DATA_DIR", previousDataDir],
      ["NODE_ENV", previousNodeEnv],
      ["FUNNELPILOT_LOCAL_TEST_MODE", previousLaptopFlag],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  const send = (method, body) => fetch(base + (method === "PUT" ? "/keyword-api-test" : "/"), {
    method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const getSaved = async () => {
    const response = await fetch(base + "/");
    assert.equal(response.status, 200);
    return (await response.json()).campaigns.find((c) => c.id === "keyword-api-test");
  };
  const words = Array.from({ length: 20 }, (_, i) => `KW_${String(i).padStart(2,"0")}`);
  const input = (keywords) => ({ id: "keyword-api-test", name: "Keyword API Test",
    trigger: "KEYWORD API TEST", peteCampaign: { keywords },
  });

  const overflow = await send("POST", input([...words, "KW_20"]));
  assert.equal(overflow.status, 400);
  assert.equal((await overflow.json()).error, "pete_campaign_keywords_limit_exceeded");
  assert.equal(await getSaved(), undefined, "invalid POST must not persist");

  const accepted = await send("POST", input(words));
  assert.equal(accepted.status, 200);
  assert.equal((await getSaved()).peteCampaign.keywords.length, 20);

  const rejectedPut = await send("PUT", input([...words, "KW_20"]));
  assert.equal(rejectedPut.status, 400);
  assert.equal((await getSaved()).peteCampaign.keywords.length, 20, "invalid PUT must not overwrite");

  const dup = await send("PUT", input([...words, " kw_00 "]));
  assert.equal(dup.status, 200, "duplicate must not count toward unique 20 limit");
  assert.deepEqual((await getSaved()).peteCampaign.keywords, words);

  const invalid = await send("PUT", input([...words, "not a valid keyword!"]));
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error, "invalid_pete_campaign_keywords");
  assert.deepEqual((await getSaved()).peteCampaign.keywords, words);

  const nonArray = await send("PUT", input("KETO"));
  assert.equal(nonArray.status, 400);
  assert.deepEqual((await getSaved()).peteCampaign.keywords, words);
});
