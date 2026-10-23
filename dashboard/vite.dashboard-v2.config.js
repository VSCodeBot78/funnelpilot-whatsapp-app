import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Explicit, separate entry inside the existing React project. The normal
// index.html, dist, Pete lab build and laptop launchers are not changed.
export default defineConfig({
  plugins: [
    {
      name: "dashboard-v2-read-only-proxy",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const path = String(request.url || "").split("?")[0];
          const api =
            /^\/(health|leads|campaigns|conversations|settings-config|ghosting|booking-events)(\/|$)/.test(
              path,
            );
          if (!api) return next();
          const safe =
            /^\/(health(?:\/readiness)?|leads|campaigns|conversations|settings-config|ghosting\/schedule|booking-events)$/.test(
              path,
            ) ||
            /^\/(?:conversations|ghosting\/preview)\/[^/]+\/[^/]+$/.test(path);
          if (
            process.env.FUNNELPILOT_DASHBOARD_V2_PREVIEW !== "1" ||
            request.method !== "GET" ||
            !safe
          ) {
            response.statusCode = 403;
            response.setHeader("Content-Type", "application/json");
            return response.end(
              JSON.stringify({ ok: false, error: "dashboard_v2_read_only" }),
            );
          }
          next();
        });
      },
    },
    react(),
  ],
  define: {
    __DASHBOARD_V2_PREVIEW__: JSON.stringify(
      process.env.FUNNELPILOT_DASHBOARD_V2_PREVIEW === "1",
    ),
  },
  server: {
    host: "127.0.0.1",
    port: 5175,
    strictPort: true,
    // No external API base URL, credentials, OAuth or provider proxy.
    proxy: Object.fromEntries(
      [
        "/health",
        "/leads",
        "/campaigns",
        "/conversations",
        "/settings-config",
        "/ghosting",
        "/booking-events",
      ].map((path) => [path, "http://127.0.0.1:3001"]),
    ),
  },
  preview: { host: "127.0.0.1", port: 5175, strictPort: true },
  build: {
    outDir: "dist-dashboard-v2-preview",
    rollupOptions: {
      input: fileURLToPath(new URL("./preview-v2.html", import.meta.url)),
    },
  },
});
