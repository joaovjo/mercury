# Changelog

All notable changes to Mercury are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Daniel-Boll/mercury/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/Daniel-Boll/mercury/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Daniel-Boll/mercury/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/Daniel-Boll/mercury/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Daniel-Boll/mercury/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Daniel-Boll/mercury/releases/tag/v0.2.0
