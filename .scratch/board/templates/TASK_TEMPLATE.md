---
id: MERC-XXX
title: "Título claro e objetivo da tarefa"
status: "sprint-backlog" # product-backlog | sprint-backlog | in-progress | in-review | done
priority: "medium"       # low | medium | high | critical
type: "feat"             # feat | fix | docs | style | refactor | perf | test | build | ci | chore
semver: "minor"          # major | minor | patch
story_points: 3
sprint: "Sprint 1"
plan_ref: ".scratch/plans/kanban_board_system_plan.md"
branch: "feat/MERC-XXX-short-description"
assignee: "@bun-dev"      # @lead-architect | @bun-dev | @test-qa | @reviewer
created_at: "YYYY-MM-DD"
updated_at: "YYYY-MM-DD"
---

# MERC-XXX: Título da Tarefa

<div align="center">

![Status](https://img.shields.io/badge/status-sprint--backlog-lightgrey?style=for-the-badge)
![Priority](https://img.shields.io/badge/priority-medium-yellow?style=for-the-badge)
![Type](https://img.shields.io/badge/type-feat-blue?style=for-the-badge)
![SemVer](https://img.shields.io/badge/semver-minor-brightgreen?style=for-the-badge)
![Points](https://img.shields.io/badge/story--points-3-blueviolet?style=for-the-badge)
![Assignee](https://img.shields.io/badge/assignee-%40bun--dev-informational?style=for-the-badge)

</div>

---

## 🎯 Contexto & História de Usuário

**Como** [persona/desenvolvedor/usuário],  
**Quero** [ação ou funcionalidade desejada],  
**Para que** [benefício/valor de negócio ou técnico].

### Detalhes Técnicos & Motivação
- Descrever o contexto técnico, requisitos e decisões arquiteturais.
- Plano de referência: `[implementation_plan.md](file:///d:/mercury/.scratch/plans/implementation_plan.md)`

---

## 🌿 Padrão de Branch ([Conventional Branch](https://conventionalbranch.org/pt-br/))

```bash
git checkout -b feat/MERC-XXX-short-description
```

> **Formato padrão**: `<tipo>/<ID>-<descrição-curta-em-kebab-case>`

---

## 💬 Padrão de Commits ([Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/) & [iuricode](https://github.com/iuricode/padroes-de-commits))

| Tipo | Descrição | Exemplo |
| :--- | :--- | :--- |
| `feat` | Nova funcionalidade para o usuário ou sistema | `feat(acp): adiciona suporte ao agente grok-build` |
| `fix` | Correção de bug | `fix(server): trata timeout no handshake acp` |
| `docs` | Alterações apenas em documentação | `docs(board): atualiza definicao de pronto no card` |
| `style` | Formatação, ponto e vírgula, sem alteração de lógica | `style(providers): formata array de modelos` |
| `refactor` | Refatoração de código sem alterar comportamento | `refactor(mcp): simplifica leitura de streams` |
| `perf` | Melhoria de performance | `perf(cache): adiciona ttl de 5min na listagem` |
| `test` | Adição ou correção de testes unitários/integração | `test(acp): adiciona suite de testes para provedores` |
| `build` | Alterações que afetam o sistema de build ou dependências | `build(deps): adiciona pacote zod ao projeto` |
| `ci` | Mudanças em arquivos de configuração de CI/CD | `ci(github): adiciona workflow de release` |
| `chore` | Tarefas de manutenção geral | `chore(cleanup): remove logs temporarios` |

---

## ✅ Critérios de Aceite (Acceptance Criteria)

- [ ] Critério 1: Comportamento esperado sob a condição X.
- [ ] Critério 2: Resposta adequada em caso de erro/timeout.
- [ ] Critério 3: Compatibilidade com Windows PowerShell e POSIX.

---

## 📋 Definition of Done (DoD)

- [ ] Código implementado em TypeScript aderente aos padrões do projeto.
- [ ] Uso exclusivo de Bun nativo (`bun`, `bunx`, `import { $ } from "bun"`) — sem Node/npm/pnpm/yarn.
- [ ] `bun run typecheck` executado e sem erros.
- [ ] Testes unitários implementados e aprovados com `bun test`.
- [ ] Sem PII (dados reais) no histórico do commit (usar apenas identidades sintéticas).
- [ ] Mensagens de commit seguindo Conventional Commits.
- [ ] Card movido para `05-done/` e checklist concluído.

---

## 🧪 Plano de Verificação & Comandos

```powershell
# Verificação estática de tipos
cd d:\mercury\app
bun run typecheck

# Execução da suíte de testes relevante
bun test src/acp/providers.test.ts
```

---

## 📜 Log de Atividades & Commits

| Data | Hash | Tipo | Mensagem | Autor |
| :--- | :--- | :--- | :--- | :--- |
| YYYY-MM-DD | `-------` | `feat` | Descrição do commit | `@bun-dev` |
