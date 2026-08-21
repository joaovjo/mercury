# BRIEFING — 2026-08-20T23:07:30-03:00

## Mission
Adversarially challenge ACP providers registry and model discovery implementation (MERC-001, MERC-002, MERC-004), testing edge cases, cache TTL, Windows subprocess safety, and empirical robustness.

## 🔒 My Identity
- Archetype: empirical-challenger
- Roles: critic, specialist
- Working directory: D:\mercury\.agents\challenger_1
- Original parent: 14797777-1978-436e-9d81-2eb87bfbdccd
- Milestone: Sprint 1 (MERC-001 / MERC-002 / MERC-004)
- Instance: 1 of 1

## 🔒 Key Constraints
- Review-only — do NOT modify implementation code directly unless providing reproduction scripts
- Always speak PT-BR
- Host: Windows 11 / PowerShell 7.x
- Use Bun only (bun test, bunx) - never node/npm/yarn/pnpm
- Synthetic identities only, zero real PII
- Must produce empirical evidence (execute actual tests / harnesses)

## Current Parent
- Conversation ID: 14797777-1978-436e-9d81-2eb87bfbdccd
- Updated: not yet

## Review Scope
- **Files to review**: D:\mercury\app\src\acp\providers.ts, D:\mercury\app\src\acp\providers.test.ts
- **Interface contracts**: C:\Users\joaovjo\.gemini\antigravity-cli\brain\8e1f8993-c3b6-4a0a-8ab1-fd31d7e1915c\ORIGINAL_REQUEST.md, D:\mercury\AGENTS.md
- **Review criteria**: 38 providers registry integrity, model discovery (JSON-RPC handshake, Bun shell, static fallback), cache TTL (5 min), edge cases handling, Windows subprocess stability/deadlock avoidance.

## Attack Surface
- **Hypotheses tested**:
  - Direct index access on `PROVIDERS[id]` with prototype property names (`toString`, `constructor`, `valueOf`, etc.) fails to trigger nullish fallback.
  - Subprocess timeouts and uncleared `setTimeout` timers keep event loops active.
  - Concurrent `listProviderModels` calls on `/api/acp/providers` trigger stampede of 38 subprocesses simultaneously.
  - Special characters, null/undefined, whitespace inputs handling.
- **Vulnerabilities found**:
  - `getProvider("toString")` returns `Object.prototype.toString` function instead of fallback provider `PROVIDERS.opencode`, leading to `TypeError: p.command is not a function`.
  - Uncleared `setTimeout` in `runWithTimeout` and `probeAcpAgentModels`.
  - Cache stampede on dashboard startup (`Promise.all` probing 38 agents in parallel without concurrency throttle or in-flight deduplication).
- **Untested angles**:
  - Real stdio responses from live third-party CLI agents (tested via synthetic mocks and timeout bounds).

## Loaded Skills
- None

## Key Decisions Made
- Discovered prototype lookup flaw in `getProvider`.
- Added adversarial test cases to `app/src/acp/providers.test.ts`.
- Issued `REQUEST_CHANGES` verdict for developer agent to apply `Object.hasOwn(PROVIDERS, id)` and timer cleanup.

## Artifact Index
- D:\mercury\.agents\challenger_1\DISPATCH.md
- D:\mercury\.agents\challenger_1\BRIEFING.md
- D:\mercury\.agents\challenger_1\progress.md
- D:\mercury\.agents\challenger_1\handoff.md
