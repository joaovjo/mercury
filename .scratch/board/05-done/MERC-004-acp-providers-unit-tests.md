---
id: MERC-004
title: "Cobertura de Testes Unitários dos Provedores ACP com bun test"
status: "done"
priority: "high"
type: "test"
semver: "patch"
story_points: 3
sprint: "Sprint 1"
plan_ref: ".scratch/plans/implementation_plan.md"
branch: "test/MERC-004-acp-providers-unit-tests"
assignee: "@test-qa"
created_at: "2026-08-20"
updated_at: "2026-08-21"
---

# MERC-004: Cobertura de Testes Unitários dos Provedores ACP com `bun test`

<div align="center">

![Status](https://img.shields.io/badge/status-done-brightgreen?style=for-the-badge)
![Priority](https://img.shields.io/badge/priority-high-red?style=for-the-badge)
![Type](https://img.shields.io/badge/type-test-yellowgreen?style=for-the-badge)
![SemVer](https://img.shields.io/badge/semver-patch-yellow?style=for-the-badge)
![Points](https://img.shields.io/badge/story--points-3-blueviolet?style=for-the-badge)
![Assignee](https://img.shields.io/badge/assignee-%40test--qa-informational?style=for-the-badge)

</div>

---

## 🎯 Contexto & História de Usuário

**Como** engenheiro de qualidade do projeto,  
**Quero** uma suite de testes unitários em Bun validando a integridade de todos os 38 provedores, comandos e descoberta de modelos,  
**Para que** possamos prevenir regressões e garantir alta confiabilidade na execução do ACP.

### Detalhes Técnicos
- Arquivo alvo: [`app/src/acp/providers.test.ts`](file:///d:/mercury/app/src/acp/providers.test.ts)
- Testes implementados:
  - Existência e estrutura conforme `AcpProvider` de todos os 39 provedores no catálogo `PROVIDERS`.
  - Injeção de variáveis de ambiente de modelos específicos (opencode, claude-code, claude-acp, codex-acp, gemini, github-copilot-cli, cline, grok-build, mistral-vibe, qwen-code, glm-acp-agent, kimi) e provedores estáticos sem env.
  - Execução de `getProvider` para IDs válidos, `undefined`, desconhecido e string vazia.
  - Comportamento de `listProviderModels` com cache de 5 minutos, probe assíncrono e fallbacks seguros.
  - Zero PII (apenas dados sintéticos).

---

## 🌿 Padrão de Branch ([Conventional Branch](https://conventionalbranch.org/pt-br/))

```bash
git checkout -b test/MERC-004-acp-providers-unit-tests
```

---

## 💬 Padrão de Commits ([Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/))

- `test(acp): adiciona suite de testes unitarios para provedores e descoberta de modelos`

---

## ✅ Critérios de Aceite

- [x] Todos os 38+ provedores são testados quanto à presença de ID, displayName, comando válido e lista de modelos padrão.
- [x] Teste de fallback do `getProvider` para ID inexistente retorna `opencode`.
- [x] Teste de injeção de variáveis de ambiente para todos os agentes suportados.
- [x] Testes de descoberta e cache com TTL e fallback estático.
- [x] Execução com `bun test` e `bun run typecheck`.

---

## 📋 Definition of Done (DoD)

- [x] Arquivo de teste implementado usando a API de testes nativa do Bun (`import { describe, expect, test } from "bun:test"`).
- [x] Sem PII (dados reais) nas fixtures de teste.
- [x] Co-localizado com o arquivo fonte (`app/src/acp/providers.test.ts`).
- [x] Card validado por `@reviewer`.

---

## 🧪 Plano de Verificação

```powershell
cd d:\mercury\app
bun run typecheck
bun test src/acp/providers.test.ts
bun test
```

---

## 📜 Log de Atividades & Commits

| Data | Hash | Tipo | Mensagem | Autor |
| :--- | :--- | :--- | :--- | :--- |
| 2026-08-20 | `-------` | `feat` | Criação do card no backlog da Sprint 1 | `@lead-architect` |
| 2026-08-21 | `-------` | `test` | Implementação de providers.test.ts com bun:test | `@test-qa` |
| 2026-08-21 | `-------` | `chore` | Transição para 04 · In Review | `@test-qa` |
| 2026-08-21 | `-------` | `chore` | Validação técnica e aprovação final (Done) | `@reviewer` |
