import { join } from "node:path";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { ensureHome, paths } from "../paths.ts";
import { db } from "../db/index.ts";
import { type Flags, str } from "./flags.ts";
import { findSkillsSource, detectAgents, copyDir, type AgentTarget } from "./skills.ts";

/**
 * mercury setup — install the Mercury skills into every detected agent, and
 * scaffold ~/.mercury/. Idempotent: safe to re-run after an update to refresh
 * the skills everywhere.
 *
 * Flags:
 *   --agent <id>     only set up this agent (opencode|claude|cursor|codex|agents)
 *   --skills-dir <p> copy into an explicit dir (in addition to detected agents)
 *   --all            include agents that aren't detected (creates their dirs)
 *   --skills-src <p> override where to read the skills from
 */
export function setupCmd(flags: Flags): void {
  ensureHome();
  db(); // ensure the home + db exist

  const src = str(flags, "skills-src") ?? findSkillsSource();
  if (!src) {
    console.error("error: couldn't locate the Mercury skills/ directory.");
    console.error("  Set MERCURY_SKILLS_SRC=/path/to/repo/skills or run from a clone,");
    console.error("  or reinstall via the bootstrap (which clones to ~/.mercury/src).");
    process.exit(1);
  }

  const onlyAgent = str(flags, "agent");
  const explicitDir = str(flags, "skills-dir");
  const includeAll = flags.all === true;

  let targets: AgentTarget[] = detectAgents();
  if (onlyAgent) targets = targets.filter((t) => t.id === onlyAgent);
  if (!includeAll && !onlyAgent) targets = targets.filter((t) => t.detected);

  const copied: string[] = [];

  for (const t of targets) {
    copyDir(src, t.skillsDir);
    copied.push(`${t.name} → ${tilde(t.skillsDir)}`);
  }

  if (explicitDir) {
    copyDir(src, explicitDir);
    copied.push(`(explicit) → ${tilde(explicitDir)}`);
  }

  console.log(`Mercury setup — skills from ${tilde(src)}\n`);

  if (copied.length === 0) {
    console.log("No agents detected. Options:");
    console.log("  • mercury setup --all                 (set up all known agents)");
    console.log("  • mercury setup --agent opencode      (a specific agent)");
    console.log("  • mercury setup --skills-dir <path>   (an explicit directory)");
  } else {
    for (const line of copied) console.log(`  ✓ ${line}`);
  }

  // Show which agents were skipped so the user knows what's available.
  if (!onlyAgent && !includeAll) {
    const skipped = detectAgents().filter((t) => !t.detected);
    if (skipped.length) {
      console.log(`\n  Not detected (use --all or --agent to include): ${skipped.map((s) => s.id).join(", ")}`);
    }
  }

  console.log(`\nNext: mercury init && mercury dashboard`);
}

function tilde(p: string): string {
  const h = homedir();
  return p.startsWith(h) ? p.replace(h, "~") : p;
}
