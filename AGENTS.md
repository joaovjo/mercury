# AGENTS.md

Working notes for AI agents (and humans) contributing to **Mercury**. This file
holds the project conventions, architecture, build/dev workflow, and gotchas that
don't belong in the user-facing README.

## What Mercury is

A job-search companion split into two halves:

1. **Skills** (`skills/*/SKILL.md`) — plain-markdown agent skills loaded by any
   skill-aware assistant (opencode, Claude Code, Cursor, …). They orchestrate the
   LinkedIn MCP + Chrome MCP and persist results through the `mercury` CLI.
2. **App** (`app/`) — a Bun + TypeScript CLI that is BOTH the dashboard launcher
   AND the write API the skills call. Ships as a single compiled binary with the
   Svelte UI embedded.

## Architecture

```
skills  ──(agent runs `mercury …` via bash)──▶  ~/.mercury/mercury.db  (SQLite, WAL)
                                                        ▲
mercury dashboard ──Bun.serve + WebSocket──────────────┘   (reads + live-updates)
                  ├─ MCP client  → LinkedIn MCP   (hybrid instant search)
                  └─ ACP client  → opencode / Claude Code   (Launch tab runs skills)
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
app/
├── src/
│   ├── cli/        # command entry + write subcommands + setup
│   ├── db/         # schema, connection (bun:sqlite, WAL), change notify
│   ├── server/     # Bun.serve dashboard, REST/WS, queries, embedded assets
│   ├── mcp/        # LinkedIn MCP client + hybrid search
│   ├── acp/        # ACP client, provider registry, session manager
│   └── paths.ts    # ~/.mercury path resolution + config
└── web/            # Svelte 5 dashboard (Vite build → embedded into the binary)
skills/             # the agent skills (copied into agent dirs by `mercury setup`)
bootstrap.sh        # curl|bash installer/updater (prebuilt binary + source fallback)
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
cd app
bun install
bun run dev                 # run the CLI from source: bun run src/cli/index.ts
bun run typecheck           # tsc --noEmit  (must pass before committing)
bun run build               # build:web → embed assets → compile single binary
```

`bun run build` chains:
1. `build:web` — Vite builds the Svelte app to `app/web/dist`
2. `embed` — `scripts/embed-assets.ts` inlines `web/dist` as base64 into
   `src/server/assets.gen.ts` (so the binary is self-contained)
3. `build:bin` — `bun build --compile` → `app/dist/mercury`

> **Convention:** `app/src/server/assets.gen.ts` is a **generated, gitignored**
> artifact (issue #20) — never commit or hand-edit it. `dev`, `typecheck`, `test`,
> and `build:bin` auto-create an empty stub via `scripts/ensure-assets.ts` if it's
> missing (a fresh clone needs no web build to type-check or test). The full
> `build`/`build:targets` overwrite it with the real base64 bundle via `embed`.
> Only the compiled binary uses the embedded assets; source/dev runs serve the UI
> from `web/dist` on disk.

### Installing your local build

```bash
install -m 755 app/dist/mercury ~/.local/bin/mercury
mercury setup --all           # copy skills into every detected agent
```

## Conventions

- **No new SQL outside `db/`/CLI.** Add a write subcommand instead.
- **bun:sqlite named params** can't use a `$status` JS shorthand key — that's not
  a valid identifier. Type binding objects as `Record<string,string|number|null>`.
- **`Bun.serve<WSData>`** takes a single generic in this Bun version (not two).
- **Svelte 5 runes**: `bind:this` targets must be declared with `$state()` or
  the effect that uses them won't re-run.
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

The workflow pins `app/package.json` to the tag, cross-compiles all five targets
(`linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `windows-x64.exe`) with
`bun build --compile --target=…`, writes `SHA256SUMS`, and attaches them to a
GitHub Release. The bootstrap then downloads the prebuilt binary (SHA-verified),
falling back to a source build if no target matches.

### Changelog → release notes

Before tagging, add a section to `CHANGELOG.md` for the new version using the
[Keep a Changelog](https://keepachangelog.com/) format
(`## [X.Y.Z] - YYYY-MM-DD`). The release workflow runs
`scripts/extract-changelog.sh <version>` to pull that section and use it as the
GitHub Release body. If no matching section exists, it falls back to GitHub's
auto-generated notes (so a missing entry won't fail the release — but always add
one). Keep an `## [Unreleased]` section at the top for in-flight changes.

### Update check internals

`mercury` checks the [Releases API](https://api.github.com/repos/Daniel-Boll/mercury/releases/latest)
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
