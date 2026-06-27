# Changelog

All notable changes to Mercury are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.0] - 2026-06-27

### Added

- **Outreach relationship memory (issue #11).** Durable, dated, per-(person ×
  company-URN) tracking of every outreach attempt, so the toolkit stops
  re-pestering people who already ignored a request and drives follow-up
  cadences instead of relying on memory.
  - **Schema (v3):** new `outreach_attempts` table scoped by
    `(person_username, company_urn)` — the stable LinkedIn company **URN**, not
    the free-text name (so "Amazon" vs "AWS" can't fragment a block). A person
    is blocked for a company only while an attempt sits in a terminal
    non-engaged state (`invite_ignored` / `unresponsive` / `do_not_contact`)
    within the cooldown window — so someone ignored at Company A is fair game
    once they move to Company B. New singleton `outreach_budget` table tracks
    InMail credits. Existing `recruiters` rows are **backfilled** into the
    attempt log on first run (company URN resolved from `companies` where known;
    otherwise a synthetic `name:<company>` URN is recorded and flagged).
  - **Lifecycle state machine:** `queued → invited → {invite_ignored | accepted
    → followed_up → unresponsive | engaged}`, with manual `do_not_contact`. A
    reply at any stage jumps to `engaged` and stops automation. Pure,
    unit-tested logic in `src/outreach/core.ts`.
  - **Three follow-up cadences** (configurable thresholds): invite unaccepted
    ≥7d → withdraw + block; accepted with no reply ≥4d → gentle nudge; nudge
    unanswered ≥7d → mark unresponsive + block.
  - **Cost-aware channel selection:** prefer free paths (1st-degree message,
    2nd-degree connect+note, Open-Profile InMail) and only spend a scarce InMail
    credit on a high-value 3rd-degree target with no warmer path, never below a
    configurable reserve floor. The weekly invite limit is tracked as a separate
    budget from InMail credits. Replies within 90 days **refund** the credit.
  - **CLI:** `mercury outreach log | update | check | due | list | blocked |
    budget | withdraw`. `check` exits non-zero when blocked so skills can gate
    on it.
  - **Dashboard:** new **Outreach** panel — lifecycle funnel, a "due today"
    action queue (withdraw / follow-up / close with reasons), per-company
    blocked counts, and an InMail-credit budget card. Served from a read-only
    `/api/outreach` route.
  - **Skills:** `recruiter-outreach` now blacklist-checks each candidate and
    records every send as an attempt (with channel + credit cost); `job-scout`
    surfaces individuals already blocked for a researched company; new
    **`outreach-tracker`** skill runs the daily due-queue, drafts follow-ups,
    detects replies via the LinkedIn inbox, and withdraws stale invites — all
    behind explicit user consent (never auto-sends).
  - **Config:** new `outreach` block in `~/.mercury/config.json` (thresholds,
    `companyBlock` cooldown default 9 months, InMail plan/allotment/reserve,
    weekly invite limit). Stored as JSON to match Mercury's existing
    single-config-file convention rather than the spec's TOML.

### Notes

- Invitation **withdrawal** (cadence #1) has no LinkedIn MCP tool, so it is
  driven via Chrome MCP browser automation in the `outreach-tracker` skill; the
  deterministic `mercury outreach withdraw` degrades gracefully (still records
  the block) when a browser withdrawal can't be confirmed.

## [0.7.0] - 2026-06-26

### Changed

- **Dashboard redesign — Linear aesthetic.** Full visual overhaul of the local
  dashboard to a dark-native, Linear-inspired theme:
  - New design tokens in `app.css`: marketing-black canvas (`#08090a`), panel
    (`#0f1011`) and elevated-surface (`#191a1b`) luminance steps, semi-transparent
    white borders, and a single chromatic accent — brand indigo `#5e6ad2` /
    violet `#7170ff`. Inter Variable is now bundled locally (no CDN) with the
    `cv01`/`ss03` OpenType features and Linear's signature 510 weight.
  - **Shell**: sidebar gains a gradient logo tile + "AI Job Companion" tagline
    and clearer active/hover nav states; a new sticky top app bar shows a
    `Workspace / {section}` breadcrumb and the live-connection indicator.
  - **Overview** rebuilt as a bento grid with a hero Profile Score (large
    display number + progress bar), accent-tinted Interviews card, wide Jobs
    Saved row, and a two-column Profile Breakdown / Pipeline Health section.
  - **Recruiters** kanban: column panels with count pills, per-status left
    accent bars, and a highlighted "Interviewing" column.
  - **Applications**: elevated table with company letter-tiles, portal/status/
    file chips and status dots; Filter / New Application / pager are present as
    visual shells (wiring to follow).
  - **Launch**: split Configuration panel / live terminal (`agent_output.log`)
    layout with a pulsing active indicator.
  - **Answers**: category sections with inset containers, `font-mono` keys,
    hover-reveal inline editing, and a de-emphasized EEO group with a
    `HUMAN-ONLY — NEVER AUTO-FILLED` lock badge.
  - Profile trend chart (uPlot) recoloured to the new palette.
- **Update affordance only shows when an update is available.** The sidebar
  footer now renders the full "Mercury X available / Update now" card *only*
  when `updateAvailable` is true; when up to date it collapses to a single
  muted `Mercury <version>` line (no "Up to date" card, no "Reinstall latest"
  button).

## [0.6.0] - 2026-06-26

### Added

- **`portal-filler` foundations (issue #7, Phases 1–5).** Groundwork for
  autofilling external ATS application forms via Chrome MCP:
  - New `applicant_answers` table — a reusable, dashboard-editable store of
    canonical answers (`contact` / `eligibility` / `links` / `eeo` / `custom`),
    with `mercury answer set` (upsert) and `mercury answer list`.
  - `applications` extended with `portal`, `external_url`, `fields_filled_json`,
    and `unfilled_json`, plus `mercury application update --id` for the
    `draft → filled → submitted` (+ `needs_input`) lifecycle. Schema bumped to
    v2 with an idempotent additive-column migration (introspects
    `PRAGMA table_info`, since SQLite has no `ADD COLUMN IF NOT EXISTS`).
  - Shared `mercury export --typ <f> --out <f.pdf>` helper that compiles Typst
    to a real PDF (what Chrome MCP `upload_file` needs), with clear guidance if
    `typst` is not installed.
  - Dashboard `applications()` query now returns the new columns and a new
    `/api/answers` route exposes the answer store.
  - `skills/portal-filler/SKILL.md` scaffold: detect ATS → snapshot →
    label-match → fill → **pause for human review** (never auto-submits, mirrors
    `recruiter-outreach`'s `confirm_send`). EEO/demographic fields are stored but
    never auto-filled; unknown fields are surfaced, never guessed. Now documents
    real-world fill mechanics validated against a live Greenhouse form: React
    input events, `intl-tel-input` phone reformatting, combobox dropdowns vs text
    inputs, async S3-backed file-upload widgets (verify the attached filename),
    and reCAPTCHA/SSO gates left to the human.
  - **Generic label→answer matcher** (`mercury match --labels '[...]'`): a
    deterministic, unit-tested mapper from live ATS form labels to stored
    `applicant_answers` (exact → synonym → fuzzy with Levenshtein/token overlap).
    Returns a `{matched, unfilled}` plan; EEO fields and fields with no stored
    answer are surfaced in `unfilled`, never guessed. Candidates rank by match
    tier then synonym specificity so a strong multi-word phrase isn't derailed by
    an incidental single-word collision (validated against a live GitLab
    Greenhouse form). 14 `bun test` cases cover the guardrails. The skill now
    calls it instead of eyeballing labels.
  - **Per-ATS adapters** (`mercury detect-portal --url`): identifies the ATS
    (Greenhouse / Lever / Ashby / generic) from the application URL and returns
    its **known stable field selectors**, widget types (`text`/`tel`/
    `native-select`/`react-select`/`listbox`/`file`), and quirk notes. Selectors
    were verified against live Greenhouse (GitLab), Lever (Binance), and Ashby
    forms; the Greenhouse selectors were re-checked live (all 5 resolve). The
    skill fills known core fields by selector for reliability, then falls back to
    the generic matcher for per-posting custom questions. 14 `bun test` cases
    cover detection + field specs (25 portal-filler tests total).
  - **Dashboard Answers tab + Applications badges.** A new **Answers** section
    edits the reusable answer store inline (add / edit, grouped by category) via
    a new `POST /api/answer` upsert route that live-broadcasts the change. The
    **Applications** table now shows the `portal` and lifecycle status
    (`draft`/`filled`/`submitted`/`needs_input`) as pills and links the row to
    the `external_url`.
  - **Docs + install.** `portal-filler` is auto-installed by `mercury setup`
    (it copies the whole `skills/` dir); README and AGENTS.md now document the
    skill, the application CLI (`answer`/`match`/`detect-portal`/`export`/
    `application update`), and that Workday/Taleo/iCIMS and opt-in auto-submit
    remain future work.



### Fixed

- **Dashboard "shows nothing then suddenly shows results" bug.** Every section
  initialized to an empty list with no loading flag and swallowed fetch errors,
  so the "run the skill" empty state rendered immediately until the async fetch
  resolved — and a failed fetch looked identical to genuinely empty. Sections now
  use an explicit loading / error / empty / data state machine: a loading
  placeholder shows first, real fetch errors surface with a Retry button, and the
  "run the skill" CTA appears only when a table is truly empty.
- **Dashboard slow first load.** `/api/acp/providers` shelled out to
  `opencode models` and `claude config list` via blocking `spawnSync` on every
  call (~17s, no caching; `claude config list` hung and ignored the kill). Model
  enumeration is now async with a hard 4s timeout, memoized per provider, and
  warmed in the background at startup — the endpoint went from ~17s to ~2ms.
- **Applications with no linked job rendered blank.** Rows now derive a readable
  "Role / Target" label from the artifact filename and are flagged `· unlinked`.

### Changed

- **Dashboard live-updates are now table-scoped.** A DB change refreshes only the
  affected section (+ Overview badges) instead of refetching every mounted
  section. The sidebar "live/offline" dot now reflects the real WebSocket state.
- **Dashboard UI modernized** to Tailwind v4 with Bits UI headless primitives and
  Lucide icons. The whole frontend was moved to Tailwind utilities + shared
  component classes (no per-component `<style>` blocks); the Search tabs and the
  Launch agent/model/skill pickers now use accessible Bits UI Tabs and Select
  (proper roles, keyboard nav), and the unicode-glyph nav was replaced with Lucide
  icons. Dark theme and colors preserved.

## [0.4.0] - 2026-06-26

### Added

- Windows prebuilt binary (`windows-x64`). The release workflow now cross-compiles
  a `mercury-windows-x64.exe`, and `bootstrap.sh` installs it when run under Git
  Bash / MSYS / Cygwin. (No `windows-arm64` prebuilt — Bun can't compile it; that
  platform falls back to a source build.)
- **job-scout**: support pasted LinkedIn Jobs search URLs — parses `f_C`
  (multi-company URN list), `geoId`, `f_TPR`, `keywords`, `sortBy`, and pagination,
  and reproduces the search (via Chrome MCP, with a LinkedIn-MCP per-company
  fallback). Adds an auto-widening recency window that progressively broadens
  (5.5h → 24h → 7d → 30d) when nothing recent is found and reports how far it
  widened. Configurable via `[job_scout]` in `config.toml`. (#4)

### Changed

- Moved the architecture diagram from `.assets/` to `.github/assets/`.

## [0.3.1] - 2026-06-26

### Fixed

- `mercury setup` now works on clean prebuilt installs. When no local skills
  source exists, it downloads the version-matched skills tarball from GitHub and
  caches it at `~/.mercury/skills-cache/<version>/`. Previously, prebuilt
  installs had no `skills/` source to copy from (the bootstrap fetches skills to
  a temp directory), so setup only worked on machines with a leftover source
  clone.

## [0.3.0] - 2026-06-26

### Added

- `mercury setup` command that detects installed agents (opencode, Claude Code,
  Cursor, Codex, `~/.agents`) and installs the Mercury skills into each.
- Dynamic agent model selection, with a sensible default model.
- `AGENTS.md` documenting the project for AI coding agents.

### Changed

- Slimmed the README and hoisted the install one-liner to the top.

## [0.2.0] - 2026-06-26

### Added

- Prebuilt release binaries (linux/darwin × x64/arm64) published via CI on tag
  push, with checksum verification.
- Version tracking plus an "update available" notice driven by GitHub Releases.
- One-line `curl | bash` bootstrap installer that installs and updates Mercury.
- Mercury dashboard: CLI, SQLite storage, and a local web hub (Phases 0–1).
- Hybrid search via an embedded LinkedIn MCP client (Phase 2).
- Multi-provider ACP agent integration (Phase 3).
- Single-binary packaging, installer, and docs (Phase 4).
- `experience-bank` skill.
- Profile breakdown in the Overview and Profile views, plus a Scan/Re-scan
  button.

### Changed

- Rebranded the project to **Mercury** — a tool-agnostic job-search companion —
  and made the skills agent-agnostic.
- Swapped the Playwright MCP for the Chrome MCP across skills and docs.
- Plannotator-style centered README header with a hero banner.

### Fixed

- Cache-bust the update check to avoid raw CDN staleness.
- Bootstrap script: use ASCII `...` instead of a multibyte ellipsis.

[Unreleased]: https://github.com/Daniel-Boll/mercury/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/Daniel-Boll/mercury/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Daniel-Boll/mercury/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Daniel-Boll/mercury/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/Daniel-Boll/mercury/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Daniel-Boll/mercury/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Daniel-Boll/mercury/releases/tag/v0.2.0
