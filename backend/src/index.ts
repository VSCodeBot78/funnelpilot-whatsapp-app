import { env } from "./config/env.js";
import app from "./app.js";

// Mandatory loopback binding also in production: NGINX or another authenticated
// reverse proxy on the SAME host must terminate HTTPS and access this port.
// Never expose chat history/admin APIs directly via 0.0.0.0, a public IPv4/IPv6
// address, Cloudflare Quick Tunnel, or a container's published host port.
const listenHost = "127.0.0.1";

app.listen(env.PORT, listenHost, () => {
  console.log(`✅ Backend lokal erreichbar auf http://${listenHost}:${env.PORT}`);
  if (env.NODE_ENV === "production") {
    console.log("[security] Produktions-Adminzugriffe nur über geschütztes Reverse Proxy-Gateway.");
  }
});
