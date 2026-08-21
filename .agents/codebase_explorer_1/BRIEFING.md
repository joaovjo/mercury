# BRIEFING — 2026-08-20T22:50:00Z

## Mission
Investigar o código-fonte existente do Mercury relacionado ao ACP e ao servidor, mapeando a arquitetura e definindo a estratégia técnica de implementação para R1 (38 Provedores), R2 (Descoberta Universal de Modelos), R3 (Provedores Dinâmicos e Configuração) e R4 (Testes Unitários com Bun Test).

## 🔒 My Identity
- Archetype: explorer
- Roles: codebase-explorer, synthesis
- Working directory: D:\mercury\.agents\codebase_explorer_1
- Original parent: 14797777-1978-436e-9d81-2eb87bfbdccd
- Milestone: Sprint 1 (MERC-001, MERC-002, MERC-003, MERC-004)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- PT-BR communication
- Host OS: Windows 11 Pro, Shell: PowerShell 7.x
- Bun native runtime (bun/bunx, Bun.spawn, Bun Shell)
- Conventional commits / branch
- No real PII data

## Current Parent
- Conversation ID: 14797777-1978-436e-9d81-2eb87bfbdccd
- Updated: 2026-08-20T22:50:00Z

## Investigation State
- **Explored paths**:
  - `d:\mercury\app\src\acp\providers.ts`
  - `d:\mercury\app\src\acp\client.ts`
  - `d:\mercury\app\src\acp\session.ts`
  - `d:\mercury\app\src\acp\session.test.ts`
  - `d:\mercury\app\src\paths.ts`
  - `d:\mercury\app\src\server\index.ts`
  - `d:\mercury\app\src\cli\index.ts`, `flags.ts`, `setup.ts`, `skills.ts`
  - `d:\mercury\app\web\src\sections\LaunchSection.tsx`, `types.ts`
  - `d:\mercury\app\package.json`
- **Key findings**:
  - R1: `PROVIDERS` em `providers.ts` contém 39 provedores do ACP Registry oficial com comandos `bunx` e binários específicos.
  - R2: Descoberta de modelos via `listProviderModels` com cache de 5 minutos, Bun Shell (`$`) para OpenCode e `probeAcpAgentModels` via handshake stdio JSON-RPC (`initialize` → `session/new`).
  - R3: `MercuryConfig.provider` em `paths.ts` e rota `/api/acp/providers` em `server/index.ts` suportam provedores dinâmicos e background warming.
  - R4: Necessidade de implementar `app/src/acp/providers.test.ts` cobrindo validação de todos os 38 provedores, comandos, fallbacks e timeouts.
- **Unexplored areas**: Nenhuma pendência crítica para o escopo de exploração da Sprint 1.

## Key Decisions Made
- Estruturado relatório completo de handoff (`handoff.md`) com mapeamento linha por linha, cadeia lógica e plano de testes.

## Artifact Index
- `D:\mercury\.agents\codebase_explorer_1\DISPATCH.md` — Histórico de despacho
- `D:\mercury\.agents\codebase_explorer_1\BRIEFING.md` — Memória persistente
- `D:\mercury\.agents\codebase_explorer_1\progress.md` — Heartbeat de progresso
- `D:\mercury\.agents\codebase_explorer_1\handoff.md` — Relatório de Handoff Técnico
