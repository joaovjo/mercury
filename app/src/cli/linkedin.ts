import { homedir, platform } from "node:os";
import { join } from "node:path";
import { existsSync, readdirSync, rmSync } from "node:fs";
import type { Flags } from "./flags.ts";

/**
 * LinkedIn MCP hygiene.
 *
 * The `mcp-server-linkedin` server drives a headless Chromium against a single
 * *persistent* profile (~/.linkedin-mcp/profile). On Windows, when the MCP
 * client (Claude Code, opencode, or our own dashboard) kills the server, the
 * browser children are not reaped — Windows has no POSIX process groups, so the
 * descendants are orphaned — and they keep the profile's Chromium singleton
 * lock held. The next run then collides with that lock and `search_jobs` fails
 * with an "invalid state" error. Across enough runs the orphans pile up and the
 * server fails consistently.
 *
 * `sweepLinkedinBrowsers` clears that contention by killing only the MCP-owned
 * browser processes (identified by the `.linkedin-mcp` path, so the user's real
 * Chrome/Brave is never touched) and removing stale singleton lock files. Run
 * it as a preflight before a session: every run then starts from a clean
 * profile regardless of what a previous run leaked.
 *
 * It is safe and effectively a no-op on macOS/Linux, where stale Chromium locks
 * self-heal and orphans are rare — the Windows path is where it matters.
 */

const LINKEDIN_DIR = join(homedir(), ".linkedin-mcp");
const PROFILE_DIR = join(LINKEDIN_DIR, "profile");

/** Best-effort, never throws. Returns what it cleaned up. */
export async function sweepLinkedinBrowsers(): Promise<{ killed: number; locksCleared: number }> {
  let killed = 0;
  try {
    killed = platform() === "win32" ? await killWindows() : await killPosix();
  } catch {
    /* best-effort */
  }

  let locksCleared = 0;
  try {
    if (existsSync(PROFILE_DIR)) {
      for (const name of readdirSync(PROFILE_DIR)) {
        // Chromium leaves SingletonLock / SingletonCookie / SingletonSocket; a
        // stale one (owner already killed above) blocks a fresh launch.
        if (name.startsWith("Singleton")) {
          try {
            rmSync(join(PROFILE_DIR, name), { force: true });
            locksCleared++;
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  return { killed, locksCleared };
}

/** Kill MCP-owned browsers on Windows via PowerShell, filtered by the
 *  `.linkedin-mcp` path so only Mercury's bundled Chromium is matched. */
async function killWindows(): Promise<number> {
  const script =
    "$ErrorActionPreference='SilentlyContinue';" +
    "$p = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '\\.linkedin-mcp' -and $_.Name -match 'chrome' };" +
    "$p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force };" +
    "($p | Measure-Object).Count";
  const out = await runCapture([
    "powershell",
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ]);
  return parseInt((out ?? "").trim(), 10) || 0;
}

/** Kill MCP-owned browsers on macOS/Linux, matched by the `.linkedin-mcp`
 *  path in the command line. */
async function killPosix(): Promise<number> {
  const out = await runCapture(["pgrep", "-f", "\\.linkedin-mcp.*(chrome|chromium|headless)"]);
  const pids = (out ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const pid of pids) {
    try {
      process.kill(Number(pid), "SIGKILL");
    } catch {
      /* already gone */
    }
  }
  return pids.length;
}

/** Spawn a command, capture stdout, swallow errors. Bounded so a hung query
 *  can't stall a preflight. */
async function runCapture(cmd: string[]): Promise<string | null> {
  try {
    const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore" });
    const out = await Promise.race([
      new Response(proc.stdout).text(),
      new Promise<string>((resolve) =>
        setTimeout(() => {
          try {
            proc.kill();
          } catch {}
          resolve("");
        }, 8000),
      ),
    ]);
    return out;
  } catch {
    return null;
  }
}

/**
 * `mercury linkedin <sub>` — currently just `reset`, which sweeps stale LinkedIn
 * MCP browser sessions and locks. Skills call this as a preflight; users can run
 * it by hand when the LinkedIn MCP starts failing.
 */
export async function linkedinCmd(sub: string, _flags: Flags): Promise<void> {
  if (sub === "reset" || sub === "") {
    const { killed, locksCleared } = await sweepLinkedinBrowsers();
    console.log(
      `linkedin reset — killed ${killed} stale browser process(es), cleared ${locksCleared} stale lock file(s).`,
    );
    return;
  }
  console.error(`unknown subcommand: linkedin ${sub}\nusage: mercury linkedin reset`);
  process.exit(1);
}
