import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";

const preview = new URL("../../dist-dashboard-v2-preview/", import.meta.url);
const assets = await readdir(new URL("assets/", preview));
const code = (
  await Promise.all(
    assets
      .filter((name) => name.endsWith(".js"))
      .map((name) => readFile(new URL(`assets/${name}`, preview), "utf8")),
  )
).join("\n");
assert(
  code.includes("Dashboard 2.0 ist deaktiviert."),
  "Default-off gate missing",
);
for (const token of [
  "/health/readiness",
  "Gesprächsidentität",
  "readPreviewResource",
  "/ghosting/preview/",
])
  assert(
    !code.includes(token),
    `Preview data client included in default-off build: ${token}`,
  );

const legacy = await readFile(
  new URL("../../dist/index.html", import.meta.url),
  "utf8",
);
assert(!legacy.includes("preview-v2"), "Preview linked in normal dashboard");
assert(
  !(await readdir(new URL("../../dist/", import.meta.url))).includes(
    "preview-v2.html",
  ),
  "Preview shipped in normal build",
);
console.log(
  "PASS: default-off preview contains no data client; normal dist contains no preview entry.",
);
