/**
 * Cross-compiles the mercury binary for every release target.
 *
 * Assumes the web assets are already built and embedded (run `bun run gen:version`,
 * `bun run build:web`, and `bun run embed` first — or just `bun run build:web`
 * via the workflow). Produces dist/mercury-<os>-<arch> plus a SHA256SUMS file.
 *
 * Usage: bun run scripts/build-targets.ts
 */
import { $ } from "bun";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const appDir = join(import.meta.dir, "..");
const distDir = join(appDir, "dist");
mkdirSync(distDir, { recursive: true });

/** Release matrix: bun --compile target -> published asset name. */
const TARGETS: Array<{ bunTarget: string; asset: string }> = [
  { bunTarget: "bun-linux-x64", asset: "mercury-linux-x64" },
  { bunTarget: "bun-linux-arm64", asset: "mercury-linux-arm64" },
  { bunTarget: "bun-darwin-x64", asset: "mercury-darwin-x64" },
  { bunTarget: "bun-darwin-arm64", asset: "mercury-darwin-arm64" },
  // Bun supports windows-x64 only (no windows-arm64). Output keeps the .exe
  // extension so Windows treats it as an executable.
  { bunTarget: "bun-windows-x64", asset: "mercury-windows-x64.exe" },
];

const entry = join(appDir, "src/cli/index.ts");
const sums: string[] = [];

for (const { bunTarget, asset } of TARGETS) {
  const out = join(distDir, asset);
  console.log(`Compiling ${asset} (${bunTarget})…`);
  await $`bun build ${entry} --compile --target=${bunTarget} --outfile ${out}`.quiet();
  const buf = readFileSync(out);
  const sha = createHash("sha256").update(buf).digest("hex");
  sums.push(`${sha}  ${asset}`);
  console.log(`  ✓ ${asset} (${(buf.length / 1e6).toFixed(0)} MB)  ${sha.slice(0, 12)}…`);
}

const sumsFile = join(distDir, "SHA256SUMS");
writeFileSync(sumsFile, sums.join("\n") + "\n");
console.log(`\nWrote ${sumsFile}`);
console.log(`Built ${TARGETS.length} target(s) into ${distDir}`);
