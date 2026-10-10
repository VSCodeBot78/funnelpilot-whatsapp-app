import React, { useCallback, useEffect, useRef, useState } from "react";
import { buildApiUrl } from "../services/apiBase";
import { getLocalRuntimeDiagnostics, getExternalDiagnosticLimits } from "./systemDiagnostics";

// Read-only: this component must never use endpoints that mutate settings,
// enable live Meta sends, create a test lead, or start a public tunnel.
export default function SystemStatusPanel({
  colors,
  apiBaseUrl,
  onEditConnections = () => {},
}) {
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState(null);
  const [requestError, setRequestError] = useState("");
  const pendingRequest = useRef(null);
  const diagnosis = getLocalRuntimeDiagnostics(readiness);
  const external = getExternalDiagnosticLimits();

  const refresh = useCallback(async () => {
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    setLoading(true);
    setReadiness(null);
    setRequestError("");
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(buildApiUrl("/health/readiness", apiBaseUrl), {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("Das Backend meldet HTTP " + response.status + ".");
      }
      const body = await response.json();
      if (pendingRequest.current === controller && !controller.signal.aborted) {
        setReadiness(body);
      }
    } catch (error) {
      if (pendingRequest.current === controller) {
        setRequestError(controller.signal.aborted
          ? "Der Statuscheck hat zu lange gedauert oder wurde unterbrochen."
          : error instanceof Error ? error.message : "Backend nicht erreichbar.");
      }
    } finally {
      clearTimeout(timeout);
      if (pendingRequest.current === controller) {
        pendingRequest.current = null;
        setCheckedAt(new Date());
        setLoading(false);
      }
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    refresh();
    return () => {
      pendingRequest.current?.abort();
      pendingRequest.current = null;
    };
  }, [refresh]);

  const needsAttention = diagnosis.state !== "safe";
  const summary = loading
    ? "Prüfe lokalen Serverstatus …"
    : diagnosis.headline;
  const headingColor = !loading && diagnosis.state === "blocked"
    ? colors.warning : colors.text;

  return (
    <section aria-label="Systemcheck" className="fp-system-check"
      style={{ background: colors.panel, border: `1px solid ${colors.border}` }}>
      <div className="fp-system-check-heading">
        <div>
          <h2 style={{ color: colors.text }}>Systemcheck</h2>
          <div role="status" aria-live="polite" style={{ color: headingColor, fontWeight: 700 }}>
            {summary}
          </div>
          <p style={{ color: colors.sub }}>
            {requestError
              ? requestError + " Im Backend-Fenster Fehler prüfen und erneut testen."
              : diagnosis.explanation}
          </p>
          {checkedAt && !loading && (
            <div style={{ color: colors.sub, fontSize: 11 }}>
              Zuletzt geprüft: {checkedAt.toLocaleTimeString("de-DE", {
                hour: "2-digit", minute: "2-digit",
              })}
              {" · "}Nur Statusdaten, keine Nachrichten versendet
            </div>
          )}
        </div>
        <div className="fp-system-actions">
          <button type="button" onClick={refresh} disabled={loading}
            style={{ border: `1px solid ${colors.border}`,
              background: colors.panelSoft, color: colors.text }}>
            {loading ? "Prüfe…" : "Erneut prüfen"}
          </button>
          <button type="button" onClick={onEditConnections}
            style={{ border: `1px solid ${colors.border}`,
              background: colors.panelSoft, color: colors.text }}>
            Verbindungen ansehen
          </button>
        </div>
      </div>
      <details className="fp-system-check-details" open={needsAttention && !loading ? true : undefined}>
        <summary style={{ cursor: "pointer", fontWeight: 700, color: colors.text }}>
          Prüfungen & nächste Schritte
        </summary>
        <div className="fp-system-check-rows">
          {diagnosis.checks.map(item => (
            <div key={item.id} className="fp-system-check-row"
              style={{ borderTop: `1px solid ${colors.border}` }}>
              <span aria-label={item.status === "ok" ? "geprüft" : "nicht bestätigt"}
                style={{ color: item.status === "ok" ? colors.success : colors.warning,
                  fontWeight: 800 }}>
                {item.status === "ok" ? "✓" : "!"}
              </span>
              <div>
                <strong>{item.label}</strong>
                <p style={{ color: colors.sub }}>{item.detail}</p>
                {item.nextStep && <p style={{ color: colors.text }}><b>Nächster Schritt:</b> {item.nextStep}</p>}
              </div>
            </div>
          ))}
          {external.map(item => (
            <div key={item.id} className="fp-system-check-row"
              style={{ borderTop: `1px solid ${colors.border}` }}>
              <span aria-label="separat zu prüfen" style={{ color: colors.sub }}>○</span>
              <div>
                <strong>{item.label} – separat offen</strong>
                <p style={{ color: colors.sub }}>{item.detail}</p>
                <p style={{ color: colors.text }}><b>Nächster Schritt:</b> {item.nextStep}</p>
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
