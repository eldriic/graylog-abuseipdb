#!/usr/bin/env node
/**
 * Syntax-checks every JavaScript file under src/, scripts/ and test/ (no dependencies).
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function* jsFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* jsFiles(path);
    else if (/\.m?js$/.test(entry.name)) yield path;
  }
}

let failed = 0;
for (const dir of ["src", "scripts", "test"]) {
  for (const file of jsFiles(join(ROOT, dir))) {
    try {
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    } catch (err) {
      failed++;
      console.error(`✘ ${relative(ROOT, file)}\n${err.stderr}`);
    }
  }
}

if (failed) process.exit(1);
console.log("✔ JavaScript syntax OK");
