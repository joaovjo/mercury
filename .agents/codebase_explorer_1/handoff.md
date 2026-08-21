# Relatório de Handoff — Codebase Explorer (ACP & Servidor)

**Data**: 2026-08-20T22:50:00Z  
**Autor**: Codebase Explorer (`codebase_explorer_1`)  
**Destinatário**: Lead Architect / Parent Agent (`14797777-1978-436e-9d81-2eb87bfbdccd`)  
**Escopo**: Investigação do código-fonte do Mercury (`app/src/acp/`, `app/src/paths.ts`, `app/src/server/`) para suporte aos requisitos R1 (38 Provedores ACP), R2 (Descoberta Universal de Modelos via Bun Shell e Handshake), R3 (Configuração Dinâmica de Provedores) e R4 (Testes Unitários em Bun Test).

---

## 1. Observation (Observação)

### 1.1 Registro de Provedores ACP (`app/src/acp/providers.ts`)
- **Interfaces e Tipos**:
  - `AcpProviderCommand` (linhas 11-14): define o comando a ser executado e variáveis de ambiente associadas (`cmd: string[]; env?: Record<string, string>;`).
  - `AcpProvider` (linhas 16-27): define as propriedades do provedor (`id`, `displayName`, `models`, `defaultModel`, `command: (cwd: string, model?: string) => AcpProviderCommand`, `bin`).
- **Dicionário `PROVIDERS`** (linhas 29-387):
  - Registra **39 provedores** cobrindo a totalidade do catálogo oficial do ACP Registry.
  - Provedores como `opencode`, `claude-code`, `claude-acp`, `codex-acp`, `gemini`, `github-copilot-cli`, `cline`, `grok-build`, `qwen-code`, `glm-acp-agent` utilizam comandos `bunx` sob demanda com pacotes npm oficiais (ex: `bunx @google/gemini-cli@latest --acp`, `bunx @agentclientprotocol/codex-acp@latest`).
  - Provedores nativos (ex: `cursor`, `mistral-vibe`, `goose`, `kimi`, `devin`, `crow-cli`, `harn`, `junie`, `minion-code`, `poolside`, `stakpak`, `vtcode`) utilizam seus respectivos binários de linha de comando.
  - A injeção do modelo selecionado é customizada por provedor via variáveis de ambiente específicas (ex: `OPENCODE_CONFIG_CONTENT` para OpenCode, `ANTHROPIC_MODEL` para Claude Code/Claude Agent, `OPENAI_MODEL` para Codex, `GEMINI_MODEL` para Gemini CLI, `COPILOT_MODEL` para Copilot, `CLINE_MODEL` para Cline, `GROK_MODEL` para Grok, `MISTRAL_MODEL` para Mistral, `QWEN_MODEL` para Qwen, etc.).
- **Helper `getProvider(id)`** (linhas 389-391):
  - Retorna `PROVIDERS[id ?? "opencode"] ?? PROVIDERS.opencode!`, garantindo fallback seguro para `opencode` se o ID for nulo, indefinido ou desconhecido.
- **Descoberta de Modelos e Cache** (linhas 419-464):
  - Cache em memória com TTL de 5 minutos: `_modelCache = new Map<string, { at: number; models: string[] }>()` com `MODELS_TTL_MS = 5 * 60 * 1000`.
  - `listProviderModels(providerId)`:
    - Se `providerId === "opencode"`, chama `listOpenCodeModels()`, que utiliza `import { $ } from "bun"` para executar `$` `opencode models` `.timeout(20000).text()`, com fallback para `runWithTimeout`.
    - Para outros agentes, chama `probeAcpAgentModels(providerId, 15000)`. Se a sondagem retornar vazia, realiza fallback imediato para a lista estática `PROVIDERS[providerId]?.models`.
- **Handshake ACP Universal (`probeAcpAgentModels`)** (linhas 471-550):
  - Executa `Bun.spawn(cmd, { cwd, stdin: "pipe", stdout: "pipe", stderr: "ignore", env })`.
  - Executa handshake JSON-RPC stdio:
    1. Envia requisição `initialize` (`protocolVersion: 1`, `clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } }`).
    2. Envia requisição `session/new` (`{ cwd, mcpServers: [] }`).
    3. Extrai `session.models.availableModels`, mapeando `modelId` e descartando o identificador `"default"`.
  - Timeout bounded por `Promise.race([handshake, timeout])` (15 segundos padrão).
  - No bloco `finally`, encerra o processo de sondagem com `try { proc?.kill(); } catch {}`.

### 1.2 Cliente ACP e Gerenciador de Sessão (`app/src/acp/client.ts` e `app/src/acp/session.ts`)
- **`AcpClient` (`client.ts`)**:
  - Implementa cliente JSON-RPC 2.0 delimitado por quebra de linha (`\n`) sobre stdio (`stdin`, `stdout`, `stderr`).
  - Executa o handshake de duas etapas (`initialize` → `session/new`).
  - `prompt(text)` despacha `session/prompt` associado ao `sessionId`.
  - Trata requisições reversas do agente: `session/update` (streaming de progresso), `session/request_permission` (permissões de ferramentas com fallback `firstAllowOption`), `fs/read_text_file` e `fs/write_text_file` para leitura/escrita de arquivos.
- **`SessionManager` (`session.ts`)**:
  - Garante execução atômica (apenas 1 skill por vez).
  - Encaminha todos os eventos do agente via callback sink (`acp-status`, `acp-update`, `acp-permission`, `acp-log`, `acp-error`, `acp-exit`).
  - `buildSkillPrompt(skill, params)` adiciona contexto adicional do usuário (`params.extra`) com delimitador padronizado.

### 1.3 Configuração de Caminhos e Persistência (`app/src/paths.ts`)
- `MercuryConfig` (linhas 30-45) inclui `provider?: string`.
- `loadConfig()` e `saveConfig(cfg)` persistem em `~/.mercury/config.json`.

### 1.4 Servidor Dashboard e Rotas da API (`app/src/server/index.ts`)
- Inicializa servidor via `Bun.serve` em `127.0.0.1`.
- Rota `GET /api/acp/providers` (linhas 160-174):
  - Carrega a configuração do usuário (`cfg = loadConfig()`).
  - Mapeia todos os provedores em `PROVIDERS`, resolvendo seus modelos dinamicamente via `listProviderModels(p.id)`.
  - Retorna `{ providers: providerEntries, default: cfg.provider ?? "opencode" }`.
- Rota `POST /api/acp/run` (linhas 175-185):
  - Aceita `provider` arbitrário e repassa para `acp.run(body.provider ?? "opencode", body.skill ?? "", body.params ?? {}, body.model)`.
- Rota `POST /api/acp/cancel` (linhas 186-189): cancela a execução ativa.
- Aquecimento em background no boot (linhas 246-248):
  - `void Promise.all(Object.values(PROVIDERS).map((p) => listProviderModels(p.id).catch(() => [])));` aquece o cache sem travar o boot.

---

## 2. Logic Chain (Cadeia Lógica)

1. **R1 (38 Provedores do ACP Registry - MERC-001)**:
   - A especificação exigia o mapeamento dos 38 agentes do catálogo oficial do ACP.
   - Observou-se que `PROVIDERS` em `app/src/acp/providers.ts` já contempla 39 provedores com suas respectivas configurações de `command`, `bin`, `models` e variáveis de ambiente de modelo.
   - O helper `getProvider` já está implementado e fornece fallback seguro.

2. **R2 (Descoberta Universal de Modelos via Bun Shell e Handshake - MERC-002)**:
   - A descoberta para OpenCode usa Bun Shell (`import { $ } from "bun"`) com `$opencode models` e timeout de 20s.
   - A descoberta universal para demais agentes utiliza `probeAcpAgentModels`, realizando o handshake leve stdio (`initialize` → `session/new`) e extraindo `models.availableModels`.
   - O cache com TTL de 5 minutos (`_modelCache`) e fallback estático garante que a UI nunca trave ou fique sem modelos.
   - O fechamento de processos via `proc.kill()` no `finally` previne processos órfãos no Windows.

3. **R3 (Provedores Dinâmicos e Configuração - MERC-003)**:
   - `MercuryConfig.provider?: string` em `app/src/paths.ts` permite configurar qualquer ID registrado.
   - O endpoint `/api/acp/providers` e o frontend (`LaunchSection.tsx`) já consomem e populam dinamicamente a lista de provedores e modelos.
   - O servidor no boot realiza aquecimento assíncrono em background sem atrasar a inicialização.

4. **R4 (Suíte de Testes Unitários com Bun Test - MERC-004)**:
   - A criação de `app/src/acp/providers.test.ts` usando `bun:test` consolidará a validação automatizada de todos os 38 provedores, comandos, fallbacks de modelo e resiliência a timeouts.

---

## 3. Caveats (Ressalvas)

- **Binários Locais no Windows**: Provedores como `cursor-agent`, `vibe-acp`, `goose`, `kimi`, `devin` requerem que os respectivos executáveis estejam instalados e presentes no `PATH` para responderem ao handshake. Na ausência do binário, `probeAcpAgentModels` falha silenciosamente e o fallback estático de `PROVIDERS[id].models` assume com segurança.
- **Autenticação de Provedores `bunx`**: Agentes executados via `bunx` sob demanda requerem conexão à internet na primeira execução e suas respectivas chaves de API caso o handshake exija credenciais imediatas. O timeout de 15s protege a interface contra atrasos.
- **Flags de CLI no Servidor**: O helper `str(flags, "provider")` pode ser utilizado como precedência adicional sobre `cfg.provider` no boot do servidor caso fornecido via linha de comando (`mercury dashboard --provider <id>`).

---

## 4. Conclusion (Conclusão)

A base de código do Mercury relacionada ao Agent Client Protocol (ACP) e ao servidor está tecnicamente estruturada, robusta e compatível com as diretrizes de Bun nativo e Windows.

**Mapeamento de Status da Sprint 1**:
- **MERC-001** (R1): Implementado e pronto para validação de testes.
- **MERC-002** (R2): Implementado com Bun Shell, handshake ACP stdio e cache de 5 minutos.
- **MERC-003** (R3): Implementado em `paths.ts` e `server/index.ts`.
- **MERC-004** (R4): Pronto para implementação da suíte de testes unitários `app/src/acp/providers.test.ts` com `bun:test`.

---

## 5. Verification Method (Método de Verificação)

Para verificar de forma independente as observações e conclusões deste relatório:

1. **Inspeção de Código**:
   - Inspecionar `app/src/acp/providers.ts` para verificar as definições dos 39 provedores e funções `getProvider`, `listProviderModels`, `probeAcpAgentModels`.
   - Inspecionar `app/src/paths.ts` para verificar `MercuryConfig.provider`.
   - Inspecionar `app/src/server/index.ts` para verificar a rota `/api/acp/providers` e o aquecimento em background.

2. **Verificação de Tipos TypeScript**:
   ```powershell
   cd d:\mercury\app
   bun run typecheck
   ```

3. **Execução dos Testes Unitários**:
   ```powershell
   cd d:\mercury\app
   bun test src/acp/session.test.ts
   bun test src/acp/providers.test.ts
   bun test
   ```

4. **Condição de Invalidação**:
   - Caso `bun run typecheck` falhe ou `PROVIDERS` não contenha os provedores esperados do ACP Registry.
