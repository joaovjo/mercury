# 🚀 Sprint 1: Expansão Universal de Agentes ACP com Bun Nativo

<div align="center">

![Sprint](https://img.shields.io/badge/sprint-1%20(Conclu%C3%ADda)-success?style=for-the-badge)
![Status](https://img.shields.io/badge/status-done-brightgreen?style=for-the-badge)
![Total Points](https://img.shields.io/badge/story--points-13%20pts-blueviolet?style=for-the-badge)
![Target Version](https://img.shields.io/badge/release-v0.4.0-blue?style=for-the-badge)

</div>

---

## 🎯 Meta da Sprint (Sprint Goal)

> Expandir o suporte a agentes do **Agent Client Protocol (ACP)** de 2 para todos os **38 provedores** do catálogo oficial, implementando descoberta universal de modelos via Bun Shell e handshake ACP stdio, com cobertura de testes unitários em Bun e zero dependência de ecossistema externo de pacotes.

---

## 📅 Informações da Sprint

- **Status**: Concluída com Sucesso (100% Done)
- **Plano de Referência**: [`implementation_plan.md`](file:///d:/mercury/.scratch/plans/implementation_plan.md)
- **Story Points Totais**: 13 pts
- **Pontos Concluídos & Aprovados**: 13 pts (100%)

---

## 📋 Definition of Ready (DoR)

Para um card ser puxado do `01-product-backlog/` para o `02-sprint-backlog/`, ele deve satisfazer:
- [x] Card criado com base no template oficial [TASK_TEMPLATE.md](file:///d:/mercury/.scratch/board/templates/TASK_TEMPLATE.md).
- [x] História de usuário e contexto técnico claramente definidos.
- [x] Critérios de aceite explícitos e verificáveis.
- [x] Nomenclatura da branch definida segundo [Conventional Branch](https://conventionalbranch.org/pt-br/).
- [x] Impacto [SemVer 2.0.0](https://semver.org/lang/pt-BR/) e tipo de commit mapeados.
- [x] Agente responsável (`assignee`) atribuído.

---

## 🏁 Definition of Done (DoD)

Para um card ser movido para `05-done/`, ele deve satisfazer:
- [x] Código TypeScript limpo, sem `any` desnecessário e respeitando convenções do repositório.
- [x] Runtime 100% Bun (`bun`, `bunx`, `import { $ } from "bun"`) sem Node/npm/pnpm/yarn.
- [x] `bun run typecheck` passando sem nenhum erro ou warning.
- [x] Testes unitários com `bun test` executando com sucesso.
- [x] Nenhum dado sensível ou pessoal (PII) adicionado ao código ou histórico do Git.
- [x] Commits no formato [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/).
- [x] Revisão aprovada por `@reviewer`.

---

## 📊 Backlog da Sprint 1

| ID | Tarefa | Responsável | Tipo | SemVer | Pontos | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| [`MERC-001`](file:///d:/mercury/.scratch/board/05-done/MERC-001-acp-providers-registry.md) | Expansão do catálogo de 38 Provedores ACP em `providers.ts` | `@bun-dev` | `feat` | `minor` | 3 pts | `done` |
| [`MERC-002`](file:///d:/mercury/.scratch/board/05-done/MERC-002-universal-model-discovery.md) | Descoberta Universal de Modelos via Bun Shell & ACP Handshake | `@bun-dev` | `feat` | `minor` | 5 pts | `done` |
| [`MERC-003`](file:///d:/mercury/.scratch/board/05-done/MERC-003-cli-provider-flags-and-config.md) | Suporte a Provedores Dinâmicos na Configuração e CLI | `@bun-dev` | `feat` | `minor` | 2 pts | `done` |
| [`MERC-004`](file:///d:/mercury/.scratch/board/05-done/MERC-004-acp-providers-unit-tests.md) | Cobertura de Testes Unitários dos Provedores ACP com `bun test` | `@test-qa` | `test` | `patch` | 3 pts | `done` |
