# BRIEFING — 2026-08-20T22:47:38-03:00

## Mission
Efetuar o levantamento minucioso de requisitos, contratos, comportamentos observados, casos de borda e especificações de todos os entregáveis da Sprint 1 do Mercury (MERC-001 a MERC-004 e governança R5).

## 🔒 My Identity
- Archetype: Specification Miner
- Roles: Spec Miner, Teamwork specialist
- Working directory: D:\mercury\.agents\spec_miner_1
- Original parent: 14797777-1978-436e-9d81-2eb87bfbdccd
- Milestone: Sprint 1 (v0.4.0)

## 🔒 Key Constraints
- Não implementar código (somente levantamento, descoberta e especificação analítica)
- Sempre conversar e gerar documentação em PT-BR
- Host Windows 11 Pro / PowerShell 7.x
- Runtime 100% Bun / bunx (sem node, npm, yarn, pnpm)
- Zero PII (dados reais) nas fixtures e especificações
- Conventional Commits, Conventional Branch, SemVer 2.0.0

## Current Parent
- Conversation ID: 14797777-1978-436e-9d81-2eb87bfbdccd
- Updated: 2026-08-20T22:47:38-03:00

## Task Summary
- **What to build**: Mapeamento detalhado dos 38 provedores ACP, descoberta de modelos via handshake JSON-RPC e Bun Shell, configuração e flags dinâmicas, suíte de testes unitários em bun:test e governança do Kanban.
- **Success criteria**: Especificação completa de todos os 38 provedores, fluxo de handshake stdio, regras de cache e timeout, contratos de interface e plano de testes.
- **Interface contracts**: `app/src/acp/providers.ts`, `app/src/paths.ts`, `app/src/server/index.ts`
- **Code layout**: `app/src/acp/`, `app/src/server/`, `.scratch/board/`

## Key Decisions Made
- Análise estática profunda dos 38 provedores já estruturados em `providers.ts`
- Mapeamento detalhado de cada comando, env var, binário e modelos padrão
- Especificação formal do protocolo JSON-RPC 2.0 ACP stdio para o handshake `initialize` -> `session/new`
- Mapeamento dos cenários de teste unitário para Bun Test

## Artifact Index
- D:\mercury\.agents\spec_miner_1\DISPATCH.md — Registro de despachos
- D:\mercury\.agents\spec_miner_1\progress.md — Log de progresso e batimento cardíaco
- D:\mercury\.agents\spec_miner_1\spec_report.md — Relatório completo de especificação da Sprint 1
- D:\mercury\.agents\spec_miner_1\handoff.md — Handoff formal de 5 componentes
