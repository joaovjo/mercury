/**
 * SQLite schema for Mercury. Applied idempotently on every connection open.
 * Single migration block for v0.1; versioned migrations can layer on later
 * via the `schema_version` pragma table.
 */
export const SCHEMA_VERSION = 3;

export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS profile (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  username       TEXT,
  name           TEXT,
  headline       TEXT,
  location       TEXT,
  current_company TEXT,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS profile_metrics (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  captured_at        TEXT NOT NULL,
  search_appearances INTEGER,
  profile_views      INTEGER,
  post_impressions   INTEGER,
  connections        INTEGER,
  score              INTEGER,
  breakdown_json     TEXT
);

CREATE TABLE IF NOT EXISTS companies (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL UNIQUE,
  urn_id  TEXT,
  notes   TEXT
);

CREATE TABLE IF NOT EXISTS recruiters (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  username       TEXT,
  company        TEXT,
  title          TEXT,
  location       TEXT,
  degree         TEXT,
  mutuals_json   TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  date_contacted TEXT,
  accepted_at    TEXT,
  replied_at     TEXT,
  note           TEXT,
  source_skill   TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (username, company)
);

CREATE TABLE IF NOT EXISTS jobs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  linkedin_job_id  TEXT UNIQUE,
  title            TEXT,
  company_id       INTEGER REFERENCES companies(id),
  company_name     TEXT,
  location         TEXT,
  work_type        TEXT,
  comp             TEXT,
  fit              TEXT,
  requirements_json TEXT,
  status           TEXT NOT NULL DEFAULT 'saved',
  link             TEXT,
  scouted_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id           INTEGER REFERENCES jobs(id),
  resume_path      TEXT,
  cover_letter_path TEXT,
  report_path      TEXT,
  keyword_score    INTEGER,
  status           TEXT NOT NULL DEFAULT 'draft',
  applied_at       TEXT
);

-- Reusable, single-source-of-truth answers for external ATS application forms
-- (PII / eligibility / links / EEO). Dashboard-editable via \`mercury answer\`.
-- EEO answers MAY be stored here, but skills never auto-fill them — the human
-- enters EEO/demographic fields at review time.
CREATE TABLE IF NOT EXISTS applicant_answers (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  category   TEXT NOT NULL DEFAULT 'custom',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interviews (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company       TEXT NOT NULL,
  job_id        INTEGER REFERENCES jobs(id),
  scheduled_at  TEXT,
  stage         TEXT,
  status        TEXT NOT NULL DEFAULT 'scheduled',
  notes         TEXT
);

CREATE TABLE IF NOT EXISTS outreach_messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_id INTEGER REFERENCES recruiters(id),
  body         TEXT,
  kind         TEXT NOT NULL DEFAULT 'connect',
  sent_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Outreach relationship memory (issue #11). One row per OUTREACH ATTEMPT,
-- scoped by (person_username, company_urn) — NOT one row per person. This lets
-- the same person be tracked independently across companies over time, and lets
-- a "block" be company-scoped (ignored at Company A doesn't block them once they
-- move to Company B). The stable scoping key is the LinkedIn company URN, never
-- the free-text company name (which fragments: "Amazon" vs "AWS").
--
-- A person is BLOCKED for a company when an attempt exists for
-- (person_username, company_urn) in a terminal-non-engaged state
-- (invite_ignored | unresponsive | do_not_contact) within the configured
-- cooldown window (see config [outreach].company_block).
CREATE TABLE IF NOT EXISTS outreach_attempts (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  person_username       TEXT NOT NULL,          -- stable identity key
  person_name           TEXT,
  recruiter_id          INTEGER REFERENCES recruiters(id),  -- optional link to directory
  company_urn           TEXT NOT NULL,          -- SCOPING key (stable URN, not name)
  company_name          TEXT,
  job_id                TEXT,                   -- role context (block is company-wide)
  channel               TEXT,                   -- connect_note | message | inmail
  cost_credits          INTEGER NOT NULL DEFAULT 0,  -- 0 = free path, 1 = InMail credit spent
  credit_refunded       INTEGER NOT NULL DEFAULT 0,  -- 1 if InMail credit refunded (reply <90d)
  refund_eligible_until TEXT,                   -- sent_at + 90d (InMail only)
  message_body          TEXT,
  state                 TEXT NOT NULL DEFAULT 'queued',
  -- lifecycle: queued | invited | invite_ignored | accepted | followed_up
  --            | unresponsive | engaged | do_not_contact
  sent_at               TEXT,
  accepted_at           TEXT,
  first_msg_at          TEXT,
  followed_up_at        TEXT,
  replied_at            TEXT,
  withdrawn_at          TEXT,
  closed_at             TEXT,
  next_action_due       TEXT,                   -- when the tracker should act next
  block_until           TEXT,                   -- cooldown expiry for terminal blocks (NULL = permanent/none)
  reason                TEXT,                    -- human-readable note on terminal transitions
  source_skill          TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- InMail credit budget (issue #11 §5b). Single-row (id=1) live counter seeded
-- from config. InMail is a scarce paid resource: the planner treats credits as
-- a budget and never spends below reserve_floor. LinkedIn exposes no API for
-- this, so values are set manually (mercury outreach budget set) or scraped.
CREATE TABLE IF NOT EXISTS outreach_budget (
  id                      INTEGER PRIMARY KEY CHECK (id = 1),
  plan                    TEXT,                  -- career | business | recruiter_lite | sales_navigator | none
  inmail_monthly_allotment INTEGER NOT NULL DEFAULT 0,
  inmail_rollover_cap     INTEGER NOT NULL DEFAULT 0,
  cycle_reset_day         INTEGER NOT NULL DEFAULT 1,
  credits_remaining       INTEGER NOT NULL DEFAULT 0,
  credits_used_this_cycle INTEGER NOT NULL DEFAULT 0,
  reserve_floor           INTEGER NOT NULL DEFAULT 0,
  last_synced             TEXT
);

CREATE TABLE IF NOT EXISTS activity_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           TEXT NOT NULL DEFAULT (datetime('now')),
  kind         TEXT NOT NULL,
  skill        TEXT,
  summary      TEXT,
  payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_recruiters_status  ON recruiters(status);
CREATE INDEX IF NOT EXISTS idx_recruiters_company ON recruiters(company);
CREATE INDEX IF NOT EXISTS idx_jobs_status        ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_metrics_captured   ON profile_metrics(captured_at);
CREATE INDEX IF NOT EXISTS idx_activity_ts        ON activity_log(ts);
CREATE INDEX IF NOT EXISTS idx_answers_category   ON applicant_answers(category);
CREATE INDEX IF NOT EXISTS idx_attempts_scope     ON outreach_attempts(person_username, company_urn);
CREATE INDEX IF NOT EXISTS idx_attempts_state     ON outreach_attempts(state);
CREATE INDEX IF NOT EXISTS idx_attempts_due       ON outreach_attempts(next_action_due);
CREATE INDEX IF NOT EXISTS idx_attempts_company   ON outreach_attempts(company_urn);
`;

/**
 * Additive column migrations for tables that predate a feature. SQLite has no
 * \`ADD COLUMN IF NOT EXISTS\`, so we introspect \`PRAGMA table_info\` and only add
 * what's missing. Safe to run on every open (idempotent).
 *
 * portal-filler (issue #7) extends \`applications\` with ATS-fill metadata.
 */
export const COLUMN_MIGRATIONS: Record<string, Record<string, string>> = {
  applications: {
    portal: "TEXT",
    external_url: "TEXT",
    fields_filled_json: "TEXT",
    unfilled_json: "TEXT",
  },
};
