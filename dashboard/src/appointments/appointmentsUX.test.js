import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const read = name => fs.readFileSync(path.join(dirname, name), "utf8");

test("Termine shows booked appointments, not the obsolete weekly slot editor", () => {
  const view = read("AppointmentsView.jsx");
  const shell = read("AppointmentsShell.jsx");
  const main = fs.readFileSync(path.join(dirname, "../App.dashboard.jsx"), "utf8");
  assert.doesNotMatch(view, /<AvailabilityPanel\b|import AvailabilityPanel/);
  assert.doesNotMatch(shell, /availabilityForm|onReloadAvailability|onSaveAvailability/);
  assert.doesNotMatch(main, /useAvailabilityConfig|availabilityForm|onResetAvailability/);
  assert.match(view, /Aktive Termine/);
  assert.match(view, /Stornierte \/ Historische Termine/);
  assert.match(view, /Calendly/);
});

test("Desktop Pete QA displays verified reply source and provider-use counter separately", () => {
  const chat = fs.readFileSync(path.join(dirname, "../App.chat.jsx"), "utf8");
  assert.match(chat, /Antwortquelle/);
  assert.match(chat, /debug\.replySource === "llm"/);
  assert.match(chat, /API-Anfragen gezählt/);
  assert.match(chat, /keine freie KI-Antwort/);
});
