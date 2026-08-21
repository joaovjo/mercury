## 2026-08-21T02:00:14Z

Você é o Core Implementer & Test Worker (@bun-dev / @test-qa) para a Sprint 1 do Mercury.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Contexto e Arquivo de Requisição Original:
C:\Users\joaovjo\.gemini\antigravity-cli\brain\8e1f8993-c3b6-4a0a-8ab1-fd31d7e1915c\ORIGINAL_REQUEST.md

Relatórios técnicos de referência:
- D:\mercury\.agents\qa_explorer_1\handoff.md (leia este arquivo, contém o código completo e matriz de testes recomendada)
- D:\mercury\.agents\codebase_explorer_1\handoff.md
- D:\mercury\.scratch\plans\implementation_plan.md
- D:\mercury\.scratch\board\SPRINT.md
- D:\mercury\.scratch\board\TEAM.md

Suas tarefas diretas:
1. Crie o arquivo `D:\mercury\app\src\acp\providers.test.ts` usando a ferramenta `write_to_file` com a suíte de testes unitários em `bun:test` cobrindo:
   - Contagem e schema de todos os 38+ provedores em `PROVIDERS`.
   - Injeção de variáveis de ambiente de modelo (opencode, claude-code, claude-acp, codex-acp, gemini, github-copilot-cli, cline, grok-build, mistral-vibe, qwen-code, glm-acp-agent, kimi).
   - Lookups e fallbacks de `getProvider` (válido, undefined, desconhecido, vazio).
   - Comportamento de `listProviderModels` com cache TTL de 5 min e fallback estático.
   - Zero PII (apenas dados sintéticos).
2. Execute a verificação usando `run_command` com `Cwd="D:\\mercury\\app"`:
   - `bun run typecheck`
   - `bun test src/acp/providers.test.ts`
   - `bun test`
   Certifique-se de que 100% dos testes passem e o typecheck esteja limpo.
3. Atualize o quadro Kanban em `D:\mercury\.scratch\board/`:
   - Atualize os arquivos dos cards (`MERC-001`, `MERC-002`, `MERC-003`, `MERC-004`) movendo-os para `D:\mercury\.scratch\board\04-in-review/` (ou atualizando seu status para `in-review`).
   - Atualize `D:\mercury\.scratch\board\README.md` e `D:\mercury\.scratch\board\SPRINT.md` refletindo os cards em revisão (04 · In Review).
4. Gere o relatório de handoff em `D:\mercury\.agents\worker_1\handoff.md` com todos os outputs de typecheck e testes.
5. Envie uma mensagem via `send_message` ao parent notificando a conclusão.
