# Changelog

All notable changes to Mercury are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Daniel-Boll/mercury/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/Daniel-Boll/mercury/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Daniel-Boll/mercury/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Daniel-Boll/mercury/releases/tag/v0.2.0
