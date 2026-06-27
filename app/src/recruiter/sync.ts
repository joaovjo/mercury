/**
 * `mercury recruiter sync` core (issue #15).
 *
 * Reconciles the local `recruiters` table with LinkedIn reality. LinkedIn's MCP
 * exposes no "who accepted my invitations" tool, so acceptance is inferred from
 * connection *degree*: a recruiter we recorded as `pending` who now shows up in
 * our **1st-degree** network has accepted. We detect this with a company-scoped
 * first-degree people search (`search_people network=["F"] keywords="<company>
 * recruiter"`), which returns only people we are actually connected to at that
 * company.
 *
 * Layering (mirrors outreach withdraw / search):
 *   - The pure matching logic (`matchAccepted`, `normalizeName`,
 *     `usernameFromRef`) has no I/O and is unit-tested.
 *   - `detectAccepted` drives the LinkedIn MCP via `callTool` — only callable
 *     where the MCP is reachable (the long-running dashboard server, or a CLI
 *     run on a machine with the MCP configured).
 *   - `planSync` / `applySync` read/write the DB.
 *
 * Safety: sync only ever advances `pending → accepted`. It never touches
 * human-confirmed states (`replied`, `interviewing`, `closed`) — those encode
 * knowledge the degree signal can't see.
 */
import type { Database } from "bun:sqlite";
import { db, now } from "../db/index.ts";
import { callTool } from "../mcp/linkedin.ts";

/** A recruiter row, narrowed to the fields sync cares about. */
export interface RecruiterRow {
  id: number;
  name: string;
  username: string | null;
  company: string | null;
  degree: string | null;
  status: string;
}

/** One detected first-degree connection from a people search. */
export interface DetectedPerson {
  username: string | null;
  name: string;
}

/** A single proposed/applied change. */
export interface SyncChange {
  id: number;
  name: string;
  company: string | null;
  from: string; // previous status
  to: string; // new status (currently always "accepted")
  matchedBy: "username" | "name";
}

export interface SyncResult {
  scanned: number; // pending recruiters considered
  companiesQueried: number; // distinct companies we searched
  changes: SyncChange[]; // pending → accepted transitions
  applied: boolean; // whether the changes were written
  skipped: string[]; // companies skipped (no name / detection error), for transparency
}

/** Only these statuses are eligible to be auto-advanced by sync. */
const SYNCABLE_FROM = "pending";

// ── Pure helpers (no I/O — unit tested) ─────────────────────────────────────

/**
 * Normalize a display name for fuzzy comparison: lowercase, strip diacritics,
 * collapse whitespace, drop punctuation. "Renée  Würst!" → "renee wurst".
 * Used as a fallback when usernames aren't available on both sides.
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract a bare LinkedIn username/vanity slug from a profile reference URL or
 * username string. Handles `/in/<slug>/`, full URLs, percent-encoding, and
 * trailing slashes. Returns lowercase, URL-decoded slug, or null.
 *
 * `https://www.linkedin.com/in/recruiter-one-000001/` → `recruiter-one-000001`
 * `re%C3%A9-recruiter-003` → `reé-recruiter-003`
 */
export function usernameFromRef(ref: string | null | undefined): string | null {
  if (!ref) return null;
  let s = ref.trim();
  const m = s.match(/\/in\/([^/?#]+)/);
  if (m) s = m[1]!;
  try {
    s = decodeURIComponent(s);
  } catch {
    /* leave as-is if not valid percent-encoding */
  }
  s = s.replace(/^\/+|\/+$/g, "").toLowerCase();
  return s || null;
}

/**
 * Given the pending recruiters for a single company and the set of first-degree
 * people detected at that company, return the recruiters that should transition
 * to `accepted`. Matches by username first (exact, after normalization), then
 * by normalized full name.
 */
export function matchAccepted(
  pending: RecruiterRow[],
  detected: DetectedPerson[],
): SyncChange[] {
  const detectedUsernames = new Set<string>();
  const detectedNames = new Set<string>();
  for (const p of detected) {
    const u = usernameFromRef(p.username);
    if (u) detectedUsernames.add(u);
    const n = normalizeName(p.name);
    if (n) detectedNames.add(n);
  }

  const changes: SyncChange[] = [];
  for (const r of pending) {
    if (r.status !== SYNCABLE_FROM) continue;
    const ru = usernameFromRef(r.username);
    if (ru && detectedUsernames.has(ru)) {
      changes.push({
        id: r.id,
        name: r.name,
        company: r.company,
        from: r.status,
        to: "accepted",
        matchedBy: "username",
      });
      continue;
    }
    const rn = normalizeName(r.name);
    if (rn && detectedNames.has(rn)) {
      changes.push({
        id: r.id,
        name: r.name,
        company: r.company,
        from: r.status,
        to: "accepted",
        matchedBy: "name",
      });
    }
  }
  return changes;
}

/**
 * Parse the loosely-structured `search_people` MCP result into a list of
 * detected people. The MCP returns a `sections.search_results` text blob plus a
 * `references.search_results` array of `{ url, text }`. The references are the
 * reliable source of usernames; the text blob carries the names. We zip them by
 * pairing each reference's `text` (the person's name) with its `url` (the
 * profile slug), filtering out the mutual-connection refs that also appear.
 */
export function parsePeopleResult(result: unknown): DetectedPerson[] {
  const r = result as {
    references?: { search_results?: Array<{ kind?: string; url?: string; text?: string }> };
  };
  const refs = r?.references?.search_results ?? [];
  const people: DetectedPerson[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const slug = usernameFromRef(ref.url);
    if (!slug || seen.has(slug)) continue;
    // refs carry both result people and their mutual-connection chips; both are
    // `/in/...` links. We keep all of them as candidate detections — a false
    // positive only matters if a pending recruiter's exact username/name also
    // appears, which means they ARE a 1st-degree connection anyway.
    seen.add(slug);
    people.push({ username: slug, name: ref.text ?? "" });
  }
  return people;
}

// ── Orchestration (DB + MCP) ────────────────────────────────────────────────

/** Load all pending recruiters that have a company to search within. */
export function pendingRecruiters(d: Database = db()): RecruiterRow[] {
  return d
    .query(
      `SELECT id, name, username, company, degree, status
       FROM recruiters
       WHERE status = 'pending'
       ORDER BY company, id`,
    )
    .all() as RecruiterRow[];
}

/**
 * Drive the LinkedIn MCP to detect first-degree connections at a company.
 * Returns [] on any error (best-effort; the company is reported as skipped).
 */
export async function detectAccepted(company: string): Promise<DetectedPerson[]> {
  const result = await callTool("search_people", {
    keywords: `${company} recruiter`,
    network: ["F"],
  });
  return parsePeopleResult(result);
}

/**
 * Compute the sync plan without writing. Groups pending recruiters by company,
 * runs first-degree detection per company, and returns the proposed changes.
 *
 * @param detect  injectable detector (defaults to the live MCP) — tests pass a stub.
 */
export async function planSync(
  d: Database = db(),
  detect: (company: string) => Promise<DetectedPerson[]> = detectAccepted,
): Promise<SyncResult> {
  const pending = pendingRecruiters(d);
  const byCompany = new Map<string, RecruiterRow[]>();
  for (const r of pending) {
    if (!r.company) continue; // can't search without a company
    const arr = byCompany.get(r.company) ?? [];
    arr.push(r);
    byCompany.set(r.company, arr);
  }

  const changes: SyncChange[] = [];
  const skipped: string[] = [];
  for (const [company, recruiters] of byCompany) {
    let detected: DetectedPerson[];
    try {
      detected = await detect(company);
    } catch {
      skipped.push(company);
      continue;
    }
    changes.push(...matchAccepted(recruiters, detected));
  }

  return {
    scanned: pending.length,
    companiesQueried: byCompany.size,
    changes,
    applied: false,
    skipped,
  };
}

/**
 * Apply a previously-computed plan: transition matched recruiters to `accepted`
 * (idempotent — re-running is a no-op since they're no longer `pending`).
 * Returns the same result with `applied: true`.
 */
export function applySync(plan: SyncResult, d: Database = db()): SyncResult {
  if (!plan.changes.length) return { ...plan, applied: true };
  const stmt = d.query(
    `UPDATE recruiters
       SET status = 'accepted',
           accepted_at = COALESCE(accepted_at, datetime('now')),
           updated_at = datetime('now')
     WHERE id = $id AND status = 'pending'`,
  );
  const tx = d.transaction((changes: SyncChange[]) => {
    for (const c of changes) stmt.run({ $id: c.id });
  });
  tx(plan.changes);
  return { ...plan, applied: true };
}

/** Convenience: plan + (optionally) apply in one call. */
export async function runSync(opts: {
  apply: boolean;
  d?: Database;
  detect?: (company: string) => Promise<DetectedPerson[]>;
}): Promise<SyncResult> {
  const d = opts.d ?? db();
  const plan = await planSync(d, opts.detect);
  return opts.apply ? applySync(plan, d) : plan;
}

void now; // reserved for future timestamping of a sync run
