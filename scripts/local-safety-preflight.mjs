/**
 * Safety-first, read-only-or-invalid-payload checks against the three running
 * local services. This does NOT test real Meta delivery, and MUST never enable
 * sending or change persisted settings.
 *
 * Usage (Windows, from repo root, AFTER start-local has launched services):
 *   node .\scripts\local-safety-preflight.mjs
 *
 * CLI probes are deliberately hardcoded to 127.0.0.1. Never aim this script
 * at production servers or public Quick Tunnels.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateSafeReadiness } from "./local-safety-profile.mjs";
export { evaluateSafeReadiness } from "./local-safety-profile.mjs";

const LOCAL_BACKEND = "http://127.0.0.1:3001";
const LOCAL_RELAY = "http://127.0.0.1:3002";
const TIMEOUT_MS = 2500;

async function probe(fetchImpl, url, opts = {}) {
  // Reject redirects: a public redirect is never a local safety pass.
  const response = await fetchImpl(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...opts,
  });
  return response;
}

export async function runLocalSafetyPreflight({
  fetchImpl = fetch,
  backendBase = LOCAL_BACKEND,
  relayBase = LOCAL_RELAY,
} = {}) {
  const checks = [];
  const add = (label, passed, detail) => checks.push({
    label,
    passed: Boolean(passed),
    detail: passed ? undefined : detail,
  });
  try {
    const response = await probe(fetchImpl, backendBase + "/health/readiness");
    if (response.status !== 200) {
      add("Backend Readiness", false,
        "HTTP " + response.status + " statt 200; unbekannte Instanz oder Backend nicht bereit");
    } else {
      let body;
      try {
        body = await response.json();
      } catch {
        add("Backend Readiness", false, "Kein lesbarer JSON-Status");
      }
      if (body) {
        const violations = evaluateSafeReadiness(body);
        add("Backend Sicherheitsprofil", violations.length === 0, violations.join(" "));
      }
    }
  } catch {
    add("Backend Readiness", false, "Nicht erreichbar; Backend-Fenster und Port 3001 prüfen");
  }

  // Never use valid lead/checkout payloads. These are invalid input probes
  // whose only acceptable backend response is the disabled-route 404.
  for (const [label, endpoint] of [
    ["Generische Checkouts abgeschaltet", "/webhook/checkout"],
    ["Generische Booking-Webhooks abgeschaltet", "/booking-events/provider"],
  ]) {
    try {
      const result = await probe(fetchImpl, backendBase + endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      add(label, result.status === 404,
        "POST " + endpoint + " erwartet 404, bekam HTTP " + result.status);
    } catch {
      add(label, false, "Backend für " + endpoint + " nicht erreichbar");
    }
  }

  // A relay must block all control-plane routes even if the backend is
  // reachable. Probe with empty INVALID bodies only: no mutations.
  const relayDenied = [
    ["Relay sperrt Admin-Readiness", "GET", "/health/readiness"],
    ["Relay sperrt Lead-Daten", "GET", "/leads"],
    ["Relay sperrt Testchat", "POST", "/test-chat/message"],
    ["Relay sperrt Checkout", "POST", "/webhook/checkout"],
    ["Relay sperrt Booking ohne Signatur", "POST", "/booking-events/calendly"],
    ["Relay sperrt Konversationsverwaltung", "POST", "/conversations/ensure"],
  ];
  for (const [label, method, endpoint] of relayDenied) {
    try {
      const result = await probe(fetchImpl, relayBase + endpoint,
        method === "POST"
          ? { method, headers: { "content-type": "application/json" }, body: "{}" }
          : { method });
      add(label, result.status === 404,
        "Öffentlicher Relay-Pfad " + method + " " + endpoint +
          " darf nicht durchgereicht werden (HTTP " + result.status + ")");
    } catch {
      add(label, false, "Relay nicht erreichbar oder HTTP-Fehler");
    }
  }

  // Check that a live relay exists, not a random service returning 404 on
  // everything. Allowed Meta callbacks with no verification parameters are
  // processed by the backend and MUST reject with 403, not a success response.
  try {
    const result = await probe(fetchImpl, relayBase + "/webhooks/meta/instagram");
    add("Relay erreicht nur die geschützte Meta-Callback-Route",
      result.status === 403,
      "Unsignierter/unvollständiger Meta-Verify-GET muss HTTP 403 liefern, bekam " +
        result.status);
  } catch {
    add("Meta-Relay-Route", false, "Relay nicht erreichbar");
  }

  return { passed: checks.every(item => item.passed), checks };
}

if (process.argv[1] &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length > 2) {
    console.error("Keine Parameter zulässig. Prüfziel ist fest auf localhost 3001/3002 beschränkt.");
    process.exitCode = 2;
  } else {
    const result = await runLocalSafetyPreflight();
    console.log("==== Funnel Pilot: lokaler Sicherheits-Preflight ====");
    for (const item of result.checks) {
      console.log((item.passed ? "[OK] " : "[STOP] ") + item.label +
        (item.detail ? " – " + item.detail : ""));
    }
    if (result.passed) {
      console.log("GRÜN: ausschließlich lokale Testumgebung. NICHT live freigegeben.");
    } else {
      console.error("ROT: Kein Live-Test, keine Tunnel-Freigabe. Erst die STOP-Punkte beheben.");
      process.exitCode = 1;
    }
  }
}
