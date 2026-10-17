import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const allowedTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
const securityHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy": [
    "default-src 'none'", "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data:",
    "font-src 'self'", "connect-src 'none'",
    "frame-ancestors 'none'", "base-uri 'none'",
    "form-action 'none'", "object-src 'none'",
  ].join("; "),
};

function authorized(req, user, pass) {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Basic ")) return false;
  const raw = header.slice(6).trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw) || raw.length > 4096) return false;
  const value = Buffer.from(raw, "base64");
  const expected = Buffer.from(`${user}:${pass}`, "utf8");
  return value.length === expected.length && timingSafeEqual(value, expected);
}

export function createPreviewServer({ rootDir = path.join(here, "preview-dist"),
  username, password }) {
  if (typeof username !== "string" || username.length < 2 ||
      typeof password !== "string" || password.length < 20) {
    throw new Error("preview_credentials_not_configured");
  }

  return http.createServer((req, res) => {
    for (const [key, value] of Object.entries(securityHeaders)) res.setHeader(key, value);
    if (req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }
    if (!authorized(req, username, password)) {
      res.writeHead(401, {
        "Content-Type": "text/plain; charset=utf-8",
        "WWW-Authenticate": 'Basic realm="Funnel Pilot Mobile Dashboard Preview", charset="UTF-8"',
      });
      res.end("Anmeldung erforderlich");
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }); res.end(); return;
    }
    let route;
    try { route = new URL(req.url || "/", "http://localhost").pathname; }
    catch { res.writeHead(400); res.end(); return; }

    // Explicit allowlist: no backend routes, dotfiles, source, path traversal.
    const asset = /^\/assets\/[a-zA-Z0-9._-]+$/.test(route);
    if (route !== "/" && route !== "/mobile-preview.html" && !asset) {
      res.writeHead(404); res.end(); return;
    }
    const file = path.join(rootDir,
      route === "/" ? "mobile-preview.html" : route.slice(1));
    const extension = path.extname(file);
    if (!Object.hasOwn(allowedTypes, extension)) {
      res.writeHead(404); res.end(); return;
    }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, {
        "Content-Type": allowedTypes[extension],
        "Content-Length": stat.size,
      });
      if (req.method === "HEAD") { res.end(); return; }
      const stream = fs.createReadStream(file);
      stream.on("error", () => res.destroy());
      stream.pipe(res);
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const server = createPreviewServer({
    username: process.env.PREVIEW_ACCESS_USER,
    password: process.env.PREVIEW_ACCESS_PASSWORD,
  });
  server.listen(port, "0.0.0.0", () => {
    console.log("Isolated mobile dashboard preview ready (Basic Auth, demo only)");
  });
}
