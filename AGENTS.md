# AGENTS.md

Working notes for AI agents (and humans) contributing to **Mercury**. This file
holds the project conventions, architecture, build/dev workflow, and gotchas that
don't belong in the user-facing README.

## What Mercury is

A job-search companion split into two halves:

1. **Skills** (`skills/*/SKILL.md`) — plain-markdown agent skills loaded by any
   skill-aware assistant (opencode, Claude Code, Cursor, …). They orchestrate the
   LinkedIn MCP + Chrome MCP and persist results through the `mercury` CLI.
2. **App & Packages** (`apps/*`, `packages/*`) — a Bun workspace monorepo providing
   the CLI (`apps/cli`), React dashboard (`apps/web`), TUI (`apps/tui`), and modular
   libraries (`@mercury/*` packages). Ships as a single compiled binary (`dist/mercury`)
   with the React UI embedded.

## Architecture

```
skills  ──(agent runs `mercury …` via bash)──▶  ~/.mercury/mercury.db  (SQLite, WAL)
                                                        ▲
mercury dashboard ──Bun.serve + WebSocket──────────────┘   (reads + live-updates)
                  ├─ MCP client  → LinkedIn MCP   (hybrid instant search)
                  ├─ ACP client  → opencode / Claude Code   (Launch tab runs skills)
                  └─ A2A agent   → /.well-known/agent.json  (Agent-to-Agent protocol)
```

- **One schema, one source of truth.** Every mutation goes through the `mercury`
  CLI write subcommands (`recruiter`, `job`, `metric`, `score`, `interview`,
  `application`, `answer`, `activity`). Read/utility helpers: `match`,
  `detect-portal`, `export`. Never have a skill write SQL or markdown directly.
  (The dashboard's Answers tab writes via `POST /api/answer`, which uses the same
  upsert as `mercury answer set` and broadcasts a `changed` event.)
- After a write the CLI pings a running dashboard via `~/.mercury/dashboard.lock`
  (`{port,token}`) so the UI live-refreshes over WebSocket.
- Server binds `127.0.0.1` on a random port with a URL token. Never expose it.

### Key directories

```
apps/
├── cli/            # @mercury/cli: binary entrypoint, subcommands, setup, TUI runner
├── web/            # @mercury/web: React 19 dashboard (Tailwind v4, shadcn, Phosphor)
└── tui/            # @mercury/tui: OpenTUI terminal interface

packages/
├── core/           # @mercury/core: paths, config, version, update checks
├── db/             # @mercury/db: schema, SQLite connection (bun:sqlite, WAL), notify
├── outreach/       # @mercury/outreach: relationship-memory engine, store, budget
├── recruiter/      # @mercury/recruiter: sync (accepted-invite detection)
├── ats/            # @mercury/ats: ATS form-label matcher & adapter registries
├── acp/            # @mercury/acp: ACP client, session manager, provider registry
├── mcp/            # @mercury/mcp: LinkedIn MCP client, hybrid search, browser cleanup
├── a2a/            # @mercury/a2a: A2A protocol (Agent Card, JSON-RPC 2.0 task server)
└── server/         # @mercury/server: Bun.serve dashboard server, WebSocket, REST/A2A

scripts/
├── embed-assets.ts     # inlines apps/web/dist base64 into packages/server/src/assets.ts
├── build-targets.ts    # cross-compiles all release targets into dist/
└── extract-changelog.sh# parses CHANGELOG.md for release notes
skills/                 # agent skills (copied into agent dirs by `mercury setup`)
```

### The `.mercury/` user data dir

Per-user job-search state lives at `~/.mercury/` (override with `MERCURY_HOME`):

```
~/.mercury/
├── mercury.db           # SQLite (WAL): recruiters, jobs, metrics, interviews, …
├── config.json          # provider + preferences
├── dashboard.lock        # {port,token,pid} of a running dashboard
├── update-check.json     # cached release-check result
├── src/                  # repo clone (bootstrap source path) — `mercury setup` reads skills here
├── base/ experience/ tailored/ cover-letters/ reports/ logs/   # resume-tailor + experience-bank artifacts
```

## Build & dev

Requires [Bun](https://bun.sh).

```bash
bun install --linker hoisted
bun run dev                 # run CLI from source: bun run --filter @mercury/cli dev
bun run dev:web             # run dashboard dev server
bun run dev:tui             # run OpenTUI interactive app
bun run typecheck           # tsc --noEmit (must pass before committing)
bun test                    # run test suite
bun run build               # build:web → embed assets → compile single binary (dist/mercury)
```

`bun run build` chains:
1. `build:web` — Bun builds the React app to `apps/web/dist`
2. `embed` — `scripts/embed-assets.ts` inlines `apps/web/dist` as base64 into
   `packages/server/src/assets.ts` (so the binary is self-contained)
3. `build:bin` — `bun build apps/cli/src/index.ts --compile` → `dist/mercury`

> **Convention:** `packages/server/src/assets.ts` contains an empty stub by default
> (safe for dev/test runs without a prebuilt web UI). Running `embed` writes the
> real base64 bundle into it.

### Installing your local build

```bash
bun run install:bin         # install -m 755 dist/mercury ~/.local/bin/mercury
mercury setup --all         # copy skills into every detected agent
```

## Conventions

- **No new SQL outside `db/`/CLI.** Add a write subcommand instead.
- **bun:sqlite named params** can't use a `$status` JS shorthand key — that's not
  a valid identifier. Type binding objects as `Record<string,string|number|null>`.
- **`Bun.serve<WSData>`** takes a single generic in this Bun version (not two).
- **React 19 + react-intl**: all user-facing strings go through `<FormattedMessage>`
  or `intl.formatMessage()`. Add new keys to both `web/src/locales/en-US.json` and
  `web/src/locales/pt-BR.json`. Never hardcode visible text in components.
- **shadcn components** live in `web/src/components/ui/`; common patterns (loading,
  error states) are in `web/src/components/common/`.
- **ACP**: providers live in `src/acp/providers.ts`. Each returns `{cmd, env?}`.
  Model selection is threaded as an optional `model` → `OPENCODE_CONFIG_CONTENT`
  (opencode) or `ANTHROPIC_MODEL` (Claude Code). Model lists come from
  `opencode models` / `claude config list` at runtime.
- **Skills persist via the CLI.** When adding a skill capability that produces
  trackable data, add the matching `mercury …` call to its SKILL.md and a write
  subcommand if needed.
- **NEVER commit real personal data.** Tests, fixtures, code comments, example
  strings, commit messages, PR/issue text, and skill docs must use *synthetic*
  identities only (`Recruiter One`, `Acme Corp`, slugs like `recruiter-one-000001`,
  diacritic cases like `Renée Würst`). No real human names, real LinkedIn
  usernames/slugs, real companies tied to a real person, or the maintainer's own
  identity. Real outreach data lives ONLY in the gitignored `~/.mercury/mercury.db`.
  This repo is public — third-party PII must never enter git history. Grep-verify
  before committing.

## Releases (maintainers)

CI (`.github/workflows/release.yml`) builds and publishes on tag push:

```bash
git tag v0.3.0 && git push origin v0.3.0
```

The workflow pins `package.json` to the tag, cross-compiles all five targets
(`linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `windows-x64.exe`) via
`scripts/build-targets.ts`, writes `SHA256SUMS`, and attaches them to a
GitHub Release.

### Changelog → release notes

Before tagging, add a section to `CHANGELOG.md` for the new version using the
[Keep a Changelog](https://keepachangelog.com/) format
(`## [X.Y.Z] - YYYY-MM-DD`). The release workflow runs
`scripts/extract-changelog.sh <version>` to pull that section and use it as the
GitHub Release body. If no matching section exists, it falls back to GitHub's
auto-generated notes (so a missing entry won't fail the release — but always add
one). Keep an `## [Unreleased]` section at the top for in-flight changes.

### Update check internals

`mercury` checks the [Releases API](https://api.github.com/repos/joaovjo/mercury/releases/latest)
at most once per 10h (cached in `~/.mercury/update-check.json`) and prints a
one-line stderr notice when a newer tag exists. Best-effort: short timeout, never
blocks, silent when offline. Disable with `MERCURY_NO_UPDATE_CHECK=1`; redirect
with `MERCURY_UPDATE_URL`.

## Gotchas (operational)

- LinkedIn analytics aren't API-exposed — they enter the system only when
  `profile-optimizer` runs and calls `mercury metric record --breakdown '…'`.
- The dashboard can't scrape LinkedIn itself; the **Launch → Scan** button drives
  `profile-optimizer` over ACP to refresh metrics.
- Backgrounded dev servers die when a parent shell command times out — use
  `nohup … & disown` when testing the dashboard across shell invocations.
