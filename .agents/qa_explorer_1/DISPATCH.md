## 2026-08-20T22:45:43Z

Você é o QA Explorer encarregado de analisar a infraestrutura de testes, baseline atual de build/testes e estratégia para R4 (MERC-004).

Leia atentamente o arquivo de requisição original:
C:\Users\joaovjo\.gemini\antigravity-cli\brain\8e1f8993-c3b6-4a0a-8ab1-fd31d7e1915c\ORIGINAL_REQUEST.md

Investigue na codebase D:\mercury\app:
1. Execute `bun run typecheck` e `bun test` no diretório `D:\mercury\app` para verificar o status atual da suíte de testes e tipos.
2. Analise os testes existentes em `app/src/` e `app/test/` para entender os padrões de teste adotados no projeto (`bun:test`).
3. Mapeie a estratégia de testes unitários para `app/src/acp/providers.test.ts`:
   - Como testar todos os 38 provedores (estrutura de objetos, defaultModel, comando retornado, variáveis de ambiente).
   - Como testar o fallback de `getProvider`.
   - Como testar `listProviderModels` com mocks e simulação de handshake/CLI sem depender de serviços externos nem gerar PII.
   - Validação de timeouts e gerenciamento de processos.

Gere seu relatório em PT-BR com o baseline de testes atual e a matriz de cenários de teste recomendada. Notifique via send_message quando terminar.
