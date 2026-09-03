import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // host: true binds to 0.0.0.0 instead of just localhost, so the dev
    // server is reachable from your phone over Wi-Fi. See README for
    // testing on a real mobile device.
    host: true,
    port: 5173,
  },
});
