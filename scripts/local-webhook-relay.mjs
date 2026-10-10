// A deliberately narrow public entrypoint for local Cloudflare Quick Tunnel tests.
// Never point a public Quick Tunnel directly at the backend admin port 3001.
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateSafeReadiness } from "./local-safety-profile.mjs";

const WEBHOOK_PATHS = new Set([
  "/webhooks/meta/instagram",
  "/webhooks/meta/whatsapp",
]);

export function isAllowedLocalWebhook(method, requestTarget, { allowCalendly = false } = {}) {
  if (method !== "GET" && method !== "POST") return false;
  if (
    typeof requestTarget !== "string" ||
    !requestTarget.startsWith("/") ||
    requestTarget.startsWith("//") ||
    requestTarget.includes("\\")
  ) {
    return false;
  }

  try {
    const parsed = new URL(requestTarget, "http://127.0.0.1");
    return (
      parsed.origin === "http://127.0.0.1" &&
      (WEBHOOK_PATHS.has(parsed.pathname) ||
        (allowCalendly && method === "POST" && parsed.pathname === "/booking-events/calendly"))
    );
  } catch {
    return false;
  }
}

// Check the running backend before forwarding EVERY allowed webhook.
 // If it has crashed, restarted without the launcher lock, or changed safety
 // flags, no inbound customer message is ever forwarded by this local relay.
async function backendHasSafeLaptopLock(backendPort) {
  const response = await fetch("http://127.0.0.1:" + backendPort + "/health/readiness", {
    redirect: "error", signal: AbortSignal.timeout(1500),
  });
  if (response.status !== 200) return false;
  return evaluateSafeReadiness(await response.json()).length === 0;
}

export function createLocalWebhookRelay({
  backendPort = 3001, allowCalendly = false, requireSafeLaptopMode = true,
} = {}) {
  if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535) {
    throw new Error("Invalid backend port.");
  }

  return http.createServer(async (incoming, outgoing) => {
    if (!isAllowedLocalWebhook(incoming.method, incoming.url, { allowCalendly })) {
      incoming.resume();
      outgoing.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      outgoing.end("Not found");
      return;
    }

    if (requireSafeLaptopMode) {
      let safe = false;
      try {
        safe = await backendHasSafeLaptopLock(backendPort);
      } catch {
        // Fail closed on timeout, malformed JSON or stopped backend.
      }
      if (!safe) {
        incoming.resume();
        outgoing.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
        outgoing.end("Local safety gate closed");
        return;
      }
    }

    // Preserve the *exact* POST body for Meta's HMAC-SHA256 verification.
    // Forward to the loopback backend only, not to any client-supplied host.
    const headers = { ...incoming.headers, host: `127.0.0.1:${backendPort}` };
    delete headers["x-forwarded-host"];
    delete headers["x-forwarded-proto"];
    delete headers["x-forwarded-for"];
    delete headers["forwarded"];

    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: backendPort,
        method: incoming.method,
        path: incoming.url,
        headers,
        timeout: 30000,
      },
      (backendResponse) => {
        outgoing.writeHead(backendResponse.statusCode ?? 502, backendResponse.headers);
        backendResponse.pipe(outgoing);
      },
    );

    upstream.on("timeout", () => upstream.destroy(new Error("Backend timeout")));
    upstream.on("error", () => {
      if (!outgoing.headersSent) {
        outgoing.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      }
      outgoing.end("Local backend unavailable");
    });

    incoming.pipe(upstream);
  });
}

function getLocalPort(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${name}`);
  }
  return port;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const relayPort = getLocalPort("LOCAL_WEBHOOK_RELAY_PORT", 3002);
  const backendPort = getLocalPort("PORT", 3001);
  const allowCalendly = process.env.LOCAL_ALLOW_CALENDLY_WEBHOOK === "true";
  if (allowCalendly && process.env.CALENDLY_WEBHOOK_VERIFY_MODE !== "strict") {
    throw new Error("LOCAL_ALLOW_CALENDLY_WEBHOOK requires CALENDLY_WEBHOOK_VERIFY_MODE=strict in relay and backend.");
  }
  const server = createLocalWebhookRelay({ backendPort, allowCalendly });
  server.listen(relayPort, "127.0.0.1", () => {
    console.log(
      `[local-webhook-relay] Listening on http://127.0.0.1:${relayPort}; only Meta webhook GET/POST${allowCalendly ? " + signed Calendly POST" : ""}. Backend: 127.0.0.1:${backendPort}`,
    );
    console.log("[local-webhook-relay] Do NOT tunnel port 3001 or port 5173.");
  });
}
