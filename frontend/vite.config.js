import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  server: {
    port: 5173,
    proxy: {
      "/api": process.env.VITE_BACKEND_TARGET || "http://localhost:8080",
    },
  },
});
