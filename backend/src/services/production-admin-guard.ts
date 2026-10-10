import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

// Only these webhook/OAuth callback paths are reachable without the authenticated
// reverse proxy injecting the internal secret in production. Other API routes
// are ADMIN-ONLY. Signature validation lives in each webhook handler.
export function isProductionPublicCallback(method: string, path: string): boolean {
  const verb = method.toUpperCase();
  if (verb === "GET" && path === "/health") return true;
  if ((verb === "GET" || verb === "POST") &&
    (path === "/webhooks/meta/instagram" || path === "/webhooks/meta/whatsapp" ||
     path === "/webhooks/meta/instagram/" || path === "/webhooks/meta/whatsapp/")) return true;
  if (verb === "POST" && (path === "/booking-events/calendly" ||
      path === "/booking-events/calendly/")) return true;
  if (verb === "GET" &&
    /^\/integrations\/oauth\/(google_calendar|calendly|hubspot)\/callback\/?$/.test(path)) {
    return true;
  }
  return false;
}

export function isValidAdminIngressSecret(supplied: string | undefined, configured: string): boolean {
  // The secret is NOT a login/session. It must be injected server-side *only*
  // by a trusted, authenticated, localhost reverse proxy. Never expose it to
  // browser JavaScript, redirects or API responses.
  if (!configured || Buffer.byteLength(configured, "utf8") < 32 ||
      !supplied || Buffer.byteLength(supplied, "utf8") !== Buffer.byteLength(configured, "utf8")) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(configured));
}

export function createProductionAdminGuard({
  nodeEnv = env.NODE_ENV,
  adminSecret = process.env.FUNNELPILOT_ADMIN_INGRESS_SECRET?.trim() || "",
} = {}) {
  return function productionAdminGuard(req: Request, res: Response, next: NextFunction): void {
    if (nodeEnv !== "production") return next();
    if (isProductionPublicCallback(req.method, req.path)) return next();
    if (adminSecret.length < 32) {
      res.status(503).json({ ok: false, error: "production_admin_ingress_not_configured" });
      return;
    }
    if (!isValidAdminIngressSecret(req.get("x-funnelpilot-admin-ingress"), adminSecret)) {
      res.status(403).json({ ok: false, error: "admin_gateway_required" });
      return;
    }
    next();
  };
}
