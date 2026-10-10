import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  DAILY_NAV, ADMIN_NAV, ALL_NAV, isAdminSection,
  getSectionLabel, getWorkSummary,
} from "./dashboardNavigation.js";

const src = path.dirname(fileURLToPath(import.meta.url));
const read = relative => fs.readFileSync(path.resolve(src, relative), "utf8");

test("Primary navigation focuses daily tasks while every original module remains available", () => {
  const keys = ALL_NAV.map(item => item.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(new Set(keys), new Set([
    "dashboard", "inbox", "leads", "appointments", "ghosting",
    "campaigns", "settings", "onboarding", "coach-draft", "booking-events",
  ]));
  assert.deepEqual(DAILY_NAV.slice(0, 4).map(item => item.key),
    ["dashboard", "inbox", "leads", "appointments"]);
  assert.equal(ADMIN_NAV.some(item => item.key === "booking-events"), true);
  assert.equal(isAdminSection("booking-events"), true);
  assert.equal(isAdminSection("inbox"), false);
  assert.equal(getSectionLabel("booking-events"), "Buchungsprotokoll");
});

test("Work overview counts only stored lead flags; never invents unread or pending replies", () => {
  const summary = getWorkSummary([
    { readiness: "hot", tags: ["Gespräch läuft"], booked: false },
    { readiness: "warm", tags: ["Heißer Lead"], booked: true },
    { readiness: "cold", tags: ["Gespräch läuft"], booked: false },
    { readiness: "hot", tags: ["Heißer Lead"], excluded: true, booked: true },
    { readiness: "hot", tags: [], isDraft: true, booked: true },
    { readiness: "cold", tags: [], booked: false },
  ]);
  assert.deepEqual(summary, { total: 4, hot: 2, running: 2, booked: 1 });
  assert.deepEqual(getWorkSummary([]), { total: 0, hot: 0, running: 0, booked: 0 });
});

test("Simplified workspace preserves explicit testchat access and hidden admin tools", () => {
  const app = read("../App.jsx");
  const dashboard = read("../App.dashboard.jsx");
  const sidebar = read("../components/layout/Sidebar.jsx");
  const home = read("../dashboard/DashboardHome.jsx");
  assert.match(app, /<AppDashboard onOpenTestChat=/);
  assert.match(app, /<ChatTest \/>/);
  assert.doesNotMatch(app, /Aktive Ansicht/);
  assert.match(dashboard, /onOpenTestChat=\{onOpenTestChat\}/);
  assert.match(sidebar, /aria-expanded=\{advancedOpen\}/);
  assert.match(sidebar, /ADMIN_NAV\.map\(navButton\)/);
  assert.match(sidebar, /Pete testen/);
  assert.match(home, /onOpenInbox/);
  assert.match(home, /onOpenLeads/);
  assert.match(home, /<details className="fp-home-setup"/);
});

test("Mobile Inbox stacks panels and offline backend displays no dummy pipeline", () => {
  const css = read("../workspace.css");
  const inbox = read("../inbox/InboxView.jsx");
  const leads = read("../hooks/useLeads.js");
  assert.match(css, /@media \(max-width: 850px\)/);
  assert.match(css, /\.fp-inbox-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(inbox, /className="fp-inbox-grid"/);
  assert.match(inbox, /className="fp-inbox-chat-column"/);
  assert.match(leads, /const fallbackContacts = \[\];/);
  assert.doesNotMatch(leads, /Dummy Lea/);
});
