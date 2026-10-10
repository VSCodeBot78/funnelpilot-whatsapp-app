import fs from "node:fs";
import path from "node:path";
import { writePrivateJsonAtomic } from "./private-json-file.js";

/**
 * Phase 43: isolated *prototype* of a future workspace-aware data adapter.
 * Deliberately NOT wired to HTTP, login, webhook handlers, the current DATA_DIR
 * stores or the live Pete engine. Actor ids must ultimately come from a
 * verified server-side session and memberships from trusted persisted records.
 * Passing user-supplied identities here is NOT authentication.
 */
export type SandboxWorkspaceRole = "owner" | "operator" | "viewer";
export type SandboxWorkspaceResource =
  | "settings" | "campaigns" | "leads" | "conversations"
  | "message-events" | "booking-events" | "ghosting"
  | "integration-metadata";

export type SandboxMembership = Readonly<{
  actorId: string;
  workspaceId: string;
  role: SandboxWorkspaceRole;
}>;

const RESOURCES: ReadonlySet<string> = new Set<SandboxWorkspaceResource>([
  "settings", "campaigns", "leads", "conversations", "message-events",
  "booking-events", "ghosting", "integration-metadata",
]);
const ROLES: ReadonlySet<string> = new Set<SandboxWorkspaceRole>([
  "owner", "operator", "viewer",
]);
const WORKSPACE_ID_PATTERN = /^ws_[a-z0-9][a-z0-9_-]{2,39}$/;
const ACTOR_ID_PATTERN = /^usr_[a-z0-9][a-z0-9_-]{2,39}$/;

function validateId(value: string, kind: "workspace" | "actor"): void {
  const matches = kind === "workspace"
    ? WORKSPACE_ID_PATTERN.test(value)
    : ACTOR_ID_PATTERN.test(value);
  if (!matches) throw new Error("workspace_sandbox_invalid_" + kind + "_id");
}

function validateResource(value: string): asserts value is SandboxWorkspaceResource {
  if (!RESOURCES.has(value)) throw new Error("workspace_sandbox_invalid_resource");
}

function lstatIfExists(file: string): fs.Stats | null {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function assertNotSymlink(file: string): void {
  if (lstatIfExists(file)?.isSymbolicLink()) {
    throw new Error("workspace_sandbox_symlink_forbidden");
  }
}

/**
 * This prototype must never become a plaintext provider credential store.
 * Only nonsensitive connection-state booleans/labels are permitted.
 */
function validateIntegrationMetadata(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("workspace_sandbox_invalid_integration_metadata");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(["provider", "connected", "lastCheckedAt"]);
  if (Object.keys(record).some(key => !allowed.has(key))) {
    throw new Error("workspace_sandbox_integration_secrets_forbidden");
  }
  if (record.provider !== undefined &&
    !["instagram", "whatsapp", "calendly", "google_calendar", "hubspot"]
      .includes(String(record.provider))) {
    throw new Error("workspace_sandbox_invalid_integration_metadata");
  }
  if (record.connected !== undefined && typeof record.connected !== "boolean") {
    throw new Error("workspace_sandbox_invalid_integration_metadata");
  }
  if (record.lastCheckedAt !== undefined &&
      (typeof record.lastCheckedAt !== "string" ||
       Number.isNaN(Date.parse(record.lastCheckedAt)) ||
       record.lastCheckedAt.length > 40)) {
    throw new Error("workspace_sandbox_invalid_integration_metadata");
  }
}

type Grant = Readonly<{ workspaceId: string; actorId: string }>;

export function createWorkspaceIsolationSandbox(input: {
  rootDir: string;
  // Trusted memberships, NEVER read from request headers/query/body.
  memberships: ReadonlyArray<SandboxMembership>;
}) {
  if (!path.isAbsolute(input.rootDir)) {
    throw new Error("workspace_sandbox_requires_absolute_root");
  }
  const rootDir = path.resolve(input.rootDir);
  const workspaceRoot = path.join(rootDir, "workspaces");
  const members = new Map<string, SandboxWorkspaceRole>();
  const grants = new WeakSet<object>();

  for (const member of input.memberships) {
    validateId(member.workspaceId, "workspace");
    validateId(member.actorId, "actor");
    if (!ROLES.has(member.role)) throw new Error("workspace_sandbox_invalid_role");
    const key = member.workspaceId + "::" + member.actorId;
    if (members.has(key)) throw new Error("workspace_sandbox_duplicate_membership");
    members.set(key, member.role);
  }

  function roleFor(grant: Grant): SandboxWorkspaceRole {
    if (!grant || typeof grant !== "object" || !grants.has(grant)) {
      throw new Error("workspace_sandbox_untrusted_grant");
    }
    const role = members.get(grant.workspaceId + "::" + grant.actorId);
    if (!role) throw new Error("workspace_sandbox_membership_denied");
    return role;
  }

  function requirePermission(
    grant: Grant,
    resource: SandboxWorkspaceResource,
    action: "read" | "write",
  ): void {
    validateResource(resource);
    const role = roleFor(grant);
    if (resource === "integration-metadata" && role !== "owner") {
      throw new Error("workspace_sandbox_owner_required");
    }
    if (action === "write" && role === "viewer") {
      throw new Error("workspace_sandbox_read_only");
    }
  }

  function checkedPath(grant: Grant, resource: SandboxWorkspaceResource): string {
    // The only path components are a validated ID and a literal resource.
    // No caller-provided filesystem path or cross-workspace fallback.
    const targetDir = path.join(workspaceRoot, grant.workspaceId);
    const destination = path.join(targetDir, resource + ".json");
    assertNotSymlink(rootDir);
    assertNotSymlink(workspaceRoot);
    assertNotSymlink(targetDir);
    assertNotSymlink(destination);
    return destination;
  }

  return {
    authorizeFromTrustedMembership(actorId: string, workspaceId: string): Grant {
      validateId(actorId, "actor");
      validateId(workspaceId, "workspace");
      if (!members.has(workspaceId + "::" + actorId)) {
        throw new Error("workspace_sandbox_membership_denied");
      }
      const grant: Grant = Object.freeze({ actorId, workspaceId });
      grants.add(grant);
      return grant;
    },
    read(grant: Grant, resource: SandboxWorkspaceResource): unknown | null {
      requirePermission(grant, resource, "read");
      const destination = checkedPath(grant, resource);
      if (!lstatIfExists(destination)) return null;
      // Invalid/corrupt JSON must be an explicit error, NEVER fall back to the
      // main single-coach files or an empty demo data set.
      return JSON.parse(fs.readFileSync(destination, "utf8")) as unknown;
    },
    write(grant: Grant, resource: SandboxWorkspaceResource, value: unknown): void {
      requirePermission(grant, resource, "write");
      if (resource === "integration-metadata") validateIntegrationMetadata(value);
      const destination = checkedPath(grant, resource);
      // No symlink traversal for existing workspace path components.
      fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
      checkedPath(grant, resource);
      writePrivateJsonAtomic(destination, value);
    },
  };
}
