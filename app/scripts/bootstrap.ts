#!/usr/bin/env bun
/**
 * Mercury remote installer — install or update in one command.
 *
 *   curl -fsSL https://raw.githubusercontent.com/joaovjo/mercury/main/app/scripts/bootstrap.ts | bun run -
 *
 * PowerShell 7.x+:
 *   irm https://raw.githubusercontent.com/joaovjo/mercury/main/app/scripts/bootstrap.ts | bun run -
 *
 * Re-run the same command any time to update to the latest version.
 *
 * By default this downloads a prebuilt binary from the latest GitHub Release
 * (fast — needs only network access). If no prebuilt binary matches your
 * platform, or you set MERCURY_FROM_SOURCE=1, it falls back to building from
 * source with Bun.
 *
 * Env overrides:
 *   MERCURY_REPO         git remote (default: https://github.com/joaovjo/mercury.git)
 *   MERCURY_REPO_SLUG    owner/name for the API (default: joaovjo/mercury)
 *   MERCURY_REF          branch/tag/sha for source builds (default: main)
 *   MERCURY_VERSION      release tag to install (default: latest, e.g. v0.2.0)
 *   MERCURY_FROM_SOURCE  =1 to force building from source
 *   MERCURY_SRC_DIR      where the repo is cached (default: ~/.mercury/src)
 *   MERCURY_BIN_DIR      where the binary is linked (default: ~/.local/bin)
 *   MERCURY_SKILLS_DIR   where skills are copied (default: auto-detected per tool)
 *   MERCURY_NO_SKILLS=1  skip copying skills
 */
import { $ } from "bun";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { chmodSync } from "node:fs";

// ---------------------------------------------------------------------------
// Constants & env overrides
// ---------------------------------------------------------------------------

const REPO_SLUG = Bun.env.MERCURY_REPO_SLUG ?? "joaovjo/mercury";
const REPO = Bun.env.MERCURY_REPO ?? `https://github.com/${REPO_SLUG}.git`;
const REF = Bun.env.MERCURY_REF ?? "main";
const HOME = process.env.HOME ?? process.env.USERPROFILE ?? "~";
const SRC_DIR = Bun.env.MERCURY_SRC_DIR ?? join(HOME, ".mercury", "src");
const BIN_DIR = Bun.env.MERCURY_BIN_DIR ?? join(HOME, ".local", "bin");
const IS_WINDOWS = process.platform === "win32";
const EXE = IS_WINDOWS ? ".exe" : "";

// ---------------------------------------------------------------------------
// Coloured output helpers
// ---------------------------------------------------------------------------

const bold = (s: string) => console.log(`\x1b[1m${s}\x1b[0m`);
const info = (s: string) => console.log(`  \x1b[36m${s}\x1b[0m`);
const warn = (s: string) => console.log(`  \x1b[33m${s}\x1b[0m`);
const ok = (s: string) => console.log(`  \x1b[32m✓\x1b[0m ${s}`);
const die = (s: string) => {
  console.error(`\x1b[31merror:\x1b[0m ${s}`);
  process.exit(1);
};

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

function detectAsset(): string {
  let os: string;
  switch (process.platform) {
    case "linux":
      os = "linux";
      break;
    case "darwin":
      os = "darwin";
      break;
    case "win32":
      os = "windows";
      break;
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }

  let arch: string;
  switch (process.arch) {
    case "x64":
      arch = "x64";
      break;
    case "arm64":
      arch = "arm64";
      break;
    default:
      throw new Error(`Unsupported architecture: ${process.arch}`);
  }

  // Bun only ships windows-x64 (no windows-arm64).
  if (os === "windows") {
    if (arch !== "x64") throw new Error("Windows only supports x64 prebuilt binaries");
    return `mercury-${os}-${arch}.exe`;
  }
  return `mercury-${os}-${arch}`;
}

// ---------------------------------------------------------------------------
// Cross-platform file helpers (Bun API priority)
// ---------------------------------------------------------------------------

async function pathExists(p: string): Promise<boolean> {
  return Bun.file(p).exists();
}

async function installBinary(src: string, dst: string): Promise<void> {
  await Bun.write(dst, Bun.file(src));
  if (!IS_WINDOWS) {
    chmodSync(dst, 0o755);
  }
}

// ---------------------------------------------------------------------------
// Release tag resolution — fetch() (Web API)
// ---------------------------------------------------------------------------

async function resolveTag(): Promise<string> {
  if (Bun.env.MERCURY_VERSION) return Bun.env.MERCURY_VERSION;

  const resp = await fetch(`https://api.github.com/repos/${REPO_SLUG}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!resp.ok) throw new Error(`GitHub API returned ${resp.status}`);
  const data = (await resp.json()) as { tag_name: string };
  return data.tag_name;
}

// ---------------------------------------------------------------------------
// Skills copying — Bun Shell $ + node:fs
// ---------------------------------------------------------------------------

async function copySkills(sourceDir: string): Promise<void> {
  if (Bun.env.MERCURY_NO_SKILLS === "1") return;

  const skillsRoot = join(sourceDir, "skills");
  if (!(await pathExists(skillsRoot))) {
    warn("No skills/ found to copy.");
    return;
  }

  const targets: string[] = [];
  if (Bun.env.MERCURY_SKILLS_DIR) {
    targets.push(Bun.env.MERCURY_SKILLS_DIR);
  } else {
    const opencodeDir = join(HOME, ".config", "opencode");
    const claudeDir = join(HOME, ".claude");
    if (await pathExists(opencodeDir)) targets.push(join(opencodeDir, "skills"));
    if (await pathExists(claudeDir)) targets.push(join(claudeDir, "skills"));
  }

  if (targets.length === 0) {
    warn("No agent skills dir detected — set MERCURY_SKILLS_DIR to copy skills.");
    return;
  }

  for (const t of targets) {
    await mkdir(t, { recursive: true });
    await $`cp -R ${join(skillsRoot, ".")} ${t}/`;
    ok(`Skills copied → ${t}`);
  }
}

// ---------------------------------------------------------------------------
// Source build fallback
// ---------------------------------------------------------------------------

async function installFromSource(): Promise<void> {
  info("Installing from source (building with Bun)...");

  if (!Bun.which("git")) die("git is required for a source build.");

  if (!Bun.which("bun")) {
    warn("Bun not found — installing it (https://bun.sh)...");
    const installResult = await $`curl -fsSL https://bun.sh/install | bash`.nothrow();
    if (installResult.exitCode !== 0) die("Bun install failed. Install manually from https://bun.sh and re-run.");
    const bunInstall = Bun.env.BUN_INSTALL ?? join(HOME, ".bun");
    process.env.PATH = `${join(bunInstall, "bin")}:${process.env.PATH}`;
    if (!Bun.which("bun")) die("Bun installed but not on PATH. Restart your shell and re-run.");
    ok("Bun installed");
  } else {
    ok(`Bun present (${Bun.version})`);
  }

  if (await pathExists(join(SRC_DIR, ".git"))) {
    info(`Updating source in ${SRC_DIR}`);
    await $`git -C ${SRC_DIR} remote set-url origin ${REPO}`.nothrow();
    await $`git -C ${SRC_DIR} fetch --depth 1 origin ${REF} --quiet`;
    await $`git -C ${SRC_DIR} checkout -q FETCH_HEAD`;
    ok(`Source updated to latest ${REF}`);
  } else {
    info(`Cloning ${REPO} → ${SRC_DIR}`);
    await mkdir(join(SRC_DIR, ".."), { recursive: true });
    await $`rm -rf ${SRC_DIR}`.nothrow();
    const cloneResult = await $`git clone --depth 1 --branch ${REF} ${REPO} ${SRC_DIR} --quiet`.nothrow();
    if (cloneResult.exitCode !== 0) {
      await $`git clone --depth 1 ${REPO} ${SRC_DIR} --quiet`;
    }
    ok("Source cloned");
  }

  info("Building the mercury binary (this can take a minute)...");
  await $`bun install --silent`.cwd(join(SRC_DIR, "app"));
  await $`bun run build`.cwd(join(SRC_DIR, "app"));

  const binaryPath = join(SRC_DIR, "app", "dist", `mercury${EXE}`);
  if (!(await pathExists(binaryPath))) die(`Build did not produce dist/mercury${EXE}`);

  await mkdir(BIN_DIR, { recursive: true });
  const destPath = join(BIN_DIR, `mercury${EXE}`);
  await installBinary(binaryPath, destPath);
  ok(`Installed mercury → ${destPath} (from source)`);

  await copySkills(SRC_DIR);
}

// ---------------------------------------------------------------------------
// Prebuilt binary install — fetch() + Bun.CryptoHasher + Bun.write()
// ---------------------------------------------------------------------------

async function installPrebuilt(): Promise<boolean> {
  let asset: string;
  try {
    asset = detectAsset();
  } catch {
    warn("Unsupported platform for prebuilt binaries.");
    return false;
  }

  const binName = asset.endsWith(".exe") ? "mercury.exe" : "mercury";

  let tag: string;
  try {
    tag = await resolveTag();
  } catch {
    warn("Could not resolve a release tag.");
    return false;
  }
  info(`Latest release: ${tag} (${asset})`);

  const base = `https://github.com/${REPO_SLUG}/releases/download/${tag}`;
  const tmpDir = await mkdtemp();

  try {
    // Download binary — fetch() (Web API)
    info(`Downloading ${asset}...`);
    const binResp = await fetch(`${base}/${asset}`);
    if (!binResp.ok) {
      warn("Binary download failed.");
      return false;
    }
    const binPath = join(tmpDir, binName);
    await Bun.write(binPath, binResp);

    // SHA256 verification — Bun.CryptoHasher (Bun API)
    const sumsResp = await fetch(`${base}/SHA256SUMS`).catch(() => null);
    if (sumsResp?.ok) {
      const sumsText = await sumsResp.text();
      const want = sumsText
        .split("\n")
        .find((l) => l.endsWith(` ${asset}`))
        ?.split(" ")[0]
        ?.trim();
      if (want) {
        const hasher = new Bun.CryptoHasher("sha256");
        hasher.update(await Bun.file(binPath).arrayBuffer());
        const got = hasher.digest("hex");
        if (want !== got) die(`Checksum mismatch for ${asset} (expected ${want}, got ${got}).`);
        ok("Checksum verified");
      }
    }

    // Install
    await mkdir(BIN_DIR, { recursive: true });
    const destPath = join(BIN_DIR, binName);
    await installBinary(binPath, destPath);
    ok(`Installed mercury → ${destPath} (prebuilt ${tag})`);

    // Skills — fetch tarball, extract, copy
    if (Bun.env.MERCURY_NO_SKILLS !== "1") {
      info(`Fetching skills for ${tag}...`);
      const tgzResp = await fetch(`https://codeload.github.com/${REPO_SLUG}/tar.gz/refs/tags/${tag}`).catch(() => null);
      if (tgzResp?.ok) {
        const tgzPath = join(tmpDir, "src.tgz");
        await Bun.write(tgzPath, tgzResp);
        await $`tar -xzf ${tgzPath} -C ${tmpDir}`.nothrow();
        const entries = await readdir(tmpDir);
        const extracted = entries.find((e) => e.startsWith("mercury-"));
        if (extracted) await copySkills(join(tmpDir, extracted));
      } else {
        warn("Could not fetch skills tarball; re-run with MERCURY_FROM_SOURCE=1 to copy skills.");
      }
    }

    return true;
  } finally {
    await $`rm -rf ${tmpDir}`.nothrow();
  }
}

// ---------------------------------------------------------------------------
// Cross-platform helpers
// ---------------------------------------------------------------------------

async function mkdtemp(): Promise<string> {
  if (IS_WINDOWS) {
    const tmpBase = process.env.TEMP ?? process.env.TMP ?? join(HOME, "AppData", "Local", "Temp");
    const dir = join(tmpBase, `mercury-install-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(dir, { recursive: true });
    return dir;
  }
  return (await $`mktemp -d`.text()).trim();
}

async function readdir(dir: string): Promise<string[]> {
  const { readdirSync } = await import("node:fs");
  return readdirSync(dir) as unknown as string[];
}

// ---------------------------------------------------------------------------
// Orchestrate
// ---------------------------------------------------------------------------

bold("Mercury — installing/updating");

if (Bun.env.MERCURY_FROM_SOURCE === "1") {
  await installFromSource();
} else if (!(await installPrebuilt())) {
  warn("Falling back to a source build...");
  await installFromSource();
}

// PATH hint + first-run
console.log();
const mercuryPath = join(BIN_DIR, `mercury${EXE}`);
const onPath = Bun.which("mercury");
if (!onPath) {
  warn(`Add ${BIN_DIR} to your PATH, then restart your shell:`);
  if (IS_WINDOWS) {
    console.log(`    $env:Path = "${BIN_DIR};$env:Path"`);
  } else {
    console.log(`    export PATH="${BIN_DIR}:$PATH"`);
  }
}

const versionResult = await $`${mercuryPath} --version`.quiet().nothrow();
const version = versionResult.exitCode === 0 ? versionResult.stdout.toString().trim() : "mercury";
await $`${mercuryPath} init`.quiet().nothrow();
bold(`Done — ${version}`);
console.log("  Next:  mercury dashboard");
