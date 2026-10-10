import { Router } from "express";
import {
  createAuthorization,
  consumeAuthorization,
  disconnectProvider,
  exchangeAuthorization,
  isOAuthProvider,
  listConnectionStatuses,
  verifyProviderConnection,
} from "../services/oauth-connect.service.js";
import { env } from "../config/env.js";

const router = Router();
const COOKIE_NAME = "fp_oauth_state";

function getCookie(header: string | undefined, name: string): string {
  const value = (header || "").split(";").map(part => part.trim())
    .find(part => part.startsWith(name + "="));
  return value ? value.slice(name.length + 1) : "";
}

function getDashboardUrl(): string {
  if (env.NODE_ENV !== "production") return "http://localhost:5173";
  const raw = process.env.PUBLIC_DASHBOARD_URL?.trim() || "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.origin : "";
  } catch { return ""; }
}

router.get("/status", (_req, res) => {
  return res.json({
    ok: true,
    providers: listConnectionStatuses(),
    meta: {
      instagram: { status: "requires_meta_app_setup", liveVerified: false },
      whatsapp: { status: "requires_meta_embedded_signup", liveVerified: false },
      facebook: { status: "requires_meta_app_setup", liveVerified: false },
    },
  });
});

router.get("/:provider/start", (req, res) => {
  const provider = req.params.provider;
  if (!isOAuthProvider(provider)) return res.status(404).json({ ok: false, error: "unknown_provider" });
  try {
    const { url, state } = createAuthorization(provider);
    res.cookie(COOKIE_NAME, state, {
      httpOnly: true, sameSite: "lax",
      secure: env.NODE_ENV === "production",
      maxAge: 10 * 60 * 1000,
      path: `/integrations/oauth/${provider}/callback`,
    });
    return res.redirect(302, url);
  } catch {
    return res.status(409).json({
      ok: false, error: "provider_setup_required",
      message: "OAuth-App, Callback-URL und Verschlüsselungsschlüssel zunächst serverseitig einrichten.",
    });
  }
});

router.get("/:provider/callback", async (req, res) => {
  const provider = req.params.provider;
  if (!isOAuthProvider(provider)) return res.status(404).end();
  const dashboardUrl = getDashboardUrl();
  if (!dashboardUrl) return res.status(503).send("PUBLIC_DASHBOARD_URL muss für production HTTPS sein.");
  const cookieState = getCookie(req.get("cookie"), COOKIE_NAME);
  const oauthState = typeof req.query.state === "string" ? req.query.state : "";
  const error = typeof req.query.error === "string" ? req.query.error : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  res.clearCookie(COOKIE_NAME, {
    path: `/integrations/oauth/${provider}/callback`,
    httpOnly: true, sameSite: "lax", secure: env.NODE_ENV === "production",
  });
  let result = "error";
  try {
    const pending = consumeAuthorization(provider, oauthState, cookieState);
    if (error) {
      result = "denied";
    } else {
      await exchangeAuthorization(provider, code, pending);
      result = "authorized";
    }
  } catch {
    result = "error";
  }
  // Never include authorization codes, state, access tokens or provider error text in redirect URLs.
  return res.redirect(303,
    `${dashboardUrl}/?setup=connections&provider=${encodeURIComponent(provider)}&result=${result}`
  );
});

function hasDashboardOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return env.NODE_ENV === "production"
    ? origin === getDashboardUrl()
    : ["http://localhost:5173", "http://127.0.0.1:5173"].includes(origin);
}

router.post("/:provider/verify", async (req, res) => {
  if (!hasDashboardOrigin(req.get("origin"))) {
    return res.status(403).json({ ok: false, error: "dashboard_origin_required" });
  }
  const provider = req.params.provider;
  if (!isOAuthProvider(provider)) {
    return res.status(404).json({ ok: false, error: "unknown_provider" });
  }
  const verification = await verifyProviderConnection(provider);
  return res.json({ ok: true, ...verification });
});

// An authorized provider is not a proof of active synchronization.
// Intentional server-side disconnect; NGINX must authenticate the admin routes.
router.post("/:provider/disconnect", (req, res) => {
  if (!hasDashboardOrigin(req.get("origin"))) {
    return res.status(403).json({ ok: false, error: "dashboard_origin_required" });
  }
  const provider = req.params.provider;
  if (!isOAuthProvider(provider)) return res.status(404).json({ ok: false, error: "unknown_provider" });
  disconnectProvider(provider);
  return res.json({ ok: true, disconnected: provider });
});

export default router;
