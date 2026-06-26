import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, readlinkSync } from "node:fs";

/**
 * Locate the repo's `skills/` directory. Mercury is distributed as a single
 * binary plus a `skills/` folder (markdown). We probe the likely locations so
 * `mercury setup` works whether installed via bootstrap (~/.mercury/src), run
 * from a clone, or pointed at explicitly via MERCURY_SKILLS_SRC.
 */
export function findSkillsSource(): string | null {
  const candidates: string[] = [];
  if (process.env.MERCURY_SKILLS_SRC) candidates.push(process.env.MERCURY_SKILLS_SRC);
  // bootstrap clones the repo here
  candidates.push(join(homedir(), ".mercury", "src", "skills"));
  // running the binary from a checkout: <repo>/app/dist/mercury → <repo>/skills
  try {
    const selfDir = dirname(fileURLToPath(import.meta.url));
    candidates.push(join(selfDir, "..", "..", "..", "skills")); // src/cli → repo/skills (dev)
    candidates.push(join(selfDir, "..", "..", "skills"));
  } catch {
    /* compiled binary has no meaningful import.meta.url path */
  }
  // alongside the executable
  try {
    candidates.push(join(dirname(process.execPath), "skills"));
    candidates.push(join(dirname(process.execPath), "..", "skills"));
  } catch {
    /* ignore */
  }
  candidates.push(join(process.cwd(), "skills"));

  for (const c of candidates) {
    if (c && existsSync(c) && existsSync(join(c, "job-scout", "SKILL.md"))) return c;
  }
  return null;
}

export interface AgentTarget {
  id: string;
  name: string;
  /** Skills directory for this agent (created if the agent's config root exists). */
  skillsDir: string;
  /** Whether the agent appears installed (config dir present). */
  detected: boolean;
}

/** Known agents and where their skills live. */
export function detectAgents(): AgentTarget[] {
  const home = homedir();
  const defs: Array<{ id: string; name: string; root: string; skills: string }> = [
    { id: "opencode", name: "opencode", root: join(home, ".config", "opencode"), skills: join(home, ".config", "opencode", "skills") },
    { id: "claude", name: "Claude Code", root: join(home, ".claude"), skills: join(home, ".claude", "skills") },
    { id: "cursor", name: "Cursor", root: join(home, ".cursor"), skills: join(home, ".cursor", "skills") },
    { id: "codex", name: "Codex", root: join(home, ".codex"), skills: join(home, ".codex", "skills") },
    { id: "agents", name: "Generic (~/.agents)", root: join(home, ".agents"), skills: join(home, ".agents", "skills") },
  ];
  return defs.map((d) => ({
    id: d.id,
    name: d.name,
    skillsDir: d.skills,
    detected: existsSync(d.root),
  }));
}

/** Recursively copy a directory (skills are small; no deps). */
export function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dest, entry);
    const st = statSync(s);
    if (st.isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}
