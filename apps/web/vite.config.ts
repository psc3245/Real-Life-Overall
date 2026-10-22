import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // `wrangler dev` serves the API (under /api) on 8787. Proxying keeps one origin, so the
    // auth session cookie is first-party, matching production where one Worker serves both.
    proxy: {
      "/api": { target: process.env.API_PROXY_TARGET ?? "http://localhost:8787" },
    },
  },
});
