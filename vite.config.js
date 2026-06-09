import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    lib: {
      entry: resolve(__dirname, "sdk/index.js"),
      name: "WaaSSDK",
      formats: ["es", "umd", "iife"],
      fileName: (format) => {
        if (format === "iife") return "script.js";
        return `waas-sdk.${format}.js`;
      },
    },
    rollupOptions: {
      external: ["ethers", "viem", "wagmi", "@reown/appkit", "@reown/appkit-adapter-wagmi"],
      output: {
        globals: {
          ethers: "ethers",
          viem: "viem",
          wagmi: "wagmi",
          "@reown/appkit": "ReownAppKit",
          "@reown/appkit-adapter-wagmi": "ReownWagmiAdapter",
        },
      },
    },
  },
});
