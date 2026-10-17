import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Demo-only build. Live campaign API imports are replaced before bundling.
// The production dashboard Vite configuration is left untouched.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{
      find: "../services/campaignsApi",
      replacement: resolve(process.cwd(), "src/preview/offlineCampaignApi.js"),
    }],
  },
  build: {
    outDir: "preview-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(process.cwd(), "mobile-preview.html"),
    },
  },
});
