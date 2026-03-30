import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Proxy API and webhook calls to the Express backend in development
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/webhook": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
