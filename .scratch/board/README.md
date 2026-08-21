# 📋 Mercury Project Board (Scrum & Kanban)

<div align="center">

![Project](https://img.shields.io/badge/project-Mercury-blue?style=for-the-badge&logo=compass&logoColor=white)
![Engine](https://img.shields.io/badge/runtime-bun-fbf0df?style=for-the-badge&logo=bun&logoColor=black)
![Sprint](https://img.shields.io/badge/sprint-Sprint%201%20(Conclu%C3%ADda)-success?style=for-the-badge)
![Status](https://img.shields.io/badge/board%20status-completed-brightgreen?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

<p align="center">
  <b>Quadro Ágil do Projeto Mercury</b> — Gerenciamento de tarefas, sprints, governança técnica e colaboração multi-agente.
</p>

</div>

---

## 📌 Navegação Rápida

- 🚀 **[Sprint Ativa / Concluída (Sprint 1)](file:///d:/mercury/.scratch/board/SPRINT.md)**: Metas, DoR, DoD e métricas da sprint.
- 👥 **[Time de Agentes (TEAM.md)](file:///d:/mercury/.scratch/board/TEAM.md)**: Definição dos papéis autônomos (`@lead-architect`, `@bun-dev`, `@test-qa`, `@reviewer`) e matriz RACI.
- 📝 **[Template de Card](file:///d:/mercury/.scratch/board/templates/TASK_TEMPLATE.md)**: Modelo padrão para criação de novas tarefas.
- 📐 **[Planos Técnicos & Arquiteturais](file:///d:/mercury/.scratch/plans/)**: Documentos de design técnico, épicos e especificações.

---

## 📊 Visão Geral do Quadro Kanban

```
┌───────────────────────────┬───────────────────────────┬───────────────────────────┬───────────────────────────┬───────────────────────────┐
│ 01 · Product Backlog (0)  │ 02 · Sprint Backlog (0)   │ 03 · In Progress (0)      │ 04 · In Review (0)        │ 05 · Done (4)             │
├───────────────────────────┼───────────────────────────┼───────────────────────────┼───────────────────────────┼───────────────────────────┤
│ (vazio - itens refinados) │ (todos concluídos)        │ (todos concluídos)        │ (todos concluídos)        │ MERC-001: 38 Provedores   │
│                           │                           │                           │                           │ MERC-002: Descoberta Mod. │
│                           │                           │                           │                           │ MERC-003: Flags CLI/Conf. │
│                           │                           │                           │                           │ MERC-004: Testes Unitários│
└───────────────────────────┴───────────────────────────┴───────────────────────────┴───────────────────────────┴───────────────────────────┘
```

---

## 📂 Colunas & Cards

### 📥 [01 · Product Backlog](file:///d:/mercury/.scratch/board/01-product-backlog)
*Ideias, épicos e itens futuros aguardando refinamento para próximas sprints.*
- *(Nenhum item pendente no Product Backlog geral)*

---

### 📋 [02 · Sprint Backlog (Sprint 1)](file:///d:/mercury/.scratch/board/02-sprint-backlog)
*Itens selecionados e priorizados para a Sprint 1.*
- *(Todos os cards foram implementados, testados, aprovados e movidos para 05 · Done)*

---

### ⚙️ [03 · In Progress](file:///d:/mercury/.scratch/board/03-in-progress)
*Itens em desenvolvimento ativo.*
- *(Nenhum item em desenvolvimento ativo no momento)*

---

### 🔍 [04 · In Review / QA](file:///d:/mercury/.scratch/board/04-in-review)
*Itens com código pronto aguardando testes de conformidade, regressão e auditoria de padrões.*
- *(Nenhum item pendente de revisão — 100% dos cards aprovados)*

---

### ✅ [05 · Done](file:///d:/mercury/.scratch/board/05-done)
*Itens entregues, com testes 100% aprovados, typecheck limpo e DoD satisfeita.*

| ID | Tarefa | Responsável | Prioridade | Tipo | SemVer | Pontos |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| [`MERC-001`](file:///d:/mercury/.scratch/board/05-done/MERC-001-acp-providers-registry.md) | Expansão do catálogo de 38 Provedores ACP em `providers.ts` | `@bun-dev` | `high` | `feat` | `minor` | 3 pts |
| [`MERC-002`](file:///d:/mercury/.scratch/board/05-done/MERC-002-universal-model-discovery.md) | Descoberta Universal de Modelos via Bun Shell & ACP Handshake | `@bun-dev` | `high` | `feat` | `minor` | 5 pts |
| [`MERC-003`](file:///d:/mercury/.scratch/board/05-done/MERC-003-cli-provider-flags-and-config.md) | Suporte a Provedores Dinâmicos na Configuração e CLI | `@bun-dev` | `medium` | `feat` | `minor` | 2 pts |
| [`MERC-004`](file:///d:/mercury/.scratch/board/05-done/MERC-004-acp-providers-unit-tests.md) | Cobertura de Testes Unitários dos Provedores ACP com `bun test` | `@test-qa` | `high` | `test` | `patch` | 3 pts |

---

## 🛠️ Convenções e Diretrizes Obrigatórias

1. **Branches**: Todas as branches devem seguir a convenção [Conventional Branch](https://conventionalbranch.org/pt-br/):
   - Exemplo: `feat/MERC-001-acp-providers-registry`, `fix/MERC-002-...`, `test/MERC-004-...`
2. **Commits**: Mensagens de commit estritamente formatadas com [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/) e [iuricode](https://github.com/iuricode/padroes-de-commits):
   - Formato: `<tipo>[escopo]: <descrição>`
   - Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
3. **SemVer**: Todas as alterações devem indicar seu impacto semântico ([SemVer 2.0.0](https://semver.org/lang/pt-BR/)):
   - `MAJOR` (breaking changes), `MINOR` (novas features compatíveis), `PATCH` (correções e testes).
4. **Runtime**: **Uso exclusivo de Bun** (`bun`, `bunx`, `import { $ } from "bun"`). Proibido uso de Node, npm, yarn ou pnpm.
5. **Privacidade e PII**: **NUNCA** commitar dados pessoais reais. Utilizar sempre identidades sintéticas nos testes e fixtures conforme `AGENTS.md`.
