import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateSafeReadiness } from "./local-safety-profile.mjs";

// CLI requests are fixed to loopback; never accept a public destination.
const BACKEND = "http://127.0.0.1:3001/health/readiness";
const DASHBOARD = "http://127.0.0.1:5173/";
const EXPECTED_DATA_DIR = path.resolve(
  fileURLToPath(new URL("../backend/data/xwing-offline", import.meta.url)),
);

export async function runXWingOfflinePreflight({ fetchImpl = fetch } = {}) {
  const failures = [];
  try {
    const response = await fetchImpl(BACKEND, {
      redirect: "manual", signal: AbortSignal.timeout(1500),
    });
    if (response.status !== 200) {
      failures.push("Backend antwortet nicht mit HTTP 200.");
    } else {
      const state = await response.json();
      failures.push(...evaluateSafeReadiness(state));
      if (path.resolve(String(state.dataDir || "")).toLowerCase() !==
          EXPECTED_DATA_DIR.toLowerCase()) {
        failures.push("Backend verwendet nicht den isolierten X-Wing-Testdatenordner.");
      }
      for (const flag of [
        "openAiApiKeyConfigured", "metaSendConfigured",
        "instagramSendConfigured", "publicBackendUrlConfigured",
        "webhookBaseUrlConfigured",
      ]) {
        if (state[flag] !== false) failures.push(flag + " muss false sein.");
      }
    }
  } catch {
    failures.push("Lokales Backend nicht erreichbar oder ungueltiger Status.");
  }
  try {
    const response = await fetchImpl(DASHBOARD, {
      redirect: "manual", signal: AbortSignal.timeout(1500),
    });
    if (response.status !== 200 ||
        !(await response.text()).includes("/src/main.jsx")) {
      failures.push("Dashboard antwortet nicht als erwartete lokale Vite-App.");
    }
  } catch {
    failures.push("Lokales Dashboard nicht erreichbar.");
  }
  return { passed: failures.length === 0, failures };
}

if (process.argv[1] && path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url))) {
  if (process.argv.length > 2) {
    console.error("Keine URL-Parameter oder fremde Hosts erlaubt.");
    process.exitCode = 2;
  } else {
    const result = await runXWingOfflinePreflight();
    if (result.passed) {
      console.log("OK: Beide lokalen Dienste mit X-Wing-Sicherheitsprofil bestaetigt.");
    } else {
      for (const issue of result.failures) console.error("[STOP] " + issue);
      process.exitCode = 1;
    }
  }
}
