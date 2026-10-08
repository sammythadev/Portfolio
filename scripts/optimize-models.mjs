#!/usr/bin/env node
/**
 * Builds the optimized GLB that the 3D inspection stage renders.
 *
 *   assets/models/desktop-computer-pack.glb  ->  public/models/workstation.glb
 *
 * The source asset is a CC-BY Sketchfab export that is 12.2 MB, of which
 * ~11.5 MB is textures — a single 4096x4096 PNG alone accounts for 8.7 MB —
 * while the geometry is only ~2.5k triangles (40 KB). Every optimization that
 * matters here is therefore texture work, not mesh work.
 *
 * Pipeline (order matters):
 *   optimize --compress meshopt        lossless geometry compression, only
 *                                      worthwhile after reorder/prune/weld
 *   --texture-compress webp            keeps full GPU decode, drops ~50x of the
 *                                      bytes vs PNG; supported by GLTFLoader
 *                                      through EXT_texture_webp
 *   --texture-size 2048                caps only the oversized 4096 map
 *   --flatten/--join/--palette false   preserve the authored node graph, names
 *                                      and draw calls; the scene is tiny
 *   --simplify false                   never degrade an already low-poly mesh
 *
 * Runtime notes for whatever loads the result:
 *   - requires the meshopt decoder (`three/examples/jsm/libs/meshopt_decoder.module.js`)
 *   - requires EXT_texture_webp support (Chrome 95+, Safari 16.4+, Firefox 100+)
 *   - KHR_materials_specular and KHR_mesh_quantization are non-required extras
 *     that GLTFLoader understands natively
 *
 * Usage:
 *   node scripts/optimize-models.mjs                 # 2048px texture cap
 *   node scripts/optimize-models.mjs --texture-size 1024
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "assets", "models", "desktop-computer-pack.glb");
const OUT = join(ROOT, "public", "models", "workstation.glb");
const OUT_DIR = dirname(OUT);

/** Pinned so repeat runs produce the same asset. */
const CLI = "@gltf-transform/cli@4.5.1";

const argv = process.argv.slice(2);
if (argv.includes("-h") || argv.includes("--help")) {
  console.log("usage: node scripts/optimize-models.mjs [--texture-size <px>]");
  process.exit(0);
}

const sizeFlag = argv.indexOf("--texture-size");
const textureSize = Number(
  sizeFlag !== -1 ? argv[sizeFlag + 1] : (process.env.MODEL_TEXTURE_SIZE ?? 2048),
);

if (!Number.isFinite(textureSize) || textureSize <= 0) {
  console.error(`invalid texture size: ${textureSize}`);
  process.exit(1);
}

if (!existsSync(SRC)) {
  console.error(`missing source model: ${SRC}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const mb = (file) => (statSync(file).size / 1024 / 1024).toFixed(2);
const before = statSync(SRC).size;

console.log(`optimizing ${SRC}`);
console.log(`  texture cap: ${textureSize}px`);

const result = spawnSync(
  "npx",
  [
    "--yes",
    CLI,
    "optimize",
    SRC,
    OUT,
    "--compress",
    "meshopt",
    "--texture-compress",
    "webp",
    "--texture-size",
    String(textureSize),
    "--flatten",
    "false",
    "--join",
    "false",
    "--instance",
    "false",
    "--palette",
    "false",
    "--simplify",
    "false",
    "--weld",
    "true",
    "--prune",
    "true",
  ],
  {
    stdio: "inherit",
    // npm's default cache lives outside the sandbox in this environment.
    env: { ...process.env, npm_config_cache: join(ROOT, ".cache", "npm") },
  },
);

if (result.status !== 0) {
  console.error(`gltf-transform failed (exit ${result.status ?? "signal"})`);
  process.exit(result.status ?? 1);
}

if (!existsSync(OUT)) {
  console.error(`expected output was not written: ${OUT}`);
  process.exit(1);
}

const after = statSync(OUT).size;
console.log(`\n  ${mb(SRC)} MB -> ${mb(OUT)} MB (${(before / after).toFixed(0)}x smaller)`);