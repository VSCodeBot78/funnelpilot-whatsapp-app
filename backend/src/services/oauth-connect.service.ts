import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";

export const OAUTH_PROVIDERS = ["google_calendar", "calendly", "hubspot"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

type Pending = {
  provider: OAuthProvider;
  createdAt: number;
  verifier: string;
  redirectUri: string;
};
type AuthRecord = {
  accessToken: string;
  refreshToken?: string;
  authorizedAt: string;
  expiresAt?: number;
  scopes?: string;
  verifiedAt?: string;
};
type ProviderConfig = {
  id: string;
  secret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  scope: string;
};
const pending = new Map<string, Pending>();
const MAX_AGE_MS = 10 * 60 * 1000;
const RECORD_FILE = path.join(env.DATA_DIR, "oauth-connections.enc.json");

function config(provider: OAuthProvider): ProviderConfig {
  const prefix = provider === "google_calendar" ? "GOOGLE" : provider.toUpperCase();
  const id = process.env[prefix + "_OAUTH_CLIENT_ID"]?.trim() || "";
  const secret = process.env[prefix + "_OAUTH_CLIENT_SECRET"]?.trim() || "";
  const redirectUri =
    process.env[prefix + "_OAUTH_REDIRECT_URI"]?.trim() ||
    (env.NODE_ENV === "production"
      ? ""
      : `http://localhost:3001/integrations/oauth/${provider}/callback`);

  const providerDetails: Record<OAuthProvider, Omit<ProviderConfig, "id" | "secret" | "redirectUri">> = {
    google_calendar: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/calendar.readonly",
    },
    calendly: {
      authorizationUrl: "https://auth.calendly.com/oauth/authorize",
      tokenUrl: "https://auth.calendly.com/oauth/token",
      scope: "users:read scheduled_events:read availability:read",
    },
    hubspot: {
      authorizationUrl: "https://app.hubspot.com/oauth/authorize",
      tokenUrl: "https://api.hubapi.com/oauth/2026-03/token",
      scope: "crm.objects.contacts.read",
    },
  };
  return { id, secret, redirectUri, ...providerDetails[provider] };
}

function getEncryptionKey(): Buffer | null {
  const value = process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim() || "";
  if (!value) return null;
  const key = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");
  return key.length === 32 ? key : null;
}

function validRedirect(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    if (parsed.username || parsed.password || parsed.hash || parsed.search) return false;
    if (parsed.protocol !== "https:" && !(env.NODE_ENV !== "production" &&
      parsed.protocol === "http:" && parsed.hostname === "localhost")) return false;
    return OAUTH_PROVIDERS.some(p => parsed.pathname === `/integrations/oauth/${p}/callback`);
  } catch {
    return false;
  }
}

function decryptRecord(text: string): Record<string, AuthRecord> {
  const key = getEncryptionKey();
  if (!key) return {};
  const envelope = JSON.parse(text) as { iv: string; tag: string; ciphertext: string };
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as Record<string, AuthRecord>;
}

function readRecords(): Record<string, AuthRecord> {
  if (!fs.existsSync(RECORD_FILE)) return {};
  try {
    return decryptRecord(fs.readFileSync(RECORD_FILE, "utf8"));
  } catch {
    // Never treat undecryptable or rotated credentials as connected.
    return {};
  }
}

function persistRecords(records: Record<string, AuthRecord>): void {
  const key = getEncryptionKey();
  if (!key) throw new Error("oauth_encryption_key_missing");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(records), "utf8"), cipher.final(),
  ]);
  const serialized = JSON.stringify({
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  });
  fs.mkdirSync(path.dirname(RECORD_FILE), { recursive: true });
  const tmp = RECORD_FILE + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, serialized, { mode: 0o600 });
  fs.renameSync(tmp, RECORD_FILE);
}

export function listConnectionStatuses() {
  const records = readRecords();
  return OAUTH_PROVIDERS.map((provider) => {
    const configured = config(provider);
    const ready = Boolean(
      configured.id && configured.secret && getEncryptionKey() && validRedirect(configured.redirectUri) &&
      (env.NODE_ENV !== "production" || /^https:\/\//.test(process.env.PUBLIC_DASHBOARD_URL?.trim() || "")) &&
      configured.redirectUri.endsWith(`/integrations/oauth/${provider}/callback`)
    );
    const record = records[provider];
    return {
      provider,
      status: !ready ? "setup_required" :
        !record ? "ready_to_connect" :
        record.expiresAt && record.expiresAt <= Date.now()
          ? "reauthorization_required"
          : record.verifiedAt ? "api_verified_no_sync"
          : "authorized_not_synced",
      authorizedAt: record?.authorizedAt || null,
      verifiedAt: record?.verifiedAt || null,
      // The token was issued by the provider. This does not establish that
      // Funnel Pilot is already synchronizing calendars or CRM contacts.
      syncActive: false,
    };
  });
}

export function createAuthorization(provider: OAuthProvider) {
  const c = config(provider);
  const status = listConnectionStatuses().find(x => x.provider === provider);
  if (status?.status === "setup_required") throw new Error("provider_setup_required");
  const state = crypto.randomBytes(32).toString("base64url");
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const now = Date.now();
  for (const [id, item] of pending) {
    if (now - item.createdAt > MAX_AGE_MS) pending.delete(id);
  }
  pending.set(state, { provider, createdAt: now, verifier, redirectUri: c.redirectUri });
  const url = new URL(c.authorizationUrl);
  url.searchParams.set("client_id", c.id);
  url.searchParams.set("redirect_uri", c.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", c.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (provider === "google_calendar") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
  }
  return { url: url.toString(), state };
}

export function consumeAuthorization(provider: OAuthProvider, state: string, cookie: string): Pending {
  const saved = pending.get(state);
  pending.delete(state);
  if (
    !saved || saved.provider !== provider || Date.now() - saved.createdAt > MAX_AGE_MS ||
    !cookie || Buffer.byteLength(cookie) !== Buffer.byteLength(state) ||
    !crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(state))
  ) throw new Error("invalid_or_expired_oauth_state");
  return saved;
}

export async function exchangeAuthorization(provider: OAuthProvider, code: string, flow: Pending): Promise<void> {
  const c = config(provider);
  if (!code || code.length > 2048) throw new Error("oauth_code_missing");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: flow.redirectUri,
    client_id: c.id,
    code_verifier: flow.verifier,
  });
  if (provider !== "calendly") body.set("client_secret", c.secret);
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (provider === "calendly") {
    headers.authorization = "Basic " + Buffer.from(c.id + ":" + c.secret).toString("base64");
  }
  const response = await fetch(c.tokenUrl, { method: "POST", headers, body, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("oauth_provider_token_exchange_failed");
  const tokens = await response.json() as Record<string, unknown>;
  if (typeof tokens.access_token !== "string" || !tokens.access_token) {
    throw new Error("oauth_access_token_missing");
  }
  const existing = readRecords();
  existing[provider] = {
    accessToken: tokens.access_token,
    refreshToken: typeof tokens.refresh_token === "string"
      ? tokens.refresh_token : undefined,
    authorizedAt: new Date().toISOString(),
    expiresAt: typeof tokens.expires_in === "number"
      ? Date.now() + tokens.expires_in * 1000 : undefined,
    scopes: typeof tokens.scope === "string" ? tokens.scope : undefined,
  };
  persistRecords(existing);
}

export async function verifyProviderConnection(provider: OAuthProvider): Promise<{
  provider: OAuthProvider;
  status: "api_verified_no_sync" | "not_authorized" | "reauthorization_required" | "provider_unreachable";
  verifiedAt?: string;
  syncActive: false;
}> {
  const records = readRecords();
  const record = records[provider];
  if (!record?.accessToken) {
    return { provider, status: "not_authorized", syncActive: false };
  }
  if (record.expiresAt && record.expiresAt <= Date.now()) {
    return { provider, status: "reauthorization_required", syncActive: false };
  }

  // Read-only probes, fixed first-party hosts, never constructed from user data.
  // We neither return nor persist contact/calendar contents.
  const probeUrls: Record<OAuthProvider, string> = {
    google_calendar: "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
    calendly: "https://api.calendly.com/users/me",
    hubspot: "https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
  };

  try {
    const response = await fetch(probeUrls[provider], {
      method: "GET",
      headers: {
        authorization: "Bearer " + record.accessToken,
        accept: "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        record.verifiedAt = undefined;
        persistRecords(records);
        return { provider, status: "reauthorization_required", syncActive: false };
      }
      return { provider, status: "provider_unreachable", syncActive: false };
    }
    // A 200 status only proves read access at this instant. No synchronization.
    record.verifiedAt = new Date().toISOString();
    persistRecords(records);
    return {
      provider, status: "api_verified_no_sync",
      verifiedAt: record.verifiedAt,
      syncActive: false,
    };
  } catch {
    return { provider, status: "provider_unreachable", syncActive: false };
  }
}

export function disconnectProvider(provider: OAuthProvider) {
  const records = readRecords();
  delete records[provider];
  if (getEncryptionKey()) persistRecords(records);
  return true;
}

export function isOAuthProvider(value: string): value is OAuthProvider {
  return OAUTH_PROVIDERS.includes(value as OAuthProvider);
}
