# Handoff Report — Sprint 1 Specification Mining

**Agent**: Specification Miner (`@spec-miner`)  
**Directory**: `D:\mercury\.agents\spec_miner_1`  
**Timestamp**: 2026-08-20T22:48:30-03:00  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

- **Requisição Original**: Localizada em `C:\Users\joaovjo\.gemini\antigravity-cli\brain\8e1f8993-c3b6-4a0a-8ab1-fd31d7e1915c\ORIGINAL_REQUEST.md`, definindo os requisitos R1 (38 Provedores), R2 (Descoberta Universal de Modelos), R3 (Configuração Dinâmica), R4 (Suíte de Testes Unitários Bun) e R5 (Governança Kanban).
- **Plano de Implementação**: Localizado em `D:\mercury\.scratch\plans\implementation_plan.md`, detalhando o uso exclusivo de Bun nativo (`bun`, `bunx`, `import { $ } from "bun"`), handshake ACP JSON-RPC 2.0 stdio (`initialize` → `session/new` → `models.availableModels`), cache de 5 minutos e encerramento limpo no Windows.
- **Catálogo de Provedores ACP**: Em `D:\mercury\app\src\acp\providers.ts` (linhas 29 a 387), foram mapeados todos os 38+ provedores com seus respectivos comandos, binários, variáveis de ambiente de modelo e listas de fallback.
- **Descoberta de Modelos**: Em `D:\mercury\app\src\acp\providers.ts` (linhas 393 a 550), implementadas as funções `runWithTimeout`, `listProviderModels`, `listOpenCodeModels` e `probeAcpAgentModels` com TTL de 5 minutos (`MODELS_TTL_MS = 5 * 60 * 1000`), timeouts de 15s/20s e encerramento seguro via `proc?.kill()`.
- **Configuração e Servidor**: Em `D:\mercury\app\src\paths.ts` (linha 35: `MercuryConfig.provider?: string`) e `D:\mercury\app\src\server\index.ts` (linhas 160-174 no endpoint `/api/acp/providers` e linhas 246-248 no aquecimento concorrente de modelos).
- **Quadro Kanban & Backlog**: Em `D:\mercury\.scratch\board/`, verificados os arquivos `SPRINT.md`, `TEAM.md` e os cards `MERC-001` (atualmente em `03-in-progress/`), `MERC-002`, `MERC-003` e `MERC-004` (em `02-sprint-backlog/`).

---

## 2. Logic Chain

1. **R1 (38 Provedores)**: A partir da observação de `app/src/acp/providers.ts`, verificou-se que cada um dos 38 provedores do catálogo do ACP Registry possui mapeamento exato de comando de inicialização (`bunx` ou CLI nativa), variáveis de ambiente condicionais para modelos (como `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL`, `GROK_MODEL`, etc.) e modelos fallback caso a descoberta em tempo de execução falhe.
2. **R2 (Descoberta Universal)**: O fluxo de descoberta implementado em `probeAcpAgentModels` envia mensagens JSON-RPC 2.0 stdio para o agente spawnado, processa a resposta `availableModels` de `session/new`, lida com mensagens reversas e armazena em cache por 5 minutos, garantindo que o dashboard nunca sofra bloqueios ou lentidão.
3. **R3 (Configuração Dinâmica)**: A tipagem de `MercuryConfig.provider` como `string` permite que qualquer ID registrado seja persistido no `~/.mercury/config.json` e repassado ao `SessionManager` sem limitações de enum rígido.
4. **R4 (Testes Unitários)**: A suíte de testes em `app/src/acp/providers.test.ts` deve validar a completude do registro `PROVIDERS`, o fallback do `getProvider`, as variáveis de ambiente geradas por `command(cwd, model)` e o fallback estático de `listProviderModels`.
5. **R5 (Governança Kanban)**: A progressão dos cards segue estritamente a RACI do `TEAM.md` e o DoD da `SPRINT.md`, garantindo ausência total de PII, tipagem estrita com TypeScript e conformidade com Conventional Commits e Conventional Branch.

---

## 3. Caveats

- **Execução Real de Subprocessos de Terceiros em Testes**: A maioria dos 38 agentes do catálogo do ACP exige instalação de binários ou chaves de API externas que podem não estar presentes no ambiente de desenvolvimento local. Portanto, os testes unitários de `providers.test.ts` devem focar na validação estática de estruturas, comandos, variáveis de ambiente e no comportamento de fallback seguro de `listProviderModels`, sem depender de conexões externas de rede.
- **Diferenças de Plataforma no Windows**: No Windows PowerShell, o término de processos via `proc.kill()` deve sempre ser encapsulado em `try/catch` para evitar exceções em processos que já tenham sido encerrados pelo próprio agente.

---

## 4. Conclusion

A especificação técnica da Sprint 1 está 100% mapeada e consolidada no arquivo `spec_report.md`. Todos os 38 provedores do ACP Registry, os fluxos de descoberta JSON-RPC stdio e Bun Shell, os requisitos de configuração e os critérios de validação para os testes unitários em Bun foram detalhados minuciosamente para orientar as etapas seguintes de desenvolvimento e garantia da qualidade.

---

## 5. Verification Method

Para verificar e validar as especificações levantadas:

1. **Inspeção do Relatório Consolidado**:
   ```powershell
   Get-Content "D:\mercury\.agents\spec_miner_1\spec_report.md"
   ```
2. **Checagem Estática de Tipos**:
   ```powershell
   cd D:\mercury\app
   bun run typecheck
   ```
3. **Execução da Suíte de Testes Unitários**:
   ```powershell
   cd D:\mercury\app
   bun test src/acp/session.test.ts
   bun test src/acp/providers.test.ts
   ```
4. **Inspeção dos Cards do Board**:
   - `D:\mercury\.scratch\board\03-in-progress\MERC-001-acp-providers-registry.md`
   - `D:\mercury\.scratch\board\02-sprint-backlog\MERC-002-universal-model-discovery.md`
   - `D:\mercury\.scratch\board\02-sprint-backlog\MERC-003-cli-provider-flags-and-config.md`
   - `D:\mercury\.scratch\board\02-sprint-backlog\MERC-004-acp-providers-unit-tests.md`
