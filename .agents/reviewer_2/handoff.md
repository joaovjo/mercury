# Relatório de Handoff & Auditoria — Reviewer 2 (Qualidade de Testes e Runtime)

## 1. Observation (Observações Diretas)

### 1.1 Arquivos e Artefatos Auditados
- **Arquivo de Testes Unitários (`D:\mercury\app\src\acp\providers.test.ts:1-167`)**:
  - Implementado utilizando exclusivamente a API nativa de testes do Bun (`import { describe, expect, test } from "bun:test"`).
  - Total de 4 blocos principais de `describe` englobando 22+ asserções individuais e testes parametrizados em loops (`modelCases`, `Object.entries(PROVIDERS)`).
  - Teste `ACP Providers Registry — Integrity & Schema` (`providers.test.ts:12-47`):
    - Validação de contagem mínima: `expect(keys.length).toBeGreaterThanOrEqual(38)`. O catálogo atual em `providers.ts` contém **39 provedores**.
    - Validação de schema para todos os 39 provedores: checagem de tipos e valores não-vazios para `id`, `displayName`, `bin`, `models` (array não-vazio) e `command` (função que retorna `{ cmd: string[] }` com e sem modelo).
    - Validação de argumentos do `opencode` com `--cwd` e workspace parametrizado.
  - Teste `ACP Providers Registry — Model Environment Injections` (`providers.test.ts:49-104`):
    - Parametrização de 11 provedores com injeção de env var de modelo (`claude-code` → `ANTHROPIC_MODEL`, `claude-acp` → `ANTHROPIC_MODEL`, `codex-acp` → `OPENAI_MODEL`, `gemini` → `GEMINI_MODEL`, `github-copilot-cli` → `COPILOT_MODEL`, `cline` → `CLINE_MODEL`, `grok-build` → `GROK_MODEL`, `mistral-vibe` → `MISTRAL_MODEL`, `qwen-code` → `QWEN_MODEL`, `glm-acp-agent` → `GLM_MODEL`, `kimi` → `KIMI_MODEL`).
    - Validação dedicada para `opencode` (`OPENCODE_CONFIG_CONTENT` em formato JSON e `undefined` quando omitido).
    - Validação dedicada para `claude-code` (`CLAUDECODE: ""` presente em todas as invocações).
    - Validação de não-mutação de ambiente em provedores estáticos (`cursor`, `goose`, `devin`, `cortex-code`, `poolside`, `vtcode`).
  - Teste `getProvider — Lookups and Fallbacks` (`providers.test.ts:106-132`):
    - Testes com IDs válidos (`opencode`, `claude-code`, `claude-acp`, `gemini`, `cursor`, `qwen-code`, `devin`, `deepagents`).
    - Testes com fallback para `opencode` em casos de: `undefined`, string vazia (`""`) e ID inexistente (`non-existent-provider-id-99`).
  - Teste `listProviderModels & Discovery Strategy` (`providers.test.ts:134-166`):
    - Resolução assíncrona não-vazia para `opencode`.
    - Fallback para modelos estáticos (`PROVIDERS.gemini.models`) quando o agente não está instalado ou o probe falha.
    - Retorno de array vazio (`[]`) para ID desconhecido (`unknown-fake-agent`).
    - Validação de idempotência e integridade de cache em memória entre chamadas consecutivas.
    - Validação de resiliência e não-lançamento de exceções em `probeAcpAgentModels` com timeout customizado (100ms).

### 1.2 Zero PII (Synthetic Identity Verification)
- Busca global no código de testes confirmou que 100% dos dados, identidades e caminhos são puramente sintéticos:
  - Caminhos de workspace: `/synthetic/workspace`, `/custom/synthetic/work/dir`
  - Nomes de modelos sintéticos: `synthetic-test-model`, `synthetic-model-id`, `synthetic/claude-model`, `synthetic-opus`, `synthetic-custom-model`
  - Nenhum dado pessoal real, API key, token de autenticação ou slug de LinkedIn real foi inserido.

---

## 2. Logic Chain (Cadeia de Raciocínio Lógico)

1. **Conformidade com o Modelo Arquitetural de Mercury**:
   - `providers.test.ts` está perfeitamente co-localizado com `providers.ts` sob `app/src/acp/`, aderindo à regra de layout de `AGENTS.md`.
   - O código utiliza os recursos nativos do Bun (`bun:test`, TypeScript sem transpilação manual) e não introduz qualquer dependência do ecossistema Node/npm/pnpm/yarn.
2. **Robustez dos Casos de Teste e Ausência de Fraude / Integridade**:
   - Não foram detectadas saídas hardcoded ou facades no código fonte que simulem sucesso falso.
   - O handshake JSON-RPC 2.0 em `probeAcpAgentModels` realiza o fluxo real de inicialização (`initialize` → `session/new`) via leitura assíncrona de streams com `TextDecoder`.
   - A camada de timeout utiliza `Promise.race` com encerramento forçado (`proc.kill()`), garantindo que a suíte e a aplicação não sofram com subprocessos zumbis no Windows.
3. **Comportamento de Fallback e Tratamento de Exceções**:
   - As funções `getProvider` e `listProviderModels` são totalmente defensivas: cobrem entradas nulas, vazias, inválidas e agentes inacessíveis, retornando fallbacks determinísticos sem propagar crashes não tratados para o restante da aplicação.

---

## 3. Caveats (Ressalvas)

- **Isolamento de Cache de Módulo**: O `_modelCache` em `providers.ts` é uma estrutura em memória em nível de módulo (`Map`). Como não há método público exposto para reset (`clearModelCache()`), o cache persiste durante a execução do processo. Os testes atuais validam o caching entre chamadas, mas não simulam a expiração do TTL de 5 minutos (300.000 ms) com timers falsos.
- **Execução Interativa via Shell**: Em ambientes CI com restrições de permissão para execução de subprocessos interativos, os testes puramente unitários de `providers.test.ts` executam sem dependência de rede externa ou binários reais pré-instalados, graças à estratégia de fallback estático já validada.

---

## 4. Quality Review Report

### Review Summary
**Verdict**: **APPROVE**

### Findings
- **Nenhum Finding Crítico ou Maior**.
- **[Minor] Finding 1 — Ausência de helper de expiração de cache para testes**:
  - *Onde*: `app/src/acp/providers.ts:423-431`
  - *Contexto*: `_modelCache` não expõe método de limpeza ou injeção de clock (`nowFn`), impossibilitando testar a expiração exata dos 5 minutos de TTL sem aguardar o tempo real.
  - *Sugestão*: Em sprints futuras, exportar opcionalmente uma função `_clearModelCacheForTesting()` ou aceitar um `Clock` injetável se for necessário testar a invalidação periódica em CI.

### Verified Claims
- Cobertura completa de todos os 39 provedores do catálogo ACP → **PASS**
- Validação de injeção de env vars para os 11 agentes parametrizados + OpenCode + Claude-Code → **PASS**
- Comportamento de fallback de `getProvider` para `undefined`, vazio e desconhecido → **PASS**
- Fallback estático e resiliência a timeout de `listProviderModels` → **PASS**
- Zero PII (identidades e caminhos 100% sintéticos) → **PASS**

### Coverage Gaps
- Nenhum gap material identificado para o escopo da Sprint 1 (MERC-004).

---

## 5. Adversarial Challenge Report

### Challenge Summary
**Overall risk assessment**: **LOW**

### Challenges

#### [Low] Challenge 1: Agente ACP com output malformado ou stream corrompido
- *Suposição testada*: O parser JSON-RPC lida com linhas não-JSON ou incompletas no stdout.
- *Cenário de ataque*: O agente externo envia mensagens de log de depuração misturadas com frames JSON-RPC ou linhas quebradas.
- *Mitigação observada*: O loop em `probeAcpAgentModels` (`providers.ts:510-526`) acumula chunks em buffer, processa por delimitador `\n` e engole falhas de `JSON.parse(line)` em bloco `try/catch` sem quebrar o reader, mantendo a leitura até o próximo frame válido ou timeout.
- *Resultado*: Robusto.

#### [Low] Challenge 2: Esgotamento de timeout e processos pendentes no Windows
- *Suposição testada*: Subprocessos encerrados por timeout não deixam handles abertos no Windows.
- *Cenário de ataque*: O processo filho trava no handshake e o timeout expira.
- *Mitigação observada*: O `Promise.race` resolve e o bloco `finally` executa `proc?.kill()` dentro de `try/catch`, liberando os descritores de arquivo de stdio.
- *Resultado*: Robusto.

---

## 6. Conclusion (Conclusão)

A suíte de testes unitários `app/src/acp/providers.test.ts` atende a todos os critérios de qualidade, abrangência, robustez de runtime e integridade exigidos pela Sprint 1 (MERC-004). Não há violações de integridade, facades simuladas ou dados reais (PII).

**Veredito Oficial**: **APPROVE**

---

## 7. Verification Method (Método de Verificação Independente)

Para reproduzir a verificação de forma independente:

1. **Executar a suíte de testes unitários**:
   ```powershell
   cd D:\mercury\app
   bun test src/acp/providers.test.ts
   bun test
   ```
2. **Executar a checagem estática de tipos**:
   ```powershell
   cd D:\mercury\app
   bun run typecheck
   ```
3. **Auditar o arquivo de testes**:
   - Inspecionar `D:\mercury\app\src\acp\providers.test.ts`
   - Inspecionar `D:\mercury\app\src\acp\providers.ts`
4. **Verificar ausência de PII via ripgrep**:
   ```powershell
   cd D:\mercury\app
   git grep -i -E "linkedin\.com/in|@gmail|@hotmail|token|secret" src/acp/
   ```
