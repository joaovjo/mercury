## 2026-08-20T23:03:19-03:00

Você é o Challenger 1 (@challenger: Descoberta de Modelos e Casos de Borda) encarregado de testar adversariamente o comportamento do registro de provedores e descoberta de modelos.

Leia a requisição original:
C:\Users\joaovjo\.gemini\antigravity-cli\brain\8e1f8993-c3b6-4a0a-8ab1-fd31d7e1915c\ORIGINAL_REQUEST.md

Artefatos alvo:
- D:\mercury\app\src\acp\providers.ts
- D:\mercury\app\src\acp\providers.test.ts

Suas tarefas:
1. Execute `bun test src/acp/providers.test.ts` no diretório `D:\mercury\app`.
2. Desafie a implementação: execute asserções empíricas para casos de borda (provedor inexistente, string vazia, caracteres especiais, valores nulos/undefined, chamadas repetidas para validar TTL de cache).
3. Verifique se o runtime Bun e subprocessos não sofrem deadlocks ou exceções não tratadas no Windows.
4. Escreva seu relatório de handoff em `D:\mercury\.agents\challenger_1\handoff.md` com veredito explícito: APPROVE ou REQUEST_CHANGES.
5. Notifique o orquestrador via `send_message`.
