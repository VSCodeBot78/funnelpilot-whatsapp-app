import test from "node:test";
import assert from "node:assert/strict";
import {
  filterLeads,
  formatDate,
  hasBookingMark,
  joinLeads,
  leadStatus,
  ownership,
  priorityReason,
  summaryMetrics,
} from "./previewModel.js";

const raw = [
  {
    id: "a",
    name: "Ada Winter",
    campaignId: "fit",
    source: "Instagram",
    tags: ["Gespräch läuft"],
    readiness: "hot",
    booked: true,
  },
  {
    id: "b",
    name: "Ben Sommer",
    campaignId: "fit",
    source: "WhatsApp",
    phone: "+49002",
    tags: [],
  },
  {
    id: "c",
    name: "Clara Frost",
    campaignId: "reset",
    tags: ["Heißer Lead"],
    excluded: true,
  },
];
const states = [
  {
    campaignId: "eltern-vital-fit",
    leadId: "a",
    owner: "human",
    aiPaused: true,
  },
];
const leads = joinLeads(raw, states);

test("joins exact backend IDs through existing campaign aliases", () => {
  assert.equal(leads[0].backendStateConnected, true);
  assert.equal(leads[1].backendStateConnected, false);
  assert.equal(ownership(leads[0]), "Mensch · Pete pausiert");
});

test("never joins private messages by similar name or phone or duplicate IDs", () => {
  const misleading = [
    {
      ...states[0],
      leadId: "other",
      leadName: "Ada Winter",
      phone: raw[0].phone,
    },
  ];
  assert.equal(joinLeads(raw, misleading)[0].backendStateConnected, false);
  assert.equal(
    joinLeads(raw, [...states, ...states])[0].backendStateConnected,
    false,
  );
  assert.equal(
    joinLeads([{ ...raw[0], campaignId: "other" }], states)[0]
      .backendStateConnected,
    false,
  );
});

test("unknown sources and timestamps stay unknown, not Instagram or just now", () => {
  const [lead] = joinLeads([{ id: "x" }], []);
  assert.equal(lead.source, undefined);
  assert.equal(lead.lastActivityAt, undefined);
  assert.equal(leadStatus(lead).label, "Status fehlt");
  assert.equal(formatDate(undefined), "Nicht hinterlegt");
  assert.equal(formatDate("bad"), "Nicht hinterlegt");
});

test("unavailable sources yield null, a confirmed empty source yields zero", () => {
  assert.deepEqual(
    summaryMetrics([], {
      leadsAvailable: false,
      conversationsAvailable: false,
    }),
    { total: null, hot: null, human: null, running: null },
  );
  assert.deepEqual(
    summaryMetrics([], { leadsAvailable: true, conversationsAvailable: true }),
    { total: 0, hot: 0, human: 0, running: 0 },
  );
  assert.equal(
    summaryMetrics(leads, {
      leadsAvailable: true,
      conversationsAvailable: false,
    }).human,
    null,
  );
});

test("metrics use explicit saved signals and exclude excluded/draft contacts", () => {
  assert.deepEqual(
    summaryMetrics(leads, {
      leadsAvailable: true,
      conversationsAvailable: true,
    }),
    { total: 2, hot: 1, human: 1, running: 1 },
  );
  assert.equal(
    summaryMetrics([...leads, { ...leads[0], isDraft: true }], {
      leadsAvailable: true,
      conversationsAvailable: true,
    }).total,
    2,
  );
});

test("search, source, campaign and status combine without mutating stored data", () => {
  const before = JSON.stringify(leads);
  assert.equal(
    filterLeads(leads, {
      search: "ADA",
      source: "Instagram",
      campaign: "fit",
      status: "human",
    }).length,
    1,
  );
  assert.equal(
    filterLeads(leads, { search: "+49002", source: "Instagram" }).length,
    0,
  );
  assert.equal(
    filterLeads(leads, { source: "WhatsApp" })[0].name,
    "Ben Sommer",
  );
  assert.equal(JSON.stringify(leads), before);
});

test("overlapping human, booked and hot signals remain discoverable in each filter", () => {
  for (const status of ["human", "hot", "booked", "running"])
    assert.equal(filterLeads(leads, { status })[0].id, "a");
  assert.equal(filterLeads(leads, { status: "unknown" })[0].id, "b");
});

test("cancelled bookings are not shown as booked", () => {
  assert.equal(
    hasBookingMark({ booked: true, bookingData: { status: "cancelled" } }),
    false,
  );
  assert.equal(
    hasBookingMark({ booked: false, bookingData: { status: "booked" } }),
    true,
  );
});

test("paused AI is distinguished from confirmed human ownership", () => {
  const paused = {
    backendStateConnected: true,
    inboxOwner: "ai",
    inboxAiPaused: true,
  };
  assert.equal(ownership(paused), "Pete pausiert · Zuständigkeit prüfen");
  assert.equal(priorityReason(paused), "Pete-Pause im Backend bestätigt");
  assert.equal(
    ownership({ ...paused, backendStateConnected: false }),
    "Nicht bestätigt",
  );
  assert.equal(
    ownership({ ...paused, inboxAiPaused: false }),
    "Pete zugeordnet · Ausführung ungeprüft",
  );
});

test("human takeover sorts before saved lead priority, with explicit name/activity sorts", () => {
  assert.equal(filterLeads(leads)[0].id, "a");
  assert.equal(filterLeads(leads, { sort: "name" })[0].name, "Ada Winter");
  assert.equal(
    filterLeads(
      [
        { ...leads[0], lastActivityAt: 1 },
        { ...leads[1], lastActivityAt: 1000 },
      ],
      { sort: "recent" },
    )[0].id,
    "b",
  );
});
