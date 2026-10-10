import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { filterInboxContacts, getInboxFilterCounts } from "./mobileInboxFilters.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const read = relative => fs.readFileSync(path.resolve(dirname, relative), "utf8");

test("Phase 42: counts use saved priority and backend ownership, never fake unread", () => {
  const leads = [
    { id: "a", readiness: "hot", tags: [], backendStateConnected: false },
    { id: "b", readiness: "warm", tags: ["Heißer Lead"], backendStateConnected: true,
      inboxOwner: "human", inboxAiPaused: true },
    { id: "c", readiness: "cold", tags: [], backendStateConnected: true, inboxOwner: "ai" },
    { id: "d", readiness: "hot", excluded: true, backendStateConnected: true,
      inboxOwner: "human" },
    { id: "e", readiness: "hot", isDraft: true },
    { id: "f", readiness: "cold", inboxOwner: "human", backendStateConnected: false },
  ];
  assert.deepEqual(getInboxFilterCounts(leads), { all: 6, hot: 2, human: 1 });
  assert.deepEqual(filterInboxContacts(leads, "hot").map(x => x.id), ["a", "b"]);
  assert.deepEqual(filterInboxContacts(leads, "human").map(x => x.id), ["b"]);
  assert.deepEqual(filterInboxContacts(leads, "all").map(x => x.id),
    ["a", "b", "c", "d", "e", "f"]);
  assert.deepEqual(getInboxFilterCounts([]), { all: 0, hot: 0, human: 0 });
});

test("Mobile Inbox shows one panel and preserves desktop columns", () => {
  const css = read("../workspace.css");
  const inbox = read("./InboxView.jsx");
  const dashboard = read("../App.dashboard.jsx");
  const leadList = read("./InboxLeadList.jsx");
  assert.match(css, /@media \(max-width: 850px\)/);
  for (const pane of ["list", "chat", "context"]) {
    assert.ok(css.includes(`data-mobile-pane="${pane}"`));
  }
  assert.match(css, /\.fp-mobile-inbox-nav \{ display: grid/);
  assert.match(inbox, /data-mobile-pane=\{mobilePane\}/);
  assert.match(inbox, /onMobilePaneChange\(key\)/);
  assert.match(dashboard, /mobileInboxPane/);
  assert.match(leadList, /getInboxFilterCounts/);
  assert.match(leadList, /aria-pressed=\{filter === key\}/);
});

test("Mobile/manual Inbox never pretends a missing backend message was sent", () => {
  const hook = read("../hooks/useInbox.js");
  const chat = read("./InboxChatPanel.jsx");
  const inbox = read("./InboxView.jsx");
  assert.match(hook, /Kein Backend-State vorhanden\. Nachricht NICHT gesendet/);
  assert.doesNotMatch(hook, /id: Date\.now\(\),\s*role: "bot"/);
  assert.match(chat, /manualInputDisabled = !activeConversation/);
  assert.match(hook, /setNewManualMessage\(""\); \}, \[activeContactId\]\)/);
  assert.match(inbox, /window\.confirm\(/);
  assert.match(chat, /STOP aktiv · Pete bleibt gesperrt/);
});
