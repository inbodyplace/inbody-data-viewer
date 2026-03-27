import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      port: 5174,
      // Proxy /api/* to the InBody API server to avoid CORS in development
      proxy: {
        "/api": {
          target:
            env.VITE_INBODY_API_BASE || "https://kr.developers.lookinbody.com",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
