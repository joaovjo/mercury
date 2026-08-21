---
id: MERC-001
title: "Expansão do catálogo de 38 Provedores do ACP Registry em providers.ts"
status: "done"
priority: "high"
type: "feat"
semver: "minor"
story_points: 3
sprint: "Sprint 1"
plan_ref: ".scratch/plans/implementation_plan.md"
branch: "feat/MERC-001-acp-providers-registry"
assignee: "@bun-dev"
created_at: "2026-08-20"
updated_at: "2026-08-21"
---

# MERC-001: Expansão do catálogo de 38 Provedores do ACP Registry em `providers.ts`

<div align="center">

![Status](https://img.shields.io/badge/status-done-brightgreen?style=for-the-badge)
![Priority](https://img.shields.io/badge/priority-high-red?style=for-the-badge)
![Type](https://img.shields.io/badge/type-feat-blue?style=for-the-badge)
![SemVer](https://img.shields.io/badge/semver-minor-brightgreen?style=for-the-badge)
![Points](https://img.shields.io/badge/story--points-3-blueviolet?style=for-the-badge)
![Assignee](https://img.shields.io/badge/assignee-%40bun--dev-informational?style=for-the-badge)

</div>

---

## 🎯 Contexto & História de Usuário

**Como** usuário do Mercury Dashboard,  
**Quero** poder selecionar qualquer um dos 38 agentes do ACP Registry (ex: Gemini CLI, Grok Build, Qwen Code, Goose, Devin, etc.) na aba Launch,  
**Para que** eu possa rodar skills de automação de busca de emprego com meu assistente de IA preferido.

### Detalhes Técnicos
- Arquivo alvo: [`app/src/acp/providers.ts`](file:///d:/mercury/app/src/acp/providers.ts)
- Implementado o mapeamento completo de todos os 39 provedores catalogados.
- Uso de `bunx` sob demanda para pacotes npm e binários específicos nos comandos ACP stdio.
- Garantia de que cada provedor define `id`, `displayName`, `bin`, `models` (com lista fallback inicial), `defaultModel` e `command(cwd, model)`.

---

## 🌿 Padrão de Branch ([Conventional Branch](https://conventionalbranch.org/pt-br/))

```bash
git checkout -b feat/MERC-001-acp-providers-registry
```

---

## 💬 Padrão de Commits ([Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/))

- `feat(acp): adiciona definicoes de todos os 38 provedores do registry`
- `style(acp): organiza registro de provedores em ordem alfabetica`

---

## ✅ Critérios de Aceite

- [x] Todos os 38+ provedores ACP estão declarados no dicionário `PROVIDERS` em `app/src/acp/providers.ts`.
- [x] Cada provedor possui sua função `command(cwd, model)` retornando o array de argumentos e variáveis de ambiente apropriados.
- [x] O helper `getProvider(id)` retorna o provedor correto ou fallback para `opencode` caso não encontrado.

---

## 📋 Definition of Done (DoD)

- [x] TypeScript sem erros (`bun run typecheck`).
- [x] Execução nativa com Bun sem dependências externas adicionadas desnecessariamente.
- [x] Sem PII (dados reais) no código.
- [x] Card validado por `@reviewer`.

---

## 🧪 Plano de Verificação

```powershell
cd d:\mercury\app
bun run typecheck
bun test src/acp/providers.test.ts
```

---

## 📜 Log de Atividades & Commits

| Data | Hash | Tipo | Mensagem | Autor |
| :--- | :--- | :--- | :--- | :--- |
| 2026-08-20 | `-------` | `feat` | Criação do card no backlog da Sprint 1 | `@lead-architect` |
| 2026-08-20 | `-------` | `feat` | Implementação dos 38 provedores em providers.ts | `@bun-dev` |
| 2026-08-21 | `-------` | `chore` | Transição para 04 · In Review | `@bun-dev` |
| 2026-08-21 | `-------` | `chore` | Validação técnica e aprovação final (Done) | `@reviewer` |
