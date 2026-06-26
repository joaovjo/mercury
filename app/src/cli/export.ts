import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { reqStr, type Flags } from "./flags.ts";

/**
 * mercury export --typ <file> --out <file.pdf>
 *
 * Shared Typst→PDF compile step. Owned here (not inside resume-tailor) so any
 * skill — resume-tailor for the resume, portal-filler for uploads — can produce
 * the real PDF file that Chrome MCP's upload_file requires.
 *
 * Requires the `typst` binary on PATH. We fail loudly with install guidance
 * rather than silently emitting nothing.
 */
export async function exportCmd(flags: Flags): Promise<void> {
  const typ = reqStr(flags, "typ");
  const out = reqStr(flags, "out");

  if (!existsSync(typ)) {
    console.error(`error: input not found: ${typ}`);
    process.exit(1);
  }

  const which = Bun.spawnSync(["sh", "-c", "command -v typst"]);
  if (which.exitCode !== 0) {
    console.error(
      "error: `typst` not found on PATH.\n" +
        "Install it: https://github.com/typst/typst#installation\n" +
        "  macOS:  brew install typst\n" +
        "  cargo:  cargo install --locked typst-cli",
    );
    process.exit(1);
  }

  mkdirSync(dirname(out), { recursive: true });

  const proc = Bun.spawnSync(["typst", "compile", typ, out], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    console.error(`error: typst compile failed:\n${proc.stderr.toString()}`);
    process.exit(1);
  }

  console.log(`exported ${out}`);
}
