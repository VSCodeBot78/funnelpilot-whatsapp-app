// Deliberately does not import the mutable app hooks/services. Even callers
// cannot supply a URL, method, headers, API key or request body.
const RESOURCES = Object.freeze({
  health: "/health",
  readiness: "/health/readiness",
  leads: "/leads",
  campaigns: "/campaigns",
  conversations: "/conversations",
  settings: "/settings-config",
  schedules: "/ghosting/schedule",
  events: "/booking-events",
});

function segment(value) {
  const text = String(value ?? "");
  if (
    !text ||
    text.length > 200 ||
    /[\u0000-\u001f/\\?#%]/.test(text) ||
    text === "." ||
    text === ".."
  )
    throw new Error("Ungültige Datensatz-ID.");
  return encodeURIComponent(text);
}

export function previewResourcePath(resource, identity) {
  if (Object.hasOwn(RESOURCES, resource)) return RESOURCES[resource];
  if (resource === "conversation" || resource === "followUp") {
    const campaign = segment(identity?.campaignId);
    const lead = segment(identity?.leadId);
    return resource === "conversation"
      ? `/conversations/${campaign}/${lead}`
      : `/ghosting/preview/${campaign}/${lead}`;
  }
  throw new Error("Dieser Zugriff ist in der Vorschau gesperrt.");
}

export async function readPreviewResource(
  resource,
  { identity, signal, fetchImpl = fetch } = {},
) {
  const path = previewResourcePath(resource, identity);
  const response = await fetchImpl(path, {
    method: "GET",
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
      : AbortSignal.timeout(10000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(`Daten nicht abrufbar (HTTP ${response.status}).`);
  const data = await response.json();
  if (!data || data.ok !== true)
    throw new Error("Keine bestätigte Backend-Antwort.");
  const lists = {
    leads: "leads",
    campaigns: "campaigns",
    conversations: "conversations",
    schedules: "schedules",
    events: "events",
  };
  if (lists[resource] && !Array.isArray(data[lists[resource]]))
    throw new Error("Das Backend hat keine gültige Liste geliefert.");
  if (
    (resource === "settings" &&
      (!data.settings ||
        typeof data.settings !== "object" ||
        Array.isArray(data.settings))) ||
    (resource === "conversation" &&
      (!data.state ||
        typeof data.state !== "object" ||
        Array.isArray(data.state)))
  )
    throw new Error("Der bestätigte Datensatz fehlt.");
  if (["conversation", "followUp"].includes(resource)) {
    const record = resource === "conversation" ? data.state : data;
    if (
      String(record.campaignId) !== String(identity?.campaignId) ||
      String(record.leadId) !== String(identity?.leadId)
    )
      throw new Error("Gesprächsidentität stimmt nicht überein.");
  }
  if (resource === "health" && data.status !== "healthy")
    throw new Error("Backend-Zustand nicht bestätigt.");
  return data;
}

export async function loadPreviewSnapshot({
  signal,
  read = readPreviewResource,
} = {}) {
  const keys = Object.keys(RESOURCES);
  const values = await Promise.allSettled(
    keys.map((key) => read(key, { signal })),
  );
  return Object.fromEntries(
    keys.map((key, index) => [
      key,
      values[index].status === "fulfilled"
        ? { data: values[index].value, error: null }
        : {
            data: null,
            error: values[index].reason?.message || "Daten fehlen.",
          },
    ]),
  );
}
