import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { extname, join, resolve, sep } from "node:path";

const COOKIE = "__Host-pete_lab";
const LOGIN_CSRF_COOKIE = "__Host-pete_lab_login_csrf";
const LOGIN_CSRF_SECONDS = 15 * 60;
const SESSION_SECONDS = 7 * 24 * 3600;
const STATIC = new Set([
  "/pete-lab.webmanifest", "/pete-lab-sw.js",
  "/pete-lab-icon-192.png", "/pete-lab-icon-512.png",
]);
const API_ROUTES = [
  ["GET", /^\/test-chat\/lab\/budget$/],
  ["GET", /^\/test-chat\/lab\/state\/lab_[A-Za-z0-9_-]{20,90}$/],
  ["POST", /^\/test-chat\/lab\/message$/],
];
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function safeEqual(a, b) {
  const hash = s => createHmac("sha256", "fp-private-lab-login").update(s).digest();
  return timingSafeEqual(hash(a), hash(b));
}
function securityHeaders() {
  return {
    "cache-control": "no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  };
}
function send(res, status, body = "", type = "text/plain; charset=utf-8", headers = {}) {
  res.writeHead(status, { ...securityHeaders(), "content-type": type, ...headers });
  res.end(body);
}
function loginPage(failed, csrfToken) {
  return '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pete Testlabor Anmeldung</title></head>'+
    '<body style="font:16px system-ui;background:#121820;color:#fff;max-width:440px;margin:48px auto;padding:24px">'+
    '<h1>Pete Testlabor</h1><p>Privates Entwicklungslabor. Keine echten Instagram-Nachrichten.</p>'+
    (failed ? '<p role="alert">Anmeldung fehlgeschlagen oder kurzzeitig gesperrt.</p>' : '')+
    '<form method="post" action="/lab-login"><input type="hidden" name="csrf_token" value="'+csrfToken+'"><label for="pwd">Testlabor-Passwort</label>'+
    '<input id="pwd" type="password" name="password" required minlength="16" autocomplete="current-password" style="display:block;width:95%;font-size:16px;padding:12px;margin:12px 0">'+
    '<button type="submit" style="font-size:16px;padding:12px">Anmelden</button></form></body></html>';
}
function tokenFor(secret) {
  const prefix = Math.floor(Date.now()/1000) + "." + randomBytes(16).toString("hex");
  const sig = createHmac("sha256", secret).update(prefix).digest("hex");
  return prefix + "." + sig;
}
function cookieValue(req, name) {
  const segment = String(req.headers.cookie || "").split(";")
    .map(x => x.trim()).find(x => x.startsWith(name + "="));
  return segment ? segment.slice(name.length + 1) : "";
}

// Signed, short-lived form-specific double-submit CSRF token. It is not a
// session and cannot substitute for the user's private lab password.
function csrfFor(secret) {
  const prefix = Math.floor(Date.now() / 1000) + "." + randomBytes(16).toString("hex");
  const signature = createHmac("sha256", secret).update("login-csrf:" + prefix).digest("hex");
  return prefix + "." + signature;
}
function validCsrf(req, supplied, secret) {
  const existing = cookieValue(req, LOGIN_CSRF_COOKIE);
  if (!/^(\\d{10})\\.([a-f0-9]{32})\\.([a-f0-9]{64})$/.test(existing) ||
      typeof supplied !== "string" || supplied.length !== existing.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(existing))) return false;
  const match = /^(\\d{10})\\.([a-f0-9]{32})\\.([a-f0-9]{64})$/.exec(existing);
  const now = Math.floor(Date.now() / 1000);
  const created = Number(match[1]);
  if (created > now + 60 || now - created > LOGIN_CSRF_SECONDS) return false;
  const expected = createHmac("sha256", secret)
    .update("login-csrf:" + match[1] + "." + match[2]).digest("hex");
  return timingSafeEqual(Buffer.from(match[3], "hex"), Buffer.from(expected, "hex"));
}
function loginForm(res, status, failed, secret, httpTest, extra = {}) {
  const token = csrfFor(secret);
  const flags = httpTest ? "" : "; Secure";
  return send(res, status, loginPage(failed, token), "text/html; charset=utf-8", {
    ...extra,
    "set-cookie": LOGIN_CSRF_COOKIE + "=" + token +
      "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + LOGIN_CSRF_SECONDS + flags,
  });
}
function hasSession(req, secret) {
  const part = String(req.headers.cookie || "").split(";").map(x=>x.trim())
    .find(x=>x.startsWith(COOKIE + "="));
  if (!part) return false;
  const token = part.slice(COOKIE.length+1);
  const m = /^(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
  if (!m) return false;
  const now = Math.floor(Date.now()/1000), created = Number(m[1]);
  if (created > now + 60 || now-created >= SESSION_SECONDS) return false;
  const sig = createHmac("sha256", secret).update(m[1]+"."+m[2]).digest("hex");
  return timingSafeEqual(Buffer.from(m[3],"hex"), Buffer.from(sig,"hex"));
}
async function bodyBounded(req) {
  let n = 0; const chunks = [];
  for await (const chunk of req) {
    n += chunk.length;
    if (n > 4096) throw Error("too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
function isAllowedStatic(urlPath) {
  return urlPath==="/pete-test" || urlPath==="/pete-test/" ||
    STATIC.has(urlPath) || /^\/assets\/[a-zA-Z0-9._-]+$/.test(urlPath);
}

export function createMobileLabGateway({
  publicOrigin, password, sessionSecret, backendIngressSecret,
  buildDir = resolve("mobile-lab-dist"),
  backendOrigin = "http://127.0.0.1:3011",
  allowHttpForTests = false,
} = {}) {
  const httpTest = allowHttpForTests && /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(publicOrigin || "");
  if (!publicOrigin || (!publicOrigin.startsWith("https://") && !httpTest))
    throw Error("lab_requires_https_origin");
  if (typeof password !== "string" || password.length < 16 ||
      typeof sessionSecret !== "string" || sessionSecret.length < 32 ||
      typeof backendIngressSecret !== "string" || backendIngressSecret.length < 32)
    throw Error("lab_secrets_missing");
  const backend = new URL(backendOrigin);
  if (backend.protocol !== "http:" || backend.hostname !== "127.0.0.1")
    throw Error("lab_backend_requires_loopback");
  const hostname = new URL(publicOrigin).host;
  const key = Buffer.from(sessionSecret);
  const loginAttempts = new Map();
  const root = resolve(buildDir);

  return createServer(async (req, res) => {
    const verb = req.method || "";
    let path;
    try { path = new URL(req.url || "/", publicOrigin).pathname; }
    catch { return send(res,400,"Ungültige URL"); }
    // Railway readiness probes may send their own Host header; /healthz has no private data.
    if (verb==="GET" && path==="/healthz")
      return send(res,200,"ok");
    if (req.headers.host !== hostname) return send(res,421,"Host gesperrt");
    // Embedded Android browsers sometimes send no Origin (or Origin: null)
    // for a normal HTML form. A signed CSRF token + matching Strict cookie
    // protects ONLY that login route. Authenticated JSON APIs still insist
    // on the exact expected Origin.
    if (verb === "POST" &&
        (req.headers["sec-fetch-site"] === "cross-site" ||
         (path === "/lab-login"
           ? Boolean(req.headers.origin && req.headers.origin !== "null" &&
               req.headers.origin !== publicOrigin)
           : req.headers.origin !== publicOrigin)))
      return send(res,403,"Ursprung gesperrt");

    if (verb==="GET" && path==="/lab-login")
      return loginForm(res,200,false,key,httpTest);

    if (verb==="POST" && path==="/lab-login") {
      const ip = req.socket.remoteAddress || "unknown";
      let item = loginAttempts.get(ip) || { start: Date.now(), fails: 0 };
      if (Date.now()-item.start >= 15*60*1000) item={ start: Date.now(), fails: 0 };
      if (item.fails >= 5)
        return loginForm(res,429,true,key,httpTest,{"retry-after":"900"});
      let raw;
      try {
        if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers["content-type"] || ""))
          throw Error("invalid_type");
        raw = await bodyBounded(req);
      } catch { return send(res,413,"Ungültige Anmeldung"); }
      const form = new URLSearchParams(raw);
      if (!validCsrf(req, form.get("csrf_token"), key))
        return loginForm(res,403,true,key,httpTest);
      const guess = form.get("password") || "";
      if (!safeEqual(guess, password)) {
        item.fails++; loginAttempts.set(ip,item);
        return loginForm(res,401,true,key,httpTest);
      }
      loginAttempts.delete(ip);
      const flags = httpTest ? "" : "; Secure";
      return send(res,303,"","text/plain; charset=utf-8",{
        location:"/pete-test",
        "set-cookie":[
          COOKIE+"="+tokenFor(key)+"; Path=/; HttpOnly; SameSite=Strict; Max-Age="+SESSION_SECONDS+flags,
          LOGIN_CSRF_COOKIE+"=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"+flags,
        ],
      });
    }
    if (!hasSession(req,key)) {
      if (path.startsWith("/test-chat/") || verb==="POST")
        return send(res,401,'{"ok":false,"error":"lab_login_required"}',"application/json; charset=utf-8");
      return send(res,303,"","text/plain; charset=utf-8",{ location:"/lab-login" });
    }
    if (verb==="POST" && path==="/lab-logout") {
      const flags = httpTest ? "" : "; Secure";
      return send(res,303,"","text/plain; charset=utf-8",{
        location:"/lab-login",
        "set-cookie":COOKIE+"=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"+flags,
      });
    }
    if (API_ROUTES.some(([v,pattern])=>v===verb && pattern.test(path))) {
      try {
        const body = verb==="POST" ? await bodyBounded(req) : undefined;
        if (verb==="POST" && !/^application\/json(?:;|$)/i.test(req.headers["content-type"]||""))
          return send(res,415,"JSON erforderlich");
        const reply = await fetch(new URL(path,backend),{
          method:verb,
          headers:{
            "x-funnelpilot-admin-ingress":backendIngressSecret,
            ...(verb==="POST" ? {"content-type":"application/json"} : {}),
          },
          body, redirect:"manual", signal:AbortSignal.timeout(65_000),
        });
        const text = await reply.text();
        if (text.length > 2_000_000) throw Error("response_too_large");
        return send(res,reply.status,text,"application/json; charset=utf-8");
      } catch {
        return send(res,503,'{"ok":false,"error":"lab_backend_unavailable"}',"application/json; charset=utf-8");
      }
    }
    if (verb!=="GET" || !isAllowedStatic(path))
      return send(res,404,"Nicht verfügbar");
    const suffix=path==="/pete-test" || path==="/pete-test/" ? "pete-lab.html" : path.slice(1);
    const file=resolve(join(root,suffix));
    if (!file.startsWith(root+sep)) return send(res,404,"Nicht verfügbar");
    try {
      const meta=await stat(file);
      if (!meta.isFile() || meta.size > 3_000_000) throw Error("not_allowed");
      const content=await readFile(file);
      return send(res,200,content,MIME[extname(file)] || "application/octet-stream");
    } catch { return send(res,404,"Nicht verfügbar"); }
  });
}
