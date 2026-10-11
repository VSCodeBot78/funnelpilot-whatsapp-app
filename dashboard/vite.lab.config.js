import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
// Standalone, limited bundle: no dashboard, settings, lead or Meta modules.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../mobile-lab-dist", emptyOutDir: true,
    rollupOptions: { input: resolve(process.cwd(), "pete-lab.html") },
  },
});
