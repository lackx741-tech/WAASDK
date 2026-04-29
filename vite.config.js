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
      external: ["ethers", "viem", "wagmi", "@web3modal/wagmi"],
      output: {
        globals: {
          ethers: "ethers",
          viem: "viem",
          wagmi: "wagmi",
          "@web3modal/wagmi": "Web3Modal",
        },
      },
    },
  },
});
