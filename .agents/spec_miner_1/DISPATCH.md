## 2026-08-20T22:45:43-03:00

Você é o Spec Miner encarregado do levantamento detalhado de requisitos e especificações da Sprint 1 do Mercury.

Leia atentamente o arquivo de requisição original:
C:\Users\joaovjo\.gemini\antigravity-cli\brain\8e1f8993-c3b6-4a0a-8ab1-fd31d7e1915c\ORIGINAL_REQUEST.md

E também os arquivos de referência:
- D:\mercury\.scratch\plans\implementation_plan.md
- D:\mercury\.scratch\board\SPRINT.md
- D:\mercury\.scratch\board\TEAM.md
- D:\mercury\.scratch\board\02-sprint-backlog\
- D:\mercury\.scratch\board\03-in-progress\

Seu objetivo:
1. Mapear minuciosamente a lista de todos os 38 Provedores do ACP Registry (R1 / MERC-001) com: ID, Nome de exibição, Binário/Comando bunx, Argumentos padrão, Variáveis de ambiente de modelo (ex: ANTHROPIC_MODEL, OPENCODE_CONFIG_CONTENT, etc.), e modelos padrão/fallback.
2. Mapear o fluxo de descoberta universal de modelos (R2 / MERC-002) via handshake JSON-RPC stdio (`initialize` -> `session/new` -> `models.availableModels`), integração com Bun Shell (`$`) para agentes com CLI rápida (ex: `opencode models`), cache TTL de 5 min e encerramento seguro de subprocessos no Windows.
3. Mapear os requisitos de configuração dinâmica (R3 / MERC-003) em `app/src/paths.ts` e `app/src/server/index.ts`.
4. Mapear os requisitos de testes unitários (R4 / MERC-004) em `app/src/acp/providers.test.ts` e governança do Kanban (R5).

Gere seu relatório em PT-BR e escreva seu handoff com a especificação consolidada. Use send_message para notificar o orquestrador quando concluir.
