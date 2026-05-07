import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import packageJson from "../package.json" with { type: "json" };
import appViteConfig from "../vite.config.js";
import sdkViteConfig from "../vite.config.sdk.js";

describe("Vercel app build configuration", () => {
  it("builds landing and dashboard as Vite entry points", () => {
    const inputs = appViteConfig.build.rollupOptions.input;

    expect(inputs.landing).toMatch(/landing[\/\\]index\.html$/);
    expect(inputs.dashboard).toMatch(/dashboard[\/\\]index\.html$/);
  });

  it("keeps the SDK library build in a dedicated Vite config", () => {
    expect(sdkViteConfig.build.emptyOutDir).toBe(false);
    expect(sdkViteConfig.build.lib.entry).toMatch(/sdk[\/\\]index\.js$/);
    expect(sdkViteConfig.build.lib.fileName("iife")).toBe("script.js");
    expect(sdkViteConfig.build.lib.fileName("es")).toBe("waas-sdk.es.js");
  });

  it("exposes separate app and SDK build scripts", () => {
    expect(packageJson.scripts.build).toBe("vite build");
    expect(packageJson.scripts["build:sdk"]).toBe("vite build --config vite.config.sdk.js");
    expect(packageJson.scripts["build:all"]).toBe("npm run build && npm run build:sdk");
  });

  it("points Vercel at the dist output and asset cache path", async () => {
    const vercelConfig = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
    const assetHeader = vercelConfig.headers.find(({ source }) => source === "/assets/(.*)");

    expect(vercelConfig.outputDirectory).toBe("dist");
    expect(assetHeader).toBeDefined();
  });

  it("loads the dashboard script as a module so Vite bundles it", async () => {
    const dashboardHtml = await readFile(new URL("../dashboard/index.html", import.meta.url), "utf8");

    expect(dashboardHtml).toContain('<script type="module" src="dashboard.js"></script>');
  });
});
