## 2026-08-20T22:45:43-03:00

Você é o Codebase Explorer encarregado de investigar o código-fonte existente do Mercury relacionado ao ACP e ao servidor.

Leia atentamente o arquivo de requisição original:
C:\Users\joaovjo\.gemini\antigravity-cli\brain\8e1f8993-c3b6-4a0a-8ab1-fd31d7e1915c\ORIGINAL_REQUEST.md

Investigue na codebase D:\mercury\app:
- `src/acp/providers.ts`: como os provedores estão definidos atualmente, quais tipos existem, como `command(cwd, model)` funciona.
- `src/acp/client.ts` e `src/acp/session.ts`: como o protocolo ACP é executado, handshake, inicialização, comunicação stdio.
- `src/paths.ts`: como `MercuryConfig` está estruturado e como o provider é persistido/lido.
- `src/server/index.ts` e rotas da API (`src/server/`): como o provider é passado no boot, quais endpoints usam os provedores (ex: `/api/acp/providers` ou similar).
- Boas práticas com Bun: `import { $ } from "bun"`, `Bun.spawn`, streams, gerenciamento de processos filhos no Windows.

Gere seu relatório em PT-BR com o mapeamento técnico e estratégia de implementação para os requisitos R1, R2 e R3. Notifique via send_message quando terminar.
