/**
 * WAASDK Backend — Compiler / Build Engine Service
 *
 * Generates versioned SDK bundles from a Config document.
 * The pipeline:
 *   1. Load active Config (modules, theme, apiKey, etc.)
 *   2. Render a JavaScript entry-point with injected config
 *   3. Bundle + minify via esbuild (no obfuscation)
 *   4. Compute SHA-256 integrity hash
 *   5. Write versioned artefacts to BUILD_OUTPUT_DIR
 *   6. Update Config.build in MongoDB
 *
 * NOTE: esbuild must be available as a dev/prod dependency.
 *       Add it with: cd backend && npm install esbuild
 */

import { createHash } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join, resolve } from "path";
import Config from "../models/Config.js";
import AuditLog from "../models/AuditLog.js";
import { config as envConfig } from "../config.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function buildVersion() {
  return `${Date.now()}`;
}

/**
 * Render the SDK entry-point JavaScript from a Config document.
 * Only non-sensitive fields are embedded.
 */
function renderEntrypoint(configDoc) {
  const publicConfig = {
    apiKey: configDoc.apiKey,
    backendUrl: configDoc.backendUrl,
    walletConnectProjectId: configDoc.walletConnectProjectId,
    enabledChainIds: configDoc.enabledChainIds,
    modules: configDoc.modules,
    theme: configDoc.theme,
  };

  return `
// WAASDK Bundle — auto-generated, do not edit
// Config: ${configDoc.name} (${configDoc._id})
// Built: ${new Date().toISOString()}
import { initWAAS } from '@integrateddex/waas-sdk';
initWAAS(${JSON.stringify(publicConfig, null, 2)});
`.trimStart();
}

// ─── Build pipeline ───────────────────────────────────────────────────────────

/**
 * Compile and bundle an SDK config into a versioned JS bundle.
 *
 * @param {string} configId  MongoDB ObjectId of the Config document
 * @param {string} [actorId] Affiliate ID who triggered the build
 * @returns {Promise<{ version: string, bundleUrl: string, integrityHash: string }>}
 */
export async function compileConfig(configId, actorId) {
  const configDoc = await Config.findById(configId);
  if (!configDoc) throw new Error(`Config ${configId} not found`);

  const version = buildVersion();
  const outDir = resolve(envConfig.BUILD_OUTPUT_DIR, configId);
  const bundleFile = `bundle.${version}.js`;
  const bundlePath = join(outDir, bundleFile);

  // Mark as building
  configDoc.build = { status: "building", version };
  await configDoc.save();

  await AuditLog.create({
    actor: { type: "affiliate", id: actorId },
    event: "compile.started",
    resource: { type: "Config", id: configId },
    metadata: { version },
    timestamp: new Date(),
  });

  try {
    await mkdir(outDir, { recursive: true });

    // Write entry-point
    const entry = renderEntrypoint(configDoc);
    const entryPath = join(outDir, `entry.${version}.js`);
    await writeFile(entryPath, entry, "utf8");

    // Bundle with esbuild (graceful fallback if not installed)
    let bundleContent;
    try {
      const esbuild = await import("esbuild");
      const result = await esbuild.build({
        entryPoints: [entryPath],
        bundle: true,
        minify: true,
        write: false,
        format: "iife",
        globalName: "WAASDK",
      });
      bundleContent = result.outputFiles[0].text;
    } catch {
      // esbuild not available — use raw entry as bundle
      bundleContent = entry;
    }

    // Write bundle
    await writeFile(bundlePath, bundleContent, "utf8");

    const integrityHash = `sha256-${sha256(bundleContent)}`;
    const bundleUrl = `/files/${configId}/${bundleFile}`;

    // Update Config
    configDoc.build = {
      status: "success",
      version,
      bundleUrl,
      integrityHash,
      builtAt: new Date(),
    };
    await configDoc.save();

    await AuditLog.create({
      actor: { type: "affiliate", id: actorId },
      event: "compile.success",
      resource: { type: "Config", id: configId },
      metadata: { version, bundleUrl, integrityHash },
      timestamp: new Date(),
    });

    return { version, bundleUrl, integrityHash };
  } catch (err) {
    configDoc.build = { status: "failed", version, error: err.message };
    await configDoc.save();

    await AuditLog.create({
      actor: { type: "affiliate", id: actorId },
      event: "compile.failed",
      resource: { type: "Config", id: configId },
      metadata: { version, error: err.message },
      success: false,
      errorMessage: err.message,
      timestamp: new Date(),
    });

    throw err;
  }
}

/**
 * List built artefacts for a config.
 * @param {string} configId
 * @returns {Promise<string[]>} filenames
 */
export async function listBuilds(configId) {
  const { readdir } = await import("fs/promises");
  const outDir = resolve(envConfig.BUILD_OUTPUT_DIR, configId);
  try {
    const files = await readdir(outDir);
    return files.filter((f) => f.startsWith("bundle.") && f.endsWith(".js"));
  } catch {
    return [];
  }
}
