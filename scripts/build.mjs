#!/usr/bin/env node
/**
 * Builds an unpacked extension per browser into dist/<target>/.
 *
 *   node scripts/build.mjs            # every target
 *   node scripts/build.mjs firefox    # a single target
 *
 * The manifest is manifests/base.json deep-merged with manifests/<target>.json,
 * and its version is taken from package.json (single source of truth).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = ["firefox", "chrome"];

const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);

function merge(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : value;
  }
  return out;
}

function build(target) {
  const outDir = join(ROOT, "dist", target);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(join(ROOT, "src"), outDir, { recursive: true });

  const { version } = readJson("package.json");
  const manifest = merge(readJson("manifests/base.json"), readJson(`manifests/${target}.json`));
  // Keep the conventional key order at the top of the generated manifest.
  const ordered = { manifest_version: manifest.manifest_version, name: manifest.name, version, ...manifest };
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(ordered, null, 2)}\n`);

  console.log(`✔ ${target.padEnd(8)} → dist/${target} (v${version})`);
}

const requested = process.argv.slice(2);
const unknown = requested.filter((t) => !TARGETS.includes(t));
if (unknown.length) {
  console.error(`Unknown target(s): ${unknown.join(", ")}. Available: ${TARGETS.join(", ")}`);
  process.exit(1);
}
if (!existsSync(join(ROOT, "src"))) {
  console.error("src/ directory not found");
  process.exit(1);
}
(requested.length ? requested : TARGETS).forEach(build);
