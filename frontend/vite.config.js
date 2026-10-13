import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  server: {
    port: 5173,
    proxy: {
<<<<<<< HEAD
      "/api": "http://localhost:8080",
=======
      '/api/calorie-estimates': process.env.VITE_BACKEND_TARGET || 'http://localhost:8080',
>>>>>>> 3dd71bc16ad53b976676a283f5be393cace8c33a
    },
  },
});
