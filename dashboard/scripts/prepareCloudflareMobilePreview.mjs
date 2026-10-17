import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "preview-dist");
const source = path.join(dir, "mobile-preview.html");
const target = path.join(dir, "index.html");
const html = fs.readFileSync(source, "utf8");
if (!html.includes('src="/assets/') || !html.includes('id="root"')) {
  throw new Error("invalid_isolated_preview_build");
}
if (fs.existsSync(path.join(dir, "pete-test.html"))) {
  throw new Error("legacy_lab_must_not_be_in_cloudflare_bundle");
}
const bundle = fs.readdirSync(path.join(dir, "assets"))
  .filter((name) => name.endsWith(".js"))
  .map((name) => fs.readFileSync(path.join(dir, "assets", name), "utf8"))
  .join("\n");
// A missing injection must fail locally, not fetch a live /campaigns endpoint.
if (!bundle.includes("Demo-Modus: keine Backend-Verbindung.")) {
  throw new Error("offline_api_boundary_not_bundled");
}
for (const forbidden of ["/campaigns/preview-entry", "/campaigns/preview-event",
  "/webhooks/meta/instagram", "/webhooks/meta/whatsapp"]) {
  if (bundle.includes(forbidden)) throw new Error("live_route_in_preview_bundle: " + forbidden);
}
fs.writeFileSync(target, html, "utf8");
fs.writeFileSync(path.join(dir, "_headers"), [
  "/*",
  "  Cache-Control: no-store",
  "  X-Content-Type-Options: nosniff",
  "  X-Frame-Options: DENY",
  "  X-Robots-Tag: noindex, nofollow",
  "  Referrer-Policy: no-referrer",
  "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
  "  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'",
  "",
].join("\n"), "utf8");
console.log("Cloudflare-ready static preview prepared; deploy ONLY behind configured Cloudflare Access for both the apex and preview hostnames.");
