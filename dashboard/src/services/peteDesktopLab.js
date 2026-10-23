// Same-origin local Vite proxy only. No key, session ID or CSRF token is
// written to browser storage, debug state or a user-selectable backend URL.
export function createPeteDesktopClient(fetcher = (...args) => fetch(...args)) {
  let session;
  async function ensureSession() {
    session ??= fetcher("/test-chat/desktop/session", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Pete-Desktop": "1" },
      body: "{}",
    }).then(async response => {
      const body = await response.json();
      if (!response.ok || !body.ok || !/^[a-f0-9]{64}$/.test(body.csrfToken))
        throw Error("Sicherer lokaler Pete-Labormodus nicht erreichbar.");
      return body.csrfToken;
    }).catch(error => { session = undefined; throw error; });
    return session;
  }
  async function request(method, route, body) {
    const csrf = await ensureSession();
    const response = await fetcher("/test-chat/desktop/" + route, {
      method, credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Pete-Desktop": "1", "X-Pete-CSRF": csrf },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || "Pete-Labor nicht erreichbar.");
      error.budget = data.budget;
      throw error;
    }
    return data;
  }
  return {
    // Same-origin GET does not carry a browser Origin header. Use guarded
    // read-only POSTs so the browser supplies Origin without weakening auth.
    status: () => request("POST", "status", {}),
    newLead: () => request("POST", "lead", {}),
    entry: (keyword, source) => request("POST", "entry", { keyword, source }),
    state: leadId => request("POST", "state/" + encodeURIComponent(leadId), {}),
    message: (leadId, campaignId, messageText) => request("POST", "message", { leadId, campaignId, messageText }),
    setBudget: (enabled, budgetUsd) => request("POST", "budget", enabled
      ? { enabled, budgetUsd, ownerManagedCosts: true } : { enabled }),
  };
}

export function desktopBlockReason(status) {
  if (!status) return "Status noch nicht geprüft.";
  if (status.error) return status.error;
  if (!status.budget?.ok) return "Budget-Ledger oder lokaler Sicherheitsmodus nicht verfügbar. KI gesperrt.";
  if (status.budget.blockReason && status.budget.blockReason !== "historical_spend_unverified")
    return status.budget.blockReason === "project_budget_exhausted"
      ? "Die bekannte Projektbudgetgrenze ist erreicht. KI gesperrt."
      : "Die Verbrauchsabrechnung ist nicht verfügbar. KI gesperrt.";
  if (!status.budget.historyVerified && !status.budget.ownerManagedCosts && !status.budget.ownerManagedApprovalAvailable)
    return "Frühere Laptop-Ausgaben und Kostenbelege sind nicht vollständig abgeglichen. KI gesperrt.";
  if (!status.providerConfigured) return "Im lokalen Backend fehlt OPENAI_API_KEY. Bitte in der lokalen backend/.env hinterlegen und das Backend neu starten.";
  return null;
}

export function formatDesktopUsd(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(6) + " USD" : "Nicht belegt";
}
