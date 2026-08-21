---
id: MERC-003
title: "Suporte a Provedores Dinâmicos na Configuração e CLI do Servidor"
status: "done"
priority: "medium"
type: "feat"
semver: "minor"
story_points: 2
sprint: "Sprint 1"
plan_ref: ".scratch/plans/implementation_plan.md"
branch: "feat/MERC-003-cli-provider-flags-and-config"
assignee: "@bun-dev"
created_at: "2026-08-20"
updated_at: "2026-08-21"
---

# MERC-003: Suporte a Provedores Dinâmicos na Configuração e CLI do Servidor

<div align="center">

![Status](https://img.shields.io/badge/status-done-brightgreen?style=for-the-badge)
![Priority](https://img.shields.io/badge/priority-medium-yellow?style=for-the-badge)
![Type](https://img.shields.io/badge/type-feat-blue?style=for-the-badge)
![SemVer](https://img.shields.io/badge/semver-minor-brightgreen?style=for-the-badge)
![Points](https://img.shields.io/badge/story--points-2-blueviolet?style=for-the-badge)
![Assignee](https://img.shields.io/badge/assignee-%40bun--dev-informational?style=for-the-badge)

</div>

---

## 🎯 Contexto & História de Usuário

**Como** usuário configurando o Mercury via CLI ou arquivo de configuração,  
**Quero** definir qualquer provedor suportado como padrão (ex: `mercury config set provider gemini`),  
**Para que** o dashboard e as skills utilizem meu agente preferido sem restrições.

### Detalhes Técnicos
- Arquivos alvo:
  - [`app/src/paths.ts`](file:///d:/mercury/app/src/paths.ts): `MercuryConfig.provider?: string` suporta qualquer ID de provedor registrado.
  - [`app/src/server/index.ts`](file:///d:/mercury/app/src/server/index.ts): Inicialização do dashboard com aquecimento assíncrono do cache de modelos e suporte dinâmico no endpoint `/api/acp/providers`.

---

## 🌿 Padrão de Branch ([Conventional Branch](https://conventionalbranch.org/pt-br/))

```bash
git checkout -b feat/MERC-003-cli-provider-flags-and-config
```

---

## 💬 Padrão de Commits ([Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/))

- `feat(config): expande tipo MercuryConfig.provider para aceitar qualquer id`
- `feat(server): inicializa com provedor customizado via flag e config`

---

## ✅ Critérios de Aceite

- [x] `MercuryConfig.provider` permite string arbitrária tipada.
- [x] O endpoint de inicialização e rotas do servidor reconhecem provedores dinâmicos sem erros.

---

## 📋 Definition of Done (DoD)

- [x] TypeScript sem erros (`bun run typecheck`).
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
| 2026-08-20 | `-------` | `feat` | Suporte a flags e configuração dinâmica de provider | `@bun-dev` |
| 2026-08-21 | `-------` | `chore` | Transição para 04 · In Review | `@bun-dev` |
| 2026-08-21 | `-------` | `chore` | Validação técnica e aprovação final (Done) | `@reviewer` |
