import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

type CalendlyWebhookVerifyMode = "off" | "dev" | "strict";
type NodeEnv = "development" | "test" | "production";

function getPort(): number {
  const rawPort = process.env.PORT?.trim();

  if (!rawPort) {
    return 3001;
  }

  const parsed = Number(rawPort);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("PORT muss eine gültige positive Zahl sein.");
  }

  return parsed;
}

function getCalendlyWebhookSecret(): string {
  return process.env.CALENDLY_WEBHOOK_SECRET?.trim() ?? "";
}

function getCalendlyWebhookVerifyMode(): CalendlyWebhookVerifyMode {
  const raw = process.env.CALENDLY_WEBHOOK_VERIFY_MODE?.trim().toLowerCase();

  if (raw === "dev" || raw === "strict") {
    return raw;
  }

  return "off";
}

function getNodeEnv(): NodeEnv {
  const raw = process.env.NODE_ENV?.trim().toLowerCase();

  if (raw === "production" || raw === "test") {
    return raw;
  }

  return "development";
}

function getOptionalEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function getBooleanEnv(name: string): boolean {
  const raw = getOptionalEnv(name).toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function getMetaGraphApiVersion(): string {
  return getOptionalEnv("META_GRAPH_API_VERSION") || "v20.0";
}

function getWhatsappSendEnabled(): boolean {
  return getBooleanEnv("WHATSAPP_SEND_ENABLED");
}

function getDataDir(): string {
  const configured = getOptionalEnv("DATA_DIR");
  if (!configured) {
    return path.join(process.cwd(), "data");
  }

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
}

export const env = {
  NODE_ENV: getNodeEnv(),
  PORT: getPort(),
  PUBLIC_BACKEND_URL: getOptionalEnv("PUBLIC_BACKEND_URL"),
  WEBHOOK_BASE_URL:
    getOptionalEnv("WEBHOOK_BASE_URL") || getOptionalEnv("PUBLIC_BACKEND_URL"),
  CORS_ORIGIN: getOptionalEnv("CORS_ORIGIN"),
  DATA_DIR: getDataDir(),
  DISABLE_DESTRUCTIVE_ROUTES: getBooleanEnv("DISABLE_DESTRUCTIVE_ROUTES"),
  CALENDLY_WEBHOOK_SECRET: getCalendlyWebhookSecret(),
  CALENDLY_WEBHOOK_VERIFY_MODE: getCalendlyWebhookVerifyMode(),
  META_VERIFY_TOKEN: getOptionalEnv("META_VERIFY_TOKEN"),
  META_ACCESS_TOKEN: getOptionalEnv("META_ACCESS_TOKEN"),
  META_PHONE_NUMBER_ID: getOptionalEnv("META_PHONE_NUMBER_ID"),
  META_WABA_ID: getOptionalEnv("META_WABA_ID"),
  META_GRAPH_API_VERSION: getMetaGraphApiVersion(),
  META_APP_SECRET: getOptionalEnv("META_APP_SECRET"),
  WHATSAPP_SEND_ENABLED: getWhatsappSendEnabled(),
};
