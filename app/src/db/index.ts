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
