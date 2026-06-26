import { homedir, tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync } from "node:fs";
import { VERSION } from "../version.gen.ts";

const REPO_SLUG = process.env.MERCURY_REPO_SLUG ?? "Daniel-Boll/mercury";

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

/**
 * Return a usable skills/ directory, downloading it if necessary.
 *
 * Prebuilt-binary installs don't keep a repo clone, so when no local source is
 * found we fetch the version-matched source tarball from GitHub and cache the
 * extracted `skills/` under ~/.mercury/skills-cache/<version>/.
 */
export async function ensureSkillsSource(): Promise<string | null> {
  const local = findSkillsSource();
  if (local) return local;
  return downloadSkills();
}

async function downloadSkills(): Promise<string | null> {
  const tag = `v${VERSION}`;
  const cacheDir = join(homedir(), ".mercury", "skills-cache", tag);
  const cachedSkills = join(cacheDir, "skills");
  if (existsSync(join(cachedSkills, "job-scout", "SKILL.md"))) return cachedSkills;

  const refs = [`refs/tags/${tag}`, "refs/heads/main"];
  for (const ref of refs) {
    try {
      const url = `https://codeload.github.com/${REPO_SLUG}/tar.gz/${ref}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const tmp = join(tmpdir(), `mercury-skills-${Date.now()}`);
      mkdirSync(tmp, { recursive: true });
      const tgz = join(tmp, "src.tgz");
      await Bun.write(tgz, await res.arrayBuffer());
      const proc = Bun.spawnSync(["tar", "-xzf", tgz, "-C", tmp]);
      if (!proc.success) {
        rmSync(tmp, { recursive: true, force: true });
        continue;
      }
      const top = readdirSync(tmp).find((d) => d.startsWith("mercury-") || d.includes("-mercury-"));
      const extractedSkills = top ? join(tmp, top, "skills") : null;
      if (extractedSkills && existsSync(join(extractedSkills, "job-scout", "SKILL.md"))) {
        mkdirSync(cacheDir, { recursive: true });
        copyDir(extractedSkills, cachedSkills);
        rmSync(tmp, { recursive: true, force: true });
        return cachedSkills;
      }
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* try next ref */
    }
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
