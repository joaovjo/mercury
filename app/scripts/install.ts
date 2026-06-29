#!/usr/bin/env bun
/**
 * Mercury local dev installer — builds the single binary and links it onto your PATH.
 *
 * Usage: bun run scripts/install.ts
 *
 * Env overrides:
 *   MERCURY_BIN_DIR  where the binary is linked (default: ~/.local/bin)
 */
import { $ } from "bun";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { chmodSync } from "node:fs";

const appDir = join(import.meta.dir, "..");
const HOME = process.env.HOME ?? process.env.USERPROFILE ?? "~";
const binDir = Bun.env.MERCURY_BIN_DIR ?? join(HOME, ".local", "bin");
const IS_WINDOWS = process.platform === "win32";
const EXE = IS_WINDOWS ? ".exe" : "";

console.log("Building Mercury…");
await $`bun install`.cwd(appDir);
await $`bun run build`.cwd(appDir);

await mkdir(binDir, { recursive: true });
const src = join(appDir, "dist", `mercury${EXE}`);
const dst = join(binDir, `mercury${EXE}`);
await Bun.write(dst, Bun.file(src));
if (!IS_WINDOWS) {
  chmodSync(dst, 0o755);
}

console.log(`\n✓ Installed mercury -> ${dst}`);
const onPath = Bun.which("mercury");
if (!onPath) {
  console.log(`  Note: add ${binDir} to your PATH:`);
  if (IS_WINDOWS) {
    console.log(`    $env:Path = "${binDir};$env:Path"`);
  } else {
    console.log(`    export PATH="${binDir}:$PATH"`);
  }
}
console.log("Run: mercury init && mercury dashboard");
