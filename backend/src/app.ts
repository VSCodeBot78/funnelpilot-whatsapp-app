import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import availabilityConfigRouter from "./routes/availability-config.js";
import availabilityRouter from "./routes/availability.js";
import ghostingRouter from "./routes/ghosting.js";
import providerBookingRouter from "./routes/provider-booking.js";
import schedulingConfigRouter from "./routes/scheduling-config.js";
import schedulingRouter from "./routes/scheduling.js";
import campaignsRouter from "./routes/campaigns.js";
import testChatRouter from "./routes/test-chat.js";
import webhookRouter from "./routes/webhook.js";
import settingsConfigRoute from "./routes/settings-config.js";
import conversationsRouter from "./routes/conversations.js";
import ghostingConfigRouter from "./routes/ghosting-config.js";
import leadsRouter from "./routes/leads.js";
import bookingEventsRouter from "./routes/booking-events.js";
import metaWhatsappRouter from "./routes/meta-whatsapp.js";
import { env } from "./config/env.js";
import { readSettings } from "./services/settings-store.js";

const app = express();

const LOCAL_DEV_CORS_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const configuredCorsOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (env.NODE_ENV === "production" && configuredCorsOrigins.length === 0) {
  console.warn(
    "[server] CORS_ORIGIN fehlt in production. Browser-CORS wird nicht offen freigegeben.",
  );
}

function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  if (configuredCorsOrigins.length > 0) {
    return configuredCorsOrigins.includes(origin);
  }

  if (env.NODE_ENV === "production") {
    return false;
  }

  return LOCAL_DEV_CORS_ORIGINS.has(origin);
}

function isDestructiveRoute(req: Request): boolean {
  const method = req.method.toUpperCase();
  const requestPath = req.path;

  if (
    method === "POST" &&
    [
      "/leads/reset",
      "/settings-config/reset",
      "/campaigns/reset",
      "/conversations/seed",
      "/availability-config/reset",
      "/ghosting-config/reset",
    ].includes(requestPath)
  ) {
    return true;
  }

  if (method === "DELETE" && requestPath === "/conversations/seed") {
    return true;
  }

  if (
    method === "DELETE" &&
    /^\/(leads|campaigns|scheduling-config)\/[^/]+$/.test(requestPath)
  ) {
    return true;
  }

  return false;
}

function areDestructiveRoutesDisabled(): boolean {
  return env.NODE_ENV === "production" || env.DISABLE_DESTRUCTIVE_ROUTES;
}

function isConfiguredLegalUrl(value: unknown): boolean {
  const url = String(value ?? "").trim();
  return url.startsWith("http://") || url.startsWith("https://");
}

function destructiveRouteGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (areDestructiveRoutesDisabled() && isDestructiveRoute(req)) {
    res.status(403).json({
      ok: false,
      error: "destructive_route_disabled",
      message:
        "Diese destructive Route ist in production oder per DISABLE_DESTRUCTIVE_ROUTES deaktiviert.",
    });
    return;
  }

  next();
}

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedCorsOrigin(origin));
    },
  }),
);
app.use(express.json());
app.use(destructiveRouteGuard);

app.use(settingsConfigRoute);

app.get("/health", (_req, res) => {
  return res.json({
    ok: true,
    service: "funnel-pilot-backend",
    status: "healthy",
    nodeEnv: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/readiness", (_req, res) => {
  const metaSendConfigured = Boolean(
    env.META_ACCESS_TOKEN && env.META_PHONE_NUMBER_ID,
  );
  const settings = readSettings();
  const privacyPolicyUrlConfigured = isConfiguredLegalUrl(
    settings.privacyPolicyUrl,
  );
  const imprintUrlConfigured = isConfiguredLegalUrl(settings.imprintUrl);

  return res.json({
    ok: true,
    service: "funnel-pilot-backend",
    status: "ready",
    nodeEnv: env.NODE_ENV,
    whatsappSendEnabled: env.WHATSAPP_SEND_ENABLED,
    publicBackendUrlConfigured: Boolean(env.PUBLIC_BACKEND_URL),
    webhookBaseUrlConfigured: Boolean(env.WEBHOOK_BASE_URL),
    dataDir: env.DATA_DIR,
    destructiveRoutesDisabled: areDestructiveRoutesDisabled(),
    metaVerifyTokenConfigured: Boolean(env.META_VERIFY_TOKEN),
    metaSendConfigured,
    privacyPolicyUrlConfigured,
    imprintUrlConfigured,
    legalLinksReady: privacyPolicyUrlConfigured && imprintUrlConfigured,
    timestamp: new Date().toISOString(),
  });
});

app.use("/test-chat", testChatRouter);
app.use("/webhook", webhookRouter);
app.use("/scheduling", schedulingRouter);
app.use("/scheduling-config", schedulingConfigRouter);
app.use("/campaigns", campaignsRouter);
app.use("/availability", availabilityRouter);
app.use("/availability-config", availabilityConfigRouter);
app.use("/ghosting", ghostingRouter);
app.use("/provider-booking", providerBookingRouter);
app.use("/booking-events", bookingEventsRouter);
app.use("/webhooks/meta/whatsapp", metaWhatsappRouter);
app.use(conversationsRouter);
app.use(ghostingConfigRouter);
app.use(leadsRouter);

export default app;
