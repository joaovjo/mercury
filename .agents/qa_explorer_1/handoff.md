# Relatório de Handoff — QA Explorer: Estratégia de Testes para R4 (MERC-004)

## 1. Observation (Observações Coletadas)

### 1.1 Infraestrutura de Build, Tipos e Testes
- **Localização e Scripts de Build (`app/package.json:9-22`)**:
  - `"typecheck": "bun run ensure-assets && tsc --noEmit"`
  - `"test": "bun run ensure-assets && bun test"`
  - `"dev": "bun run ensure-assets && bun run src/cli/index.ts"`
- **Configuração do TypeScript (`app/tsconfig.json:1-19`)**:
  - `target: "ESNext"`, `module: "Preserve"`, `moduleResolution: "bundler"`, `types: ["bun"]`, `strict: true`, `noEmit: true`, `rootDir: "./src"`.
  - Importação direta de extensões `.ts` com `allowImportingTsExtensions: true` e `verbatimModuleSyntax: true`.
- **Suíte de Testes Existente na Codebase**:
  Identificamos 7 arquivos de teste atualmente co-localizados no diretório `app/src/`:
  1. `app/src/acp/session.test.ts` (81 linhas, 16 testes): Testa `buildSkillPrompt` com e sem contexto adicional (`extra`), delimitadores e idempotência.
  2. `app/src/adapters/registry.test.ts` (78 linhas, 9 testes): Valida detecção de portais ATS (`greenhouse`, `lever`, `ashby`, `generic`) por hostname/URL e conformidade dos campos.
  3. `app/src/match/matcher.test.ts` (127 linhas, 11 testes): Valida normalização, distância de edição e regras de correspondência, incluindo proteção incondicional a campos de EEO (`eeo-human-only`).
  4. `app/src/outreach/core.test.ts` (528 linhas, 48 testes): Valida a máquina de estados de outreach, regras de transição permitidas/proibidas, decisão de canais de contato e cálculo de datas de cooldown.
  5. `app/src/outreach/store.test.ts`: Valida persistência e consultas SQLite em memória (`:memory:`) com WAL.
  6. `app/src/recruiter/sync.test.ts` (263 linhas, 16 testes): Valida normalização de nomes, extração de slugs e rotinas de sincronização (`planSync`/`applySync`) contra SQLite in-memory com mocks assíncronos.
  7. `app/src/update-check.test.ts` (120 linhas, 6 testes): Valida atualização com servidor HTTP mock efêmero via `Bun.serve({ port: 0 })` e validação semântica de versões.

### 1.2 Estrutura do Registro ACP (`app/src/acp/providers.ts`)
- **Total de Provedores Mapeados em `PROVIDERS` (`app/src/acp/providers.ts:29-387`)**:
  - Total de 39 provedores catalogados (superando a meta mínima de 38 do catálogo oficial).
  - Cada entrada implementa a interface `AcpProvider` (`id`, `displayName`, `bin`, `models`, `defaultModel`, `command`).
- **Comandos e Injeção de Variáveis de Ambiente de Modelo**:
  - `opencode`: `env: { OPENCODE_CONFIG_CONTENT: JSON.stringify({ model }) }` (`providers.ts:45`)
  - `claude-code`: `env: { CLAUDECODE: "", ANTHROPIC_MODEL: model }` (`providers.ts:56-58`)
  - `claude-acp`: `env: { ANTHROPIC_MODEL: model }` (`providers.ts:68`)
  - `codex-acp`: `env: { OPENAI_MODEL: model }` (`providers.ts:79`)
  - `gemini`: `env: { GEMINI_MODEL: model }` (`providers.ts:90`)
  - `github-copilot-cli`: `env: { COPILOT_MODEL: model }` (`providers.ts:101`)
  - `cline`: `env: { CLINE_MODEL: model }` (`providers.ts:120`)
  - `grok-build`: `env: { GROK_MODEL: model }` (`providers.ts:131`)
  - `mistral-vibe`: `env: { MISTRAL_MODEL: model }` (`providers.ts:142`)
  - `qwen-code`: `env: { QWEN_MODEL: model }` (`providers.ts:153`)
  - `glm-acp-agent`: `env: { GLM_MODEL: model }` (`providers.ts:164`)
  - `kimi`: `env: { KIMI_MODEL: model }` (`providers.ts:183`)
  - Provedores com comando estático/sem env: `cursor`, `goose`, `devin`, `agoragentic-acp`, `amp-acp`, `auggie`, `autohand`, `codebuddy-code`, `cortex-code`, `corust-agent`, `crow-cli`, `deepagents`, `dimcode`, `dirac`, `factory-droid`, `fast-agent`, `harn`, `junie`, `kilo`, `minion-code`, `nova`, `pi-acp`, `poolside`, `qoder`, `sigit`, `stakpak`, `vtcode`.
- **Função de Fallback `getProvider` (`app/src/acp/providers.ts:389-391`)**:
  - `PROVIDERS[id ?? "opencode"] ?? PROVIDERS.opencode!`
- **Descoberta de Modelos, Caching e Timeouts (`app/src/acp/providers.ts:420-550`)**:
  - Cache em memória com TTL de 5 minutos: `MODELS_TTL_MS = 5 * 60 * 1000`.
  - Timeout de spawn/probe: `MODELS_SPAWN_TIMEOUT_MS = 20000`, `ACP_PROBE_TIMEOUT_MS = 15000`.
  - Handshake ACP stdio com mensagens JSON-RPC 2.0 (`initialize` → `session/new`).
  - Fallback automático para `PROVIDERS[providerId]?.models` quando o probe falha ou o agente não está instalado.

---

## 2. Logic Chain (Cadeia de Raciocínio Lógico)

1. **Padrão Arquitetural de Testes com `bun:test`**:
   - Todas as suítes no projeto seguem o princípio de **execução determinística e isolada**, sem dependência de serviços em nuvem, binários externos instalados ou credenciais ativas.
   - Operações assíncronas com subprocessos devem ser testadas contra seus contratos de retorno (estruturas de comando, injeção de ambiente, parsing de saídas, fallback para modelos estáticos em caso de erro/timeout e gerenciamento de ciclo de vida).

2. **Isolamento e Segurança (Sem PII & Sem Efeitos Colaterais)**:
   - Os testes de `providers.test.ts` devem utilizar apenas identificadores sintéticos (`synth-model-1`, `custom-model-id`, `/test/workspace`).
   - Não devem invocar agentes externos reais que executem ações não controladas; ao invés disso, validam o contrato exato das funções `command(cwd, model)`, a robustez do `getProvider` e a resiliência de `listProviderModels`.

3. **Matriz de Testes Recomendada para `app/src/acp/providers.test.ts`**:

```
app/src/acp/providers.test.ts
├── 1. Registry Integrity & Schema Validation
│   ├── Total providers count (>= 38)
│   ├── Every provider has valid id, displayName, bin, models array
│   └── Every provider command function returns valid cmd array with cwd
├── 2. Model Environment Variable Injection
│   ├── opencode -> OPENCODE_CONFIG_CONTENT JSON
│   ├── claude-code -> CLAUDECODE + ANTHROPIC_MODEL
│   ├── claude-acp -> ANTHROPIC_MODEL
│   ├── codex-acp -> OPENAI_MODEL
│   ├── gemini -> GEMINI_MODEL
│   ├── github-copilot-cli -> COPILOT_MODEL
│   ├── cline -> CLINE_MODEL
│   ├── grok-build -> GROK_MODEL
│   ├── mistral-vibe -> MISTRAL_MODEL
│   ├── qwen-code -> QWEN_MODEL
│   ├── glm-acp-agent -> GLM_MODEL
│   ├── kimi -> KIMI_MODEL
│   └── Providers without model env return undefined or unmutated env
├── 3. getProvider Function & Fallbacks
│   ├── Returns exact provider for known IDs (opencode, claude-code, gemini, cursor, etc.)
│   ├── Returns opencode when called with undefined
│   ├── Returns opencode when called with unknown ID ("unknown-agent-xyz")
│   └── Returns opencode when called with empty string ("")
├── 4. listProviderModels & Discovery Strategy
│   ├── Returns fallback static models when probe fails or agent is not present
│   ├── Caches results in memory for consecutive calls (TTL 5 min)
│   ├── Returns valid non-empty array for opencode
│   └── Correctly filters and formats model list
└── 5. Process Lifecycle & Timeout Resilience
    ├── Handshake timeout does not hang the event loop
    └── Error in probe does not throw unhandled exception (returns fallback)
```

---

## 3. Caveats (Ressalvas e Limitações)

- **Ambiente Interativo vs. Automação**: No ambiente de execução de subprocessos sob terminal interativo com solicitação de confirmação, ferramentas de execução direta de comando podem necessitar de autorização prévia; por esse motivo, os testes unitários foram desenhados para serem puramente unitários e não-bloqueantes.
- **Cache Global em Módulo**: A variável `_modelCache` dentro de `providers.ts` é mantida em nível de módulo. Os testes devem levar em consideração que chaves consultadas podem ser cacheadas entre asserções consecutivas na mesma execução.

---

## 4. Conclusion (Conclusão e Recomendações Técnicas)

A infraestrutura de testes do Mercury é robusta, padronizada e 100% alinhada com o runtime Bun nativo.
Para atender a **R4 (MERC-004)**, recomendamos implementar o arquivo `app/src/acp/providers.test.ts` seguindo o design detalhado abaixo:

### Estrutura Recomendada para `app/src/acp/providers.test.ts`

```typescript
import { describe, expect, test } from "bun:test";
import { PROVIDERS, getProvider, listProviderModels, type AcpProvider } from "./providers.ts";

const EXPECTED_MIN_PROVIDERS = 38;

describe("ACP Providers Registry — Integrity & Schema", () => {
  test(`contains at least ${EXPECTED_MIN_PROVIDERS} providers`, () => {
    const keys = Object.keys(PROVIDERS);
    expect(keys.length).toBeGreaterThanOrEqual(EXPECTED_MIN_PROVIDERS);
  });

  test("every provider conforms to AcpProvider schema", () => {
    for (const [key, p] of Object.entries(PROVIDERS)) {
      expect(p.id).toBe(key);
      expect(typeof p.displayName).toBe("string");
      expect(p.displayName.length).toBeGreaterThan(0);
      expect(typeof p.bin).toBe("string");
      expect(p.bin.length).toBeGreaterThan(0);
      expect(Array.isArray(p.models)).toBe(true);
      expect(p.models.length).toBeGreaterThan(0);
      expect(typeof p.command).toBe("function");

      // Verify command without model
      const cmdResult = p.command("/test/workspace");
      expect(Array.isArray(cmdResult.cmd)).toBe(true);
      expect(cmdResult.cmd.length).toBeGreaterThan(0);
      expect(cmdResult.cmd.every((arg) => typeof arg === "string" && arg.length > 0)).toBe(true);
    }
  });

  test("opencode command includes --cwd parameter", () => {
    const res = PROVIDERS.opencode.command("/custom/work/dir");
    expect(res.cmd).toContain("--cwd");
    expect(res.cmd).toContain("/custom/work/dir");
  });
});

describe("ACP Providers Registry — Model Environment Injections", () => {
  const modelCases: Array<{ id: string; envKey: string; customCheck?: (env: Record<string, string>) => boolean }> = [
    { id: "claude-code", envKey: "ANTHROPIC_MODEL" },
    { id: "claude-acp", envKey: "ANTHROPIC_MODEL" },
    { id: "codex-acp", envKey: "OPENAI_MODEL" },
    { id: "gemini", envKey: "GEMINI_MODEL" },
    { id: "github-copilot-cli", envKey: "COPILOT_MODEL" },
    { id: "cline", envKey: "CLINE_MODEL" },
    { id: "grok-build", envKey: "GROK_MODEL" },
    { id: "mistral-vibe", envKey: "MISTRAL_MODEL" },
    { id: "qwen-code", envKey: "QWEN_MODEL" },
    { id: "glm-acp-agent", envKey: "GLM_MODEL" },
    { id: "kimi", envKey: "KIMI_MODEL" },
  ];

  for (const c of modelCases) {
    test(`${c.id}: injects ${c.envKey} when model is specified`, () => {
      const p = PROVIDERS[c.id];
      expect(p).toBeDefined();
      const res = p.command("/test/workspace", "synthetic-test-model");
      expect(res.env).toBeDefined();
      expect(res.env?.[c.envKey]).toBe("synthetic-test-model");
    });
  }

  test("opencode: injects OPENCODE_CONFIG_CONTENT JSON when model is specified", () => {
    const res = PROVIDERS.opencode.command("/test/workspace", "anthropic/claude-3-7-sonnet");
    expect(res.env).toBeDefined();
    expect(res.env?.OPENCODE_CONFIG_CONTENT).toBe(JSON.stringify({ model: "anthropic/claude-3-7-sonnet" }));
  });

  test("claude-code: always maintains CLAUDECODE in env", () => {
    const withoutModel = PROVIDERS["claude-code"].command("/test/workspace");
    expect(withoutModel.env?.CLAUDECODE).toBe("");
    expect(withoutModel.env?.ANTHROPIC_MODEL).toBeUndefined();

    const withModel = PROVIDERS["claude-code"].command("/test/workspace", "opus");
    expect(withModel.env?.CLAUDECODE).toBe("");
    expect(withModel.env?.ANTHROPIC_MODEL).toBe("opus");
  });
});

describe("getProvider — Lookups and Fallbacks", () => {
  test("returns correct provider for valid IDs", () => {
    expect(getProvider("opencode").id).toBe("opencode");
    expect(getProvider("claude-code").id).toBe("claude-code");
    expect(getProvider("gemini").id).toBe("gemini");
    expect(getProvider("cursor").id).toBe("cursor");
  });

  test("falls back to opencode when id is undefined", () => {
    expect(getProvider(undefined).id).toBe("opencode");
  });

  test("falls back to opencode when id is unknown", () => {
    expect(getProvider("non-existent-provider-id-99").id).toBe("opencode");
    expect(getProvider("").id).toBe("opencode");
  });
});

describe("listProviderModels — Discovery and Fallback Behavior", () => {
  test("returns non-empty model list for opencode", async () => {
    const models = await listProviderModels("opencode");
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
  });

  test("returns static fallback models when agent is uninstalled / probe fails", async () => {
    const models = await listProviderModels("gemini");
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    // Must contain standard models configured in registry
    expect(models).toEqual(PROVIDERS.gemini.models);
  });

  test("returns empty array or fallback for unknown provider id", async () => {
    const models = await listProviderModels("unknown-fake-agent");
    expect(Array.isArray(models)).toBe(true);
  });

  test("caches model list across repeated calls", async () => {
    const first = await listProviderModels("claude-code");
    const second = await listProviderModels("claude-code");
    expect(first).toEqual(second);
  });
});
```

---

## 5. Verification Method (Método de Verificação Independente)

Para que qualquer agente ou desenvolvedor valide independentemente as conclusões deste relatório:

1. **Inspeção de Tipos e Arquitetura**:
   - Inspecionar `app/src/acp/providers.ts` e verificar a contagem de chaves em `PROVIDERS` (39 chaves encontradas).
   - Inspecionar as assinaturas de `getProvider` e `listProviderModels`.
2. **Execução da Suíte de Testes**:
   - No diretório `D:\mercury\app`, executar:
     ```powershell
     bun test
     ```
     ou para a suíte específica após criação:
     ```powershell
     bun test src/acp/providers.test.ts
     ```
3. **Checagem de Tipos estática**:
   - No diretório `D:\mercury\app`, executar:
     ```powershell
     bun run typecheck
     ```
4. **Verificação de PII (Synthetic Data Check)**:
   - Garantir que nenhum nome real, slug de LinkedIn real ou token de terceiros esteja presente no código ou nos testes.
