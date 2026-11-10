/**
 * Read-only gate before exposing the owner laptop to a SHORT-LIVED Instagram
 * Cloudflare Quick Tunnel. Never starts a tunnel, changes Meta settings or sends.
 *
 * CLI: node scripts/owner-instagram-receive-preflight.mjs
 * It checks ONLY 127.0.0.1:3001 and 127.0.0.1:3002.
 * A PASS is technical local receive readiness, NEVER Meta/legal/Live approval.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";
import { evaluateSafeReadiness } from "./local-safety-profile.mjs";

const BACKEND = "http://127.0.0.1:3001";
const RELAY = "http://127.0.0.1:3002";

function result(label, passed, reason = "") {
  return { label, passed: Boolean(passed), ...(passed ? {} : { reason }) };
}

async function safeLocalGet(fetchImpl, url) {
  if (!url.startsWith(BACKEND + "/") && !url.startsWith(RELAY + "/")) {
    throw new Error("Preflight may only inspect the two local loopback ports");
  }
  return fetchImpl(url, { method: "GET", redirect: "error", signal: AbortSignal.timeout(2500) });
}

/** Testable logic; never returns a secret or prints an API token. */
export async function runOwnerInstagramReceivePreflight({ fetchImpl = fetch } = {}) {
  const checks = [];
  let backendReadiness = null;
  try {
    const response = await safeLocalGet(fetchImpl, BACKEND + "/health/readiness");
    if (response.status !== 200) {
      checks.push(result("Backend 3001 erreichbar", false, "HTTP " + response.status));
    } else {
      backendReadiness = await response.json();
      checks.push(result("Backend 3001 erreichbar",
        backendReadiness?.ok === true && backendReadiness?.status === "ready",
        "Readiness ist nicht ready"));
    }
  } catch {
    checks.push(result("Backend 3001 erreichbar", false, "Nur lokal nicht erreichbar"));
  }

  if (!backendReadiness) {
    checks.push(result("NoSend-Sicherheitsprofil", false, "Keine valide Backend-Readiness"));
    checks.push(result("Instagram Verify-Token lokal gesetzt", false, "Nicht verifizierbar"));
    checks.push(result("Instagram App-Secret lokal gesetzt", false, "Nicht verifizierbar"));
  } else {
    const issues = evaluateSafeReadiness(backendReadiness);
    checks.push(result("NoSend-Sicherheitsprofil", issues.length === 0,
      issues.length ? "NoSend-Sperre nicht vollständig aktiv" : ""));
    checks.push(result("Instagram Verify-Token lokal gesetzt",
      backendReadiness.instagramVerifyTokenConfigured === true,
      "Kein Verify-Token: Meta GET-Challenge würde scheitern"));
    checks.push(result("Instagram App-Secret lokal gesetzt",
      backendReadiness.instagramAppSecretConfigured === true,
      "Kein App-Secret: Meta HMAC-SHA256 kann nicht validiert werden"));
  }

  for (const endpoint of ["/health/readiness", "/leads", "/test-chat", "/api/settings"]) {
    try {
      const response = await safeLocalGet(fetchImpl, RELAY + endpoint);
      checks.push(result("Relay sperrt Admin " + endpoint, response.status === 404,
        "Unerwarteter HTTP-" + response.status + ": Relay niemals öffentlich stellen"));
    } catch {
      checks.push(result("Relay sperrt Admin " + endpoint, false,
        "Relay 3002 lokal nicht erreichbar"));
    }
  }

  try {
    const response = await safeLocalGet(fetchImpl, RELAY + "/webhooks/meta/instagram");
    checks.push(result("Meta GET ohne Challenge verweigert",
      response.status === 403, "Erwartet HTTP 403, erhalten " + response.status +
      "; 500 weist häufig auf fehlendes Verify-Token hin"));
  } catch {
    checks.push(result("Meta GET ohne Challenge verweigert", false,
      "Relay 3002 oder Backend nicht erreichbar"));
  }

  return {
    passed: checks.every(item => item.passed),
    checks,
    // These are ALWAYS manual gates: impossible to prove via local GET checks.
    unverifiedExternal: [
      "Meta-App-Modus und eigene IG-Testerberechtigung; eventuelle Veröffentlichung",
      "echte Meta GET-Webhook-Challenge und korrekt signierte Delivery",
      "Datenschutz, Datenlöschung und Rechtsgrundlage für Instagram-DMs",
      "ausdrücklicher Owner-GO für zeitlich begrenzten Tunnel/Callback",
      "getrenntes Owner-GO und Kostenlimit vor jeder Pete-Live-Antwort",
    ],
  };
}

if (process.argv[1] &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length > 2) {
    console.error("Keine Parameter erlaubt; prüft ausschließlich localhost 3001/3002.");
    process.exitCode = 2;
  } else {
    const report = await runOwnerInstagramReceivePreflight();
    console.log("==== Instagram-Laptop-Beta | nur technische Empfangsprüfung ====");
    for (const c of report.checks) {
      console.log((c.passed ? "[PASS] " : "[STOP] ") + c.label +
        (c.reason ? " – " + c.reason : ""));
    }
    console.log("Externe Freigaben bleiben offen:");
    for (const item of report.unverifiedExternal) console.log("  [NICHT VERIFIZIERT] " + item);
    if (report.passed) {
      console.log("LOKALER EMPFANGSVORCHECK PASS; KEINE Live-/Meta-/Legal-Freigabe.");
    } else {
      console.error("STOP: Kein Cloudflare-Tunnel und kein Meta-Callback-Write.");
      process.exitCode = 1;
    }
  }
}
