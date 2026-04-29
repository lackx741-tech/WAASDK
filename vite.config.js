import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    lib: {
      entry: resolve(__dirname, "sdk/index.js"),
      name: "WaaSSDK",
      fileName: (format) => `waas-sdk.${format}.js`,
      formats: ["es", "umd"],
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
