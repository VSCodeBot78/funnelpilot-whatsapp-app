import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { DEFAULT_CAMPAIGN_ID } from "../config/campaigns.js";
import { assertDesktopRuntimeSafe, getPeteDesktopBudgetStatus } from "./pete-api-budget.service.js";

const COOKIE = "fp_pete_desktop";
const TTL_MS = 8 * 60 * 60 * 1000;
type BrowserSession = { csrf: string; hash: string; origin: string; expiresAt: number; leads: Set<string> };
const sessions = new Map<string, BrowserSession>();
const requests = new WeakMap<Request, BrowserSession>();
type CallScope = { sessionHash: string; leadId: string; campaignId: string; paid: boolean };
const calls = new AsyncLocalStorage<CallScope>();

/** Local operator boundary, NOT general SaaS authentication. Do not trust
 * forwarded headers, a browser-supplied owner boolean, token or ID prefix.
 * The backend must run in verified loopback safe mode; the browser must have
 * an exact local origin, an HttpOnly session AND its separate CSRF token.
 */
function assertBrowserBoundary(req: Request): void {
  assertDesktopRuntimeSafe();
  const remote = req.socket.remoteAddress;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote ?? "") ||
      req.headers.forwarded || Object.keys(req.headers).some(h => h.startsWith("x-forwarded-")) ||
      req.get("X-Pete-Desktop") !== "1") throw Error("desktop_local_browser_required");
  const origin = req.get("Origin");
  if (!["http://127.0.0.1:5173", "http://localhost:5173"].includes(origin ?? ""))
    throw Error("desktop_origin_denied");
  const host = new URL("http://" + req.get("Host"));
  const browser = new URL(origin!);
  if (host.hostname !== browser.hostname ||
      !["5173", String(env.PORT)].includes(host.port) || host.username || host.password ||
      ![undefined, "same-origin", "same-site", "none"].includes(req.get("Sec-Fetch-Site")))
    throw Error("desktop_host_denied");
  if (req.method !== "GET" && !req.is("application/json")) throw Error("desktop_json_required");
}

function deny(res: Response): void {
  res.status(403).json({ ok: false, error: "desktop_local_session_required" });
}

function cookieValue(req: Request): string | null {
  const matches = (req.get("Cookie") ?? "").split(";").map(x => x.trim())
    .filter(x => x.startsWith(COOKIE + "="));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export function startDesktopBrowserSession(req: Request, res: Response): void {
  try {
    assertBrowserBoundary(req);
    for (const [key, session] of sessions) if (session.expiresAt <= Date.now()) sessions.delete(key);
    const existing = cookieValue(req);
    let session = existing ? sessions.get(existing) : undefined;
    if (session && session.origin !== req.get("Origin")) session = undefined;
    if (!session) {
      if (sessions.size >= 128) throw Error("desktop_session_capacity");
      const id = crypto.randomBytes(32).toString("hex");
      session = { csrf: crypto.randomBytes(32).toString("hex"),
        hash: crypto.createHash("sha256").update(id).digest("hex"),
        origin: req.get("Origin")!, expiresAt: Date.now() + TTL_MS, leads: new Set() };
      sessions.set(id, session);
      res.cookie(COOKIE, id, { httpOnly: true, sameSite: "strict", path: "/test-chat/desktop",
        maxAge: TTL_MS });
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, csrfToken: session.csrf, campaignId: DEFAULT_CAMPAIGN_ID });
  } catch { deny(res); }
}

export function guardDesktopBrowser(req: Request, res: Response, next: NextFunction): void {
  try {
    assertBrowserBoundary(req);
    const id = cookieValue(req);
    const session = id ? sessions.get(id) : undefined;
    const token = req.get("X-Pete-CSRF");
    if (!session || session.expiresAt <= Date.now() || session.origin !== req.get("Origin") ||
        typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) ||
        !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(session.csrf)))
      throw Error("desktop_csrf_denied");
    requests.set(req, session);
    res.setHeader("Cache-Control", "no-store");
    next();
  } catch { deny(res); }
}

export function desktopSessionHash(req: Request): string {
  const session = requests.get(req);
  if (!session) throw Error("desktop_session_missing");
  return session.hash;
}

export function issueDesktopLead(req: Request): string {
  const session = requests.get(req);
  if (!session || session.leads.size >= 500) throw Error("desktop_lead_capacity");
  const leadId = "lab_desktop_" + crypto.randomBytes(24).toString("hex");
  session.leads.add(leadId);
  return leadId;
}

export function assertIssuedDesktopLead(req: Request, leadId: unknown, campaignId: unknown): asserts leadId is string {
  const session = requests.get(req);
  if (!session || typeof leadId !== "string" || !session.leads.has(leadId) ||
      campaignId !== DEFAULT_CAMPAIGN_ID) throw Error("desktop_server_issued_lead_required");
}

export function desktopProviderConfigured(): boolean {
  return process.env.OPENAI_MODEL === "gpt-6.1-sol" &&
    process.env.PETE_LLM_CONVERSATION_ENABLED === "true" &&
    Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function runDesktopConversation<T>(req: Request, leadId: string, fn: () => T): T {
  assertIssuedDesktopLead(req, leadId, DEFAULT_CAMPAIGN_ID);
  const sessionHash = desktopSessionHash(req);
  const status = getPeteDesktopBudgetStatus(sessionHash);
  // OFF remains usable for explicitly labeled free scripted/rule tests.
  return calls.run({ sessionHash, leadId, campaignId: DEFAULT_CAMPAIGN_ID,
    paid: status.ok && status.enabled && desktopProviderConfigured() }, fn);
}

export function desktopCallMode(): "paid" | "offline" | null {
  const scope = calls.getStore();
  if (!scope) return null;
  const status = getPeteDesktopBudgetStatus(scope.sessionHash);
  return scope.paid && status.ok && status.enabled && desktopProviderConfigured() ? "paid" : "offline";
}

/** Scoped to the exact request and server-issued conversation, never an env
 * toggle or a persisted lead field that a webhook could replay. Rechecked by
 * the locked reservation immediately before the sole provider request.
 */
export function desktopCallSessionHash(state: { leadId: string; campaignId: string }): string | undefined {
  const scope = calls.getStore();
  if (!scope) return undefined;
  if (scope.leadId !== state.leadId || scope.campaignId !== state.campaignId || desktopCallMode() !== "paid")
    throw Error("desktop_call_not_authorized");
  return scope.sessionHash;
}
