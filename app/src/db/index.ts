import { Database } from "bun:sqlite";
import { ensureHome, paths } from "../paths.ts";
import { SCHEMA_SQL, SCHEMA_VERSION, COLUMN_MIGRATIONS } from "./schema.ts";

let _db: Database | null = null;

/** Add any columns declared in COLUMN_MIGRATIONS that don't yet exist. */
function applyColumnMigrations(d: Database): void {
  for (const [table, columns] of Object.entries(COLUMN_MIGRATIONS)) {
    const existing = new Set(
      (d.query(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
        (c) => c.name,
      ),
    );
    for (const [col, type] of Object.entries(columns)) {
      if (!existing.has(col)) {
        d.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      }
    }
  }
}

/** Read a one-time-migration flag from the meta table. */
function metaFlag(d: Database, key: string): boolean {
  const row = d.query("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value === "1";
}

function setMetaFlag(d: Database, key: string): void {
  d.query("INSERT OR REPLACE INTO meta (key, value) VALUES (?, '1')").run(key);
}

/**
 * Map a recruiter's legacy `status` to an outreach lifecycle state.
 * Conservative: anything we can't confidently place lands in `invited`
 * (awaiting accept) rather than a terminal block, so backfill never
 * over-blocks someone the user might still hear back from.
 */
function legacyStatusToState(status: string | null): string {
  switch (status) {
    case "replied":
    case "interviewing":
      return "engaged";
    case "accepted":
      return "accepted";
    case "closed":
    case "do_not_contact":
      return "do_not_contact";
    case "pending":
    default:
      return "invited";
  }
}

/**
 * One-time backfill of the outreach_attempts log from the legacy `recruiters`
 * directory (issue #11). Each recruiter with a username becomes an attempt row
 * scoped by company URN. Company URN is resolved from the `companies` table by
 * name where possible; rows whose company can't be resolved to a URN are still
 * recorded with a synthetic `name:<company>` URN so they remain trackable and
 * are easy to flag/repair later. Guarded by a meta flag so it runs exactly once.
 */
function backfillOutreachAttempts(d: Database): void {
  if (metaFlag(d, "backfill_outreach_attempts_v1")) return;

  const recruiters = d
    .query(
      `SELECT id, name, username, company, status, date_contacted, accepted_at,
              replied_at, source_skill, created_at
       FROM recruiters
       WHERE username IS NOT NULL AND username <> ''`,
    )
    .all() as Array<{
    id: number;
    name: string | null;
    username: string;
    company: string | null;
    status: string | null;
    date_contacted: string | null;
    accepted_at: string | null;
    replied_at: string | null;
    source_skill: string | null;
    created_at: string | null;
  }>;

  const urnByName = new Map<string, string>();
  for (const c of d.query("SELECT name, urn_id FROM companies").all() as Array<{
    name: string;
    urn_id: string | null;
  }>) {
    if (c.urn_id) urnByName.set(c.name.toLowerCase(), c.urn_id);
  }

  const insert = d.query(`
    INSERT INTO outreach_attempts (
      person_username, person_name, recruiter_id, company_urn, company_name,
      channel, state, sent_at, accepted_at, replied_at, source_skill,
      created_at, updated_at
    ) VALUES (
      $username, $name, $recruiter_id, $company_urn, $company_name,
      $channel, $state, $sent_at, $accepted_at, $replied_at, $source_skill,
      $created_at, datetime('now')
    )
  `);

  const tx = d.transaction(() => {
    for (const r of recruiters) {
      const company = r.company ?? "";
      const urn = urnByName.get(company.toLowerCase()) ?? `name:${company}`;
      insert.run({
        $username: r.username,
        $name: r.name,
        $recruiter_id: r.id,
        $company_urn: urn,
        $company_name: r.company,
        $channel: "connect_note",
        $state: legacyStatusToState(r.status),
        $sent_at: r.date_contacted ?? r.created_at,
        $accepted_at: r.accepted_at,
        $replied_at: r.replied_at,
        $source_skill: r.source_skill,
        $created_at: r.created_at,
      });
    }
  });
  tx();
  setMetaFlag(d, "backfill_outreach_attempts_v1");
}

/** Seed the singleton outreach_budget row (id=1) if it doesn't exist yet. */
function seedOutreachBudget(d: Database): void {
  const exists = d.query("SELECT 1 FROM outreach_budget WHERE id = 1").get();
  if (exists) return;
  d.exec(
    `INSERT INTO outreach_budget (id, plan, inmail_monthly_allotment,
       inmail_rollover_cap, cycle_reset_day, credits_remaining,
       credits_used_this_cycle, reserve_floor)
     VALUES (1, 'none', 0, 0, 1, 0, 0, 0)`,
  );
}

/**
 * Open (and memoize) the Mercury database, applying schema idempotently.
 * WAL mode so the dashboard can read while the CLI writes.
 */
export function db(): Database {
  if (_db) return _db;
  ensureHome();
  const d = new Database(paths.db, { create: true });
  d.exec("PRAGMA journal_mode = WAL;");
  d.exec("PRAGMA foreign_keys = ON;");
  d.exec(SCHEMA_SQL);
  applyColumnMigrations(d);
  seedOutreachBudget(d);
  backfillOutreachAttempts(d);
  d.query("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)").run(
    String(SCHEMA_VERSION),
  );
  _db = d;
  return d;
}

/** ISO timestamp helper used across write commands. */
export function now(): string {
  return new Date().toISOString();
}
