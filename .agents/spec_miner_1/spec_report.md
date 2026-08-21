# Relatório de Especificação Técnica — Sprint 1 (Mercury)

**Data**: 2026-08-20  
**Autor**: Specification Miner (`@spec-miner`)  
**Status**: Concluído (Especificação Formal)  
**Versão Alvo**: `v0.4.0`  
**Escopo**: Requisitos R1 a R5 (MERC-001 a MERC-004 e Governança)

---

## 1. Visão Geral da Arquitetura & Objetivos

A Sprint 1 do Mercury tem como objetivo expandir o suporte ao **Agent Client Protocol (ACP)** de 2 agentes para o catálogo completo de **38+ provedores oficiais**, introduzindo um mecanismo de **Descoberta Universal de Modelos** via handshake JSON-RPC stdio e CLI (Bun Shell), permitindo a configuração dinâmica de qualquer provedor na CLI/Dashboard e estabelecendo uma suíte completa de testes automatizados em Bun nativo (`bun:test`), sem dependências externas ou PII.

---

## 2. Especificação Detalhada dos 38 Provedores ACP (R1 / MERC-001)

Cada provedor é modelado segundo a interface TypeScript `AcpProvider` definida em `app/src/acp/providers.ts`:

```typescript
export interface AcpProviderCommand {
  cmd: string[];
  env?: Record<string, string>;
}

export interface AcpProvider {
  id: string;
  displayName: string;
  models: string[];
  defaultModel?: string;
  command: (cwd: string, model?: string) => AcpProviderCommand;
  bin: string;
}
```

### Matriz Completa dos 38+ Provedores Registrados

| # | ID do Provedor | Nome de Exibição | Binário (`bin`) | Comando Base | Pacote `bunx` / CLI | Variáveis de Ambiente de Modelo | Modelos Padrão / Fallback |
|---|---|---|---|---|---|---|---|
| 1 | `opencode` | OpenCode | `opencode` | `opencode acp --cwd <cwd>` | CLI nativa | `OPENCODE_CONFIG_CONTENT: JSON.stringify({ model })` | `anthropic/claude-3-7-sonnet`, `anthropic/claude-3-5-sonnet`, `openai/gpt-4o`, `openai/o3-mini`, `google/gemini-2.0-flash`, `google/gemini-2.5-pro`, `openrouter/auto` |
| 2 | `claude-code` | Claude Code | `claude` | `bunx --bun @zed-industries/claude-code-acp` | `bunx` | `CLAUDECODE: ""`, `ANTHROPIC_MODEL: model` | `opus`, `sonnet`, `haiku` |
| 3 | `claude-acp` | Claude Agent (Official) | `claude-agent-acp` | `bunx @agentclientprotocol/claude-agent-acp@latest` | `bunx` | `ANTHROPIC_MODEL: model` | `claude-3-7-sonnet-latest`, `claude-3-5-sonnet-latest`, `claude-3-5-haiku-latest` |
| 4 | `codex-acp` | Codex (OpenAI) | `codex-acp` | `bunx @agentclientprotocol/codex-acp@latest` | `bunx` | `OPENAI_MODEL: model` | `o3-mini`, `gpt-4o`, `gpt-4o-mini` |
| 5 | `gemini` | Gemini CLI (Google) | `gemini` | `bunx @google/gemini-cli@latest --acp` | `bunx` | `GEMINI_MODEL: model` | `gemini-2.5-pro`, `gemini-2.0-flash`, `gemini-1.5-pro` |
| 6 | `github-copilot-cli` | GitHub Copilot CLI | `copilot` | `bunx @github/copilot@latest --acp` | `bunx` | `COPILOT_MODEL: model` | `gpt-4o`, `claude-3.5-sonnet`, `o1` |
| 7 | `cursor` | Cursor Agent | `cursor-agent` | `cursor-agent acp` | CLI nativa | N/A | `claude-3-7-sonnet`, `gpt-4o`, `cursor-fast` |
| 8 | `cline` | Cline | `cline` | `bunx cline@latest --acp` | `bunx` | `CLINE_MODEL: model` | `claude-3-7-sonnet`, `claude-3-5-sonnet`, `gpt-4o` |
| 9 | `grok-build` | Grok Build (xAI) | `grok` | `bunx @xai-official/grok@latest agent stdio` | `bunx` | `GROK_MODEL: model` | `grok-2`, `grok-2-mini`, `grok-beta` |
| 10 | `mistral-vibe` | Mistral Vibe | `vibe-acp` | `vibe-acp` | CLI nativa | `MISTRAL_MODEL: model` | `mistral-large-latest`, `mistral-small-latest`, `codestral-latest` |
| 11 | `qwen-code` | Qwen Code | `qwen-code` | `bunx @qwen-code/qwen-code@latest --acp --experimental-skills` | `bunx` | `QWEN_MODEL: model` | `qwen-2.5-coder-32b`, `qwen-max`, `qwen-plus` |
| 12 | `glm-acp-agent` | GLM Agent (Zhipu AI) | `glm-acp-agent` | `bunx glm-acp-agent@latest` | `bunx` | `GLM_MODEL: model` | `glm-4-plus`, `glm-4-air`, `codegeex-4` |
| 13 | `goose` | Goose | `goose` | `goose acp` | CLI nativa | N/A | `gpt-4o`, `claude-3-5-sonnet`, `databricks-dbrx` |
| 14 | `kimi` | Kimi CLI (Moonshot AI) | `kimi` | `kimi acp` | CLI nativa | `KIMI_MODEL: model` | `moonshot-v1-128k`, `moonshot-v1-32k`, `moonshot-v1-8k` |
| 15 | `devin` | Devin (Cognition) | `devin` | `devin acp` | CLI nativa | N/A | `devin-default` |
| 16 | `agoragentic-acp` | Agoragentic | `agoragentic-mcp` | `bunx agoragentic-mcp@latest --acp` | `bunx` | N/A | `default` |
| 17 | `amp-acp` | Amp | `amp-acp` | `amp-acp` | CLI nativa | N/A | `default` |
| 18 | `auggie` | Auggie CLI (Augment) | `auggie` | `bunx @augmentcode/auggie@latest --acp` | `bunx` | N/A | `augment-default` |
| 19 | `autohand` | Autohand Code | `autohand-acp` | `bunx @autohandai/autohand-acp@latest` | `bunx` | N/A | `default` |
| 20 | `codebuddy-code` | Codebuddy Code (Tencent) | `codebuddy-code` | `bunx @tencent-ai/codebuddy-code@latest --acp` | `bunx` | N/A | `hunyuan-code`, `gpt-4o` |
| 21 | `cortex-code` | Cortex Code | `cortex` | `cortex acp serve` | CLI nativa | N/A | `default` |
| 22 | `corust-agent` | Corust Agent | `corust-agent-acp` | `corust-agent-acp` | CLI nativa | N/A | `default` |
| 23 | `crow-cli` | Crow CLI | `crow-cli` | `crow-cli acp` | CLI nativa | N/A | `default` |
| 24 | `deepagents` | DeepAgents | `deepagents-acp` | `bunx deepagents-acp@latest` | `bunx` | N/A | `deepseek-r1`, `deepseek-v3` |
| 25 | `dimcode` | DimCode | `dimcode` | `bunx dimcode@latest acp` | `bunx` | N/A | `default` |
| 26 | `dirac` | Dirac | `dirac` | `bunx dirac-cli@latest --acp` | `bunx` | N/A | `default` |
| 27 | `factory-droid` | Factory Droid | `droid` | `bunx droid@latest exec --output-format acp-daemon` | `bunx` | N/A | `default` |
| 28 | `fast-agent` | Fast Agent | `fast-agent-acp` | `fast-agent-acp -x` | CLI nativa | N/A | `default` |
| 29 | `harn` | Harn | `harn` | `harn serve acp` | CLI nativa | N/A | `default` |
| 30 | `junie` | Junie (JetBrains) | `junie` | `junie --acp=true` | CLI nativa | N/A | `jetbrains-ai` |
| 31 | `kilo` | Kilo Code | `kilo` | `bunx @kilocode/cli@latest acp` | `bunx` | N/A | `default` |
| 32 | `minion-code` | Minion Code | `minion-code` | `minion-code acp` | CLI nativa | N/A | `default` |
| 33 | `nova` | Nova (Compass AI) | `nova` | `bunx @compass-ai/nova@latest acp` | `bunx` | N/A | `default` |
| 34 | `pi-acp` | Pi ACP | `pi-acp` | `bunx pi-acp@latest` | `bunx` | N/A | `default` |
| 35 | `poolside` | Poolside | `pool` | `pool acp` | CLI nativa | N/A | `default` |
| 36 | `qoder` | Qoder CLI | `qoder` | `bunx @qoder-ai/qodercli@latest --acp` | `bunx` | N/A | `default` |
| 37 | `sigit` | siGit Code | `sigit` | `bunx @smbcloud/sigit@latest` | `bunx` | N/A | `default` |
| 38 | `stakpak` | Stakpak | `stakpak` | `stakpak acp` | CLI nativa | N/A | `default` |
| 39 | `vtcode` | VT Code | `vtcode` | `vtcode acp` | CLI nativa | N/A | `default` |

---

## 3. Descoberta Universal de Modelos (R2 / MERC-002)

O mecanismo de descoberta de modelos segue uma arquitetura em camadas otimizada para velocidade, isolamento de falhas e compatibilidade cross-platform:

```
┌────────────────────────────────────────────────────────┐
│               listProviderModels(providerId)           │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────▼─────────────┐
              │  Cache TTL válido (<5min)? │─── SIM ──▶ Retorna do Cache em Memória
              └─────────────┬─────────────┘
                            │ NÃO
              ┌─────────────▼─────────────┐
              │   providerId == "opencode"?│
              └──────┬─────────────┬──────┘
                 SIM │             │ NÃO
                     ▼             ▼
       ┌───────────────────┐ ┌────────────────────────────────────────┐
       │ listOpenCodeModels│ │ probeAcpAgentModels (ACP StdIo Handshake)│
       │ Bun Shell: $`...` │ │   1. spawn Bun.spawn(cmd, stdin/stdout)│
       │ Fallback: runWith-│ │   2. request("initialize")             │
       │           Timeout │ │   3. request("session/new")            │
       └─────────┬─────────┘ │   4. extract session.models            │
                 │           │   5. proc.kill() (finally)             │
                 │           └──────────────────┬─────────────────────┘
                 │                              │
                 └──────────────┬───────────────┘
                                ▼
                 ┌─────────────────────────────┐
                 │ Modelos encontrados válidos?│
                 └──────┬───────────────┬──────┘
                    SIM │               │ NÃO / Timeout / Erro
                        ▼               ▼
                 Armazena no Cache   Armazena Fallback Estático no Cache
                        │               │
                        └───────┬───────┘
                                ▼
                       Retorna Lista de Modelos
```

### Protocolo de Handshake JSON-RPC 2.0 (ACP Stdio)

1. **Inicialização (`initialize`)**:
   - Mensagem enviada pelo Mercury:
     ```json
     {
       "jsonrpc": "2.0",
       "id": 1,
       "method": "initialize",
       "params": {
         "protocolVersion": 1,
         "clientCapabilities": {
           "fs": { "readTextFile": true, "writeTextFile": true }
         }
       }
     }
     ```
2. **Criação de Sessão (`session/new`)**:
   - Mensagem enviada pelo Mercury:
     ```json
     {
       "jsonrpc": "2.0",
       "id": 2,
       "method": "session/new",
       "params": {
         "cwd": "<workspace_path>",
         "mcpServers": []
       }
     }
     ```
   - Resposta esperada do Agente:
     ```json
     {
       "jsonrpc": "2.0",
       "id": 2,
       "result": {
         "sessionId": "synth-sess-001",
         "models": {
           "availableModels": [
             { "modelId": "claude-3-7-sonnet-latest", "name": "Claude 3.7 Sonnet" },
             { "modelId": "claude-3-5-sonnet-latest", "name": "Claude 3.5 Sonnet" }
           ]
         }
       }
     }
     ```
3. **Respostas a Callbacks Reversos**:
   - Se o agente emitir um request com `id` durante o handshake, o pump de stdout do Mercury responde imediatamente com `{"jsonrpc": "2.0", "id": msg.id, "result": null}` para evitar travamento da negociação.

### Constantes Operacionais e Timeouts

- `MODELS_TTL_MS`: `300000` (5 minutos)
- `MODELS_SPAWN_TIMEOUT_MS`: `20000` (20 segundos para listagem CLI)
- `ACP_PROBE_TIMEOUT_MS`: `15000` (15 segundos para probe ACP stdio)
- **Segurança de Processos no Windows**:
  - `proc.kill()` é chamado explicitamente no bloco `finally`.
  - Tratamento de exceções com `try/catch` para evitar `EPERM` ou `ESRCH` em processos já finalizados no Windows.

---

## 4. Configuração Dinâmica e Integração com Servidor (R3 / MERC-003)

### Interface de Configuração (`app/src/paths.ts`)
- `MercuryConfig.provider`: tipo `string | undefined`, aceitando qualquer ID do registro de provedores sem restrição por enum rígido.
- `paths.config`: armazena `~/.mercury/config.json`.

### Endpoints REST do Dashboard (`app/src/server/index.ts`)
- **`GET /api/acp/providers`**:
  - Resposta JSON:
    ```json
    {
      "providers": [
        {
          "id": "opencode",
          "displayName": "OpenCode",
          "models": ["anthropic/claude-3-7-sonnet", "..."],
          "defaultModel": null
        },
        ...
      ],
      "default": "opencode"
    }
    ```
- **Aquecimento de Cache em Background no Boot**:
  - Ao iniciar `dashboardCmd`, dispara `Promise.all(Object.values(PROVIDERS).map(p => listProviderModels(p.id).catch(() => [])))`.
  - O boot do servidor `Bun.serve` não é bloqueado e as primeiras chamadas à interface já encontram o cache preenchido.

---

## 5. Especificação da Suíte de Testes Unitários (R4 / MERC-004)

Arquivo alvo: `app/src/acp/providers.test.ts`  
Framework de Testes: `bun:test` (`describe`, `it`, `expect`)

### Cenários de Teste Mapeados

1. **Integridade do Catálogo de Provedores**:
   - `PROVIDERS` contém exatamente os 38+ provedores cadastrados.
   - Cada entrada possui `id` correspondente à chave, `displayName` não vazio, `bin` definido, `models` contendo pelo menos 1 modelo padrão e função `command` executável.
2. **Resolução de Provedor (`getProvider`)**:
   - Retorna o provedor exato quando passado um ID existente (ex: `gemini`, `claude-code`, `grok-build`).
   - Retorna o provedor padrão `opencode` quando passado `undefined`, `null` ou ID inexistente (`"unknown-provider"`).
3. **Geração de Comandos & Argumentos**:
   - `opencode`: sem modelo gera `cmd: ["opencode", "acp", "--cwd", cwd]`, `env: undefined`. Com modelo gera `OPENCODE_CONFIG_CONTENT` contendo `{"model":"gpt-4o"}`.
   - `claude-code`: sem modelo gera `["bunx", "--bun", "@zed-industries/claude-code-acp"]`, `env: { CLAUDECODE: "" }`. Com modelo adiciona `ANTHROPIC_MODEL`.
   - `claude-acp`: com modelo define `ANTHROPIC_MODEL`.
   - `codex-acp`: com modelo define `OPENAI_MODEL`.
   - `gemini`: com modelo define `GEMINI_MODEL`.
   - `github-copilot-cli`: com modelo define `COPILOT_MODEL`.
   - `cline`: com modelo define `CLINE_MODEL`.
   - `grok-build`: com modelo define `GROK_MODEL`.
   - `mistral-vibe`: com modelo define `MISTRAL_MODEL`.
   - `qwen-code`: com modelo define `QWEN_MODEL`.
   - `glm-acp-agent`: com modelo define `GLM_MODEL`.
   - `kimi`: com modelo define `KIMI_MODEL`.
4. **Resolução de Modelos (`listProviderModels`) & Fallback**:
   - Provedor inexistente retorna array vazio ou modelos estáticos.
   - Provedores com fallback retornam lista estática quando o probe falha/encerra por timeout.
   - Cache com TTL de 5 minutos evita invocações repetidas de subprocessos.
5. **Conformidade de Segurança e PII**:
   - Zero dados reais, chaves de API, credenciais ou dados de usuários nos testes. Apenas identificadores e strings sintéticas.

---

## 6. Governança e Quadro Kanban da Sprint 1 (R5)

### Status dos Cards da Sprint 1

| Card ID | Título | Assignee | Story Points | Coluna Atual | Próxima Ação |
|---|---|---|:---:|---|---|
| `MERC-001` | Expansão do catálogo de 38 Provedores ACP | `@bun-dev` | 3 pts | `03-in-progress` | Concluir validação e mover para `04-in-review` |
| `MERC-002` | Descoberta Universal de Modelos via Bun Shell & ACP Handshake | `@bun-dev` | 5 pts | `02-sprint-backlog` | Implementação e validação |
| `MERC-003` | Suporte a Provedores Dinâmicos na Configuração e CLI | `@bun-dev` | 2 pts | `02-sprint-backlog` | Implementação e validação |
| `MERC-004` | Cobertura de Testes Unitários dos Provedores ACP | `@test-qa` | 3 pts | `02-sprint-backlog` | Implementação de `providers.test.ts` |

---

## 7. Tabelas Formais de Descoberta & Casos de Borda

### Features Discovertas (Features Discovered)

| # | Categoria | Feature | Descrição | Entradas | Saídas | Comportamento de Erro | Descoberto Via |
|---|---|---|---|---|---|---|---|
| 1 | ACP Registry | 38 Provedores Oficiais | Catálogo completo de provedores de IA suportados para execução de skills | `providerId`, `cwd`, `model?` | Objeto `AcpProvider` com comando e env | Fallback para `opencode` se ID não encontrado | `app/src/acp/providers.ts` |
| 2 | ACP Discovery | Probe Handshake ACP stdio | Descoberta dinâmica de `availableModels` via JSON-RPC 2.0 stdio | `providerId`, `timeoutMs` (default 15s) | Lista de strings com `modelId` | Retorna `[]` em caso de erro/timeout | `app/src/acp/providers.ts` |
| 3 | CLI Discovery | Descoberta Bun Shell OpenCode | Enumeração de modelos via comando CLI `opencode models` usando `$` | `MODELS_SPAWN_TIMEOUT_MS` (20s) | Lista de strings de modelos | Fallback para `runWithTimeout` e depois lista estática | `app/src/acp/providers.ts` |
| 4 | Caching | Cache de Modelos com TTL | Cache em memória de 5 minutos para evitar requisições stdio repetidas | `providerId` | Lista de modelos do cache ou atualizada | Recalcula se cache expirado (>5min) | `app/src/acp/providers.ts` |
| 5 | Background Warmup | Aquecimento de Cache no Boot | Disparo concorrente não-bloqueante no boot do dashboard | Lista de todos os provedores | Popula o mapa de cache em background | Captura e ignora erros silenciosamente (`.catch(() => [])`) | `app/src/server/index.ts` |
| 6 | Configuration | Provedor Dinâmico | Suporte a qualquer ID de provedor em `config.json` e flags CLI | String arbitrária de provedor | Persistência e resolução em tempo de execução | Fallback seguro para `opencode` | `app/src/paths.ts` |
| 7 | Unit Testing | Suíte `bun:test` | Testes unitários cobrindo integridade, geração de comandos e modelos | Módulos TypeScript | Relatório de testes do Bun Test | Falhas explícitas com assertion errors | `app/src/acp/providers.test.ts` |

### Casos de Borda (Edge Cases)

| # | Feature | Entrada | Comportamento Observado / Especificado |
|---|---|---|---|
| 1 | `getProvider` | `id = "inexistente_123"` ou `undefined` | Retorna o objeto de configuração do `opencode` como fallback seguro sem lançar exceção. |
| 2 | `listProviderModels` | Provedor sem binário no sistema / sem internet | O probe JSON-RPC falha ou excede o timeout de 15s, retornando a lista de modelos estáticos fallback sem travar. |
| 3 | `probeAcpAgentModels` | Agente envia mensagens de request de volta (reverse callback) | O handler de stdout responde automaticamente com `{"jsonrpc": "2.0", "id": msg.id, "result": null}`, completando o handshake com sucesso. |
| 4 | `probeAcpAgentModels` | Agente retorna `availableModels` contendo modelo `"default"` ou valores nulos | Filtra automaticamente IDs inválidos e descarta `"default"`, retornando apenas identificadores reais de modelo. |
| 5 | Encerramento de Subprocesso | Timeout atingido no Windows | O bloco `finally` executa `proc?.kill()` dentro de um bloco `try/catch` para evitar erros de permissão ou processo inexistente no Windows. |
| 6 | `listOpenCodeModels` | Saída CLI contendo linhas em branco, comentários (`#`, `//`) ou `\r\n` | O parser faz `trim()`, remove `\r` e filtra linhas vazias e comentários. |
| 7 | Concorrência de Inicialização | Múltiplas requisições simultâneas a `/api/acp/providers` | A primeira requisição/aquecimento em background preenche o cache; requisições subsequentes leem imediatamente de `_modelCache`. |
