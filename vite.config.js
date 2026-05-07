import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        landing: resolve(__dirname, "landing/index.html"),
        dashboard: resolve(__dirname, "dashboard/index.html"),
      },
    },
  },
});
