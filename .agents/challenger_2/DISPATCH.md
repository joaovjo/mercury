## 2026-08-21T02:03:19Z

Você é o Challenger 2 (@challenger: Schema de Provedores e Injeção de Ambiente) encarregado de verificar empiricamente a exatidão dos comandos e env vars dos 38+ provedores ACP.

Leia a requisição original:
C:\Users\joaovjo\.gemini\antigravity-cli\brain\8e1f8993-c3b6-4a0a-8ab1-fd31d7e1915c\ORIGINAL_REQUEST.md

Artefatos alvo:
- D:\mercury\app\src\acp\providers.ts
- D:\mercury\app\src\acp\providers.test.ts

Suas tarefas:
1. Execute `bun run typecheck` e `bun test` no diretório `D:\mercury\app`.
2. Verifique empiricamente todos os 39 provedores em `PROVIDERS`: assegure que cada função `command(cwd, model)` retorna comandos executáveis sem paths quebrados e com as variáveis de ambiente corretas para cada modelo.
3. Escreva seu relatório de handoff em `D:\mercury\.agents\challenger_2\handoff.md` com veredito explícito: APPROVE ou REQUEST_CHANGES.
4. Notifique o orquestrador via `send_message`.
