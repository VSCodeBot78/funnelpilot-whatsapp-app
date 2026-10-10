import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createWorkspaceIsolationSandbox,
  type SandboxMembership,
} from "../data/workspace-isolation-sandbox.js";

const memberships: SandboxMembership[] = [
  { workspaceId: "ws_elternfit", actorId: "usr_jochen01", role: "owner" },
  { workspaceId: "ws_coachbeta", actorId: "usr_coach02", role: "owner" },
  { workspaceId: "ws_elternfit", actorId: "usr_mentor03", role: "operator" },
  { workspaceId: "ws_elternfit", actorId: "usr_viewer04", role: "viewer" },
];

function createTestSandbox(t: { after(fn: () => void): void }) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "funnelpilot-workspace-"));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  return { rootDir, storage: createWorkspaceIsolationSandbox({ rootDir, memberships }) };
}

test("Phase 43: two coaches with identical lead IDs never see each other's files", t => {
  const { rootDir, storage } = createTestSandbox(t);
  const a = storage.authorizeFromTrustedMembership("usr_jochen01", "ws_elternfit");
  const b = storage.authorizeFromTrustedMembership("usr_coach02", "ws_coachbeta");

  // Old live single-coach files are deliberately never read or changed.
  const legacy = path.join(rootDir, "leads.json");
  fs.writeFileSync(legacy, JSON.stringify([{ id: "same-id", leadName: "LEGACY" }]));
  assert.equal(storage.read(a, "leads"), null);
  assert.equal(storage.read(b, "leads"), null);

  const kinds = [
    "leads", "conversations", "settings", "campaigns",
    "message-events", "booking-events", "ghosting",
  ] as const;
  for (const resource of kinds) {
    storage.write(a, resource, [{ id: "same-id", marker: "Jochen-only" }]);
    storage.write(b, resource, [{ id: "same-id", marker: "Coach-B-only" }]);
  }
  for (const resource of kinds) {
    assert.deepEqual(storage.read(a, resource), [{ id: "same-id", marker: "Jochen-only" }]);
    assert.deepEqual(storage.read(b, resource), [{ id: "same-id", marker: "Coach-B-only" }]);
  }
  assert.equal(fs.readFileSync(legacy, "utf8"),
    JSON.stringify([{ id: "same-id", leadName: "LEGACY" }]));
  assert.equal(fs.existsSync(path.join(rootDir, "workspaces", "ws_elternfit", "leads.json")), true);
  assert.equal(fs.existsSync(path.join(rootDir, "workspaces", "ws_coachbeta", "leads.json")), true);
});

test("Phase 43: cross-coach spoofing, path traversal and forged grants fail closed", t => {
  const { storage } = createTestSandbox(t);
  const a = storage.authorizeFromTrustedMembership("usr_jochen01", "ws_elternfit");
  assert.throws(() =>
    storage.authorizeFromTrustedMembership("usr_coach02", "ws_elternfit"),
    /membership_denied/);
  assert.throws(() =>
    storage.authorizeFromTrustedMembership("usr_jochen01", "ws_coachbeta"),
    /membership_denied/);
  assert.throws(() =>
    storage.authorizeFromTrustedMembership("usr_jochen01", "../ws_coachbeta"),
    /invalid_workspace_id/);
  assert.throws(() =>
    storage.authorizeFromTrustedMembership("usr_jochen01", "ws_elternfit/../../"),
    /invalid_workspace_id/);
  assert.throws(() =>
    storage.authorizeFromTrustedMembership("usr_coach02;root", "ws_coachbeta"),
    /invalid_actor_id/);
  assert.throws(() =>
    storage.read({ actorId: "usr_jochen01", workspaceId: "ws_elternfit" }, "leads"),
    /untrusted_grant/);
  assert.throws(() =>
    storage.write(a, "../leads" as "leads", { hacked: true }),
    /invalid_resource/);
  const unrelated = createWorkspaceIsolationSandbox({
    rootDir: path.resolve(os.tmpdir(), "fp-unrelated-workspace-sandbox"),
    memberships,
  });
  assert.throws(() => unrelated.read(a, "leads"), /untrusted_grant/);
});

test("Phase 43: viewer is read-only, operator cannot read provider integration metadata", t => {
  const { storage } = createTestSandbox(t);
  const owner = storage.authorizeFromTrustedMembership("usr_jochen01", "ws_elternfit");
  const operator = storage.authorizeFromTrustedMembership("usr_mentor03", "ws_elternfit");
  const viewer = storage.authorizeFromTrustedMembership("usr_viewer04", "ws_elternfit");
  storage.write(owner, "leads", [{ id: "synthetic-lead" }]);
  assert.deepEqual(storage.read(viewer, "leads"), [{ id: "synthetic-lead" }]);
  assert.throws(() => storage.write(viewer, "leads", []), /read_only/);
  storage.write(operator, "leads", [{ id: "operator-synthetic-lead" }]);
  assert.deepEqual(storage.read(owner, "leads"), [{ id: "operator-synthetic-lead" }]);
  storage.write(owner, "integration-metadata", { connected: false });
  assert.throws(() => storage.read(viewer, "integration-metadata"), /owner_required/);
  assert.throws(() => storage.read(operator, "integration-metadata"), /owner_required/);
  assert.throws(() => storage.write(operator, "integration-metadata", {}), /owner_required/);
});

test("Phase 43: unknown/corrupt files fail closed and cannot silently reset a coach", t => {
  const { rootDir, storage } = createTestSandbox(t);
  const a = storage.authorizeFromTrustedMembership("usr_jochen01", "ws_elternfit");
  assert.equal(storage.read(a, "conversations"), null);
  const target = path.join(rootDir, "workspaces", "ws_elternfit", "conversations.json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, "{invalid", "utf8");
  assert.throws(() => storage.read(a, "conversations"), SyntaxError);
  assert.equal(fs.readFileSync(target, "utf8"), "{invalid");
  assert.throws(() => createWorkspaceIsolationSandbox({
    rootDir, memberships: [
      memberships[0], memberships[0],
    ],
  }), /duplicate_membership/);
  assert.throws(() => createWorkspaceIsolationSandbox({
    rootDir: "../relative", memberships,
  }), /requires_absolute_root/);
});

test("Phase 43: reject symlink-based workspace hopping when supported", t => {
  if (process.platform === "win32") return;
  const { rootDir, storage } = createTestSandbox(t);
  const a = storage.authorizeFromTrustedMembership("usr_jochen01", "ws_elternfit");
  const otherDir = path.join(rootDir, "unrelated");
  fs.mkdirSync(otherDir);
  const workspaces = path.join(rootDir, "workspaces");
  fs.mkdirSync(workspaces);
  fs.symlinkSync(otherDir, path.join(workspaces, "ws_elternfit"), "dir");
  assert.throws(() => storage.write(a, "leads", [{ marker: "illegal" }]),
    /symlink_forbidden/);
  assert.deepEqual(fs.readdirSync(otherDir), []);
});
