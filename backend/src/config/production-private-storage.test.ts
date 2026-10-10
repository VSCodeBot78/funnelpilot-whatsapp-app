import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writePrivateJsonAtomic } from "../data/private-json-file.js";

test("Atomic writes leave valid readable JSON and never leave temporary files", t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "funnelpilot-atomic-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const dir = path.join(temp, "private");
  const file = path.join(dir, "conversations.json");
  for (let i = 0; i < 10; i += 1) {
    writePrivateJsonAtomic(file, { version: i, messages: ["Elternchat " + i] });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")),
      { version: i, messages: ["Elternchat " + i] });
  }
  assert.deepEqual(fs.readdirSync(dir), ["conversations.json"]);
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(dir).mode & 0o077, 0, "created data directory must be private");
    assert.equal(fs.statSync(file).mode & 0o077, 0, "replaced JSON file must be mode 0600");
  }
});

test("Serialization errors do not overwrite the previously saved JSON", t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "funnelpilot-failed-json-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const file = path.join(temp, "settings.json");
  writePrivateJsonAtomic(file, { keep: "original" });
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => writePrivateJsonAtomic(file, cyclic));
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { keep: "original" });
  assert.deepEqual(fs.readdirSync(temp), ["settings.json"]);
});

test("Storage modules use private atomic writes; production does not seed demonstration leads", () => {
  const base = path.resolve(import.meta.dirname, "../data");
  for (const name of ["store.ts", "leads.store.ts", "booking-events.store.ts", "message-events.store.ts"]) {
    const content = fs.readFileSync(path.join(base, name), "utf8");
    assert.match(content, /writePrivateJsonAtomic/);
  }
  const settings = fs.readFileSync(path.resolve(import.meta.dirname, "../services/settings-store.ts"), "utf8");
  assert.match(settings, /writePrivateJsonAtomic/);
  const leads = fs.readFileSync(path.join(base, "leads.store.ts"), "utf8");
  assert.match(leads, /env.NODE_ENV === "production"/);
  const server = fs.readFileSync(path.resolve(import.meta.dirname, "../index.ts"), "utf8");
  assert.match(server, /const listenHost = "127.0.0.1"/);
  assert.doesNotMatch(server, /0\.0\.0\.0.*listen/);
});
