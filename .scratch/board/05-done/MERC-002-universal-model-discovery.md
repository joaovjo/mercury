---
id: MERC-002
title: "Descoberta Universal de Modelos via Bun Shell ($) e ACP Handshake"
status: "done"
priority: "high"
type: "feat"
semver: "minor"
story_points: 5
sprint: "Sprint 1"
plan_ref: ".scratch/plans/implementation_plan.md"
branch: "feat/MERC-002-universal-model-discovery"
assignee: "@bun-dev"
created_at: "2026-08-20"
updated_at: "2026-08-21"
---

# MERC-002: Descoberta Universal de Modelos via Bun Shell (`$`) e ACP Handshake

<div align="center">

![Status](https://img.shields.io/badge/status-done-brightgreen?style=for-the-badge)
![Priority](https://img.shields.io/badge/priority-high-red?style=for-the-badge)
![Type](https://img.shields.io/badge/type-feat-blue?style=for-the-badge)
![SemVer](https://img.shields.io/badge/semver-minor-brightgreen?style=for-the-badge)
![Points](https://img.shields.io/badge/story--points-5-blueviolet?style=for-the-badge)
![Assignee](https://img.shields.io/badge/assignee-%40bun--dev-informational?style=for-the-badge)

</div>

---

## 🎯 Contexto & História de Usuário

**Como** usuário selecionando um agente no Mercury,  
**Quero** que a lista de modelos disponíveis seja descoberta dinamicamente pelo protocolo ACP ou CLI do agente,  
**Para que** eu tenha acesso aos modelos mais recentes sem necessidade de atualizar manualmente a lista estática.

### Detalhes Técnicos
- Arquivo alvo: [`app/src/acp/providers.ts`](file:///d:/mercury/app/src/acp/providers.ts)
- Implementado `probeAcpAgentModels(providerId, timeoutMs)` genérico para qualquer agente ACP:
  - Executa handshake JSON-RPC stdio (`initialize` → `session/new`).
  - Lê `models.availableModels` anunciados pelo agente.
  - Encerra o processo de forma limpa (sem travar no Windows).
- Integração de `import { $ } from "bun"` para chamadas CLI com timeout (ex: `opencode models`).
- Cache em memória com TTL de 5 minutos (`_modelCache`).

---

## 🌿 Padrão de Branch ([Conventional Branch](https://conventionalbranch.org/pt-br/))

```bash
git checkout -b feat/MERC-002-universal-model-discovery
```

---

## 💬 Padrão de Commits ([Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/))

- `feat(acp): implementa probeAcpAgentModels generico via handshake stdio`
- `feat(acp): integra Bun Shell para descoberta rapida via cli`
- `perf(acp): adiciona cache de modelos com ttl de 5min`

---

## ✅ Critérios de Aceite

- [x] `listProviderModels(providerId)` descobre modelos dinamicamente para qualquer provedor registrado.
- [x] Timeouts são respeitados e processos filhos são terminados sem deixar processos órfãos no Windows.
- [x] Fallback seguro para a lista estática caso o agente não responda ao handshake ou falhe.
- [x] Cache com TTL de 5 minutos evita handshakes repetidos desnecessários.

---

## 📋 Definition of Done (DoD)

- [x] Código TypeScript limpo e tipado.
- [x] Compatível com Bun no Windows PowerShell e POSIX.
- [x] `bun run typecheck` sem erros.
- [x] Revisão aprovada por `@reviewer`.

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
| 2026-08-20 | `-------` | `feat` | Implementação de probe e cache de modelos | `@bun-dev` |
| 2026-08-21 | `-------` | `chore` | Transição para 04 · In Review | `@bun-dev` |
| 2026-08-21 | `-------` | `chore` | Validação técnica e aprovação final (Done) | `@reviewer` |
