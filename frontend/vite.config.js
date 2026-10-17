import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  // GitHub Pages（https://<owner>.github.io/<repo>/）で配信する場合は VITE_BASE_PATH=/<repo>/ でビルドする
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    port: 5173,
    proxy: {
      "/api": process.env.VITE_BACKEND_TARGET || "http://localhost:8080",
    },
  },
});
