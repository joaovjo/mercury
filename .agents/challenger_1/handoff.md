# Relatório de Handoff — Challenger 1 (Descoberta de Modelos e Casos de Borda)

**Veredito:** `REQUEST_CHANGES`

---

## 1. Observation (Observações Diretas)

### 1.1 Vulnerabilidade de Prototype Lookup em `getProvider`
- **Arquivo**: `D:\mercury\app\src\acp\providers.ts`
- **Linhas**: 389–391
```typescript
export function getProvider(id: string | undefined): AcpProvider {
  return PROVIDERS[id ?? "opencode"] ?? PROVIDERS.opencode!;
}
```
- **Comportamento Observado**:
  `PROVIDERS` é um objeto JavaScript literal herdado de `Object.prototype`. Quando `id` corresponde a qualquer propriedade padrão de objeto (`"toString"`, `"valueOf"`, `"constructor"`, `"hasOwnProperty"`, `"isPrototypeOf"`, `"propertyIsEnumerable"`, `"toLocaleString"`, `"__proto__"`):
  1. `PROVIDERS["toString"]` avalia para a função nativa `Object.prototype.toString`.
  2. Como funções em JavaScript são valores *truthy*, o operador de coalescência nula (`??`) retorna a função `[Function: toString]` em vez de acionar o fallback para `PROVIDERS.opencode!`.
  3. O valor retornado não satisfaz a interface `AcpProvider` (campos `id`, `displayName`, `bin`, `models` e `command` são `undefined`).
  4. Qualquer chamada subsequente como `p.command(cwd)` (e.g. em `AcpClient.start()` em `app/src/acp/client.ts:57`) resulta em exceção fatal não tratada:
     `TypeError: provider.command is not a function`.

### 1.2 Timers de Timeout Não Cancelados em `runWithTimeout` e `probeAcpAgentModels`
- **Arquivo**: `D:\mercury\app\src\acp\providers.ts`
- **Linhas**: 405–413 e Linha 541
```typescript
const timeout = new Promise<null>((resolve) =>
  setTimeout(() => {
    try {
      proc.kill();
    } catch {}
    resolve(null);
  }, timeoutMs),
);
```
- **Comportamento Observado**:
  Quando `collect` ou `handshake` conclui com sucesso antes do término de `timeoutMs` (15s–20s), o identificador do timer criado pelo `setTimeout` não é cancelado via `clearTimeout`. Isso retém temporizadores ativos no Event Loop do runtime Bun.

### 1.3 Concorrência e Risco de Thundering Herd / Process Spawning em Lote
- **Arquivo**: `D:\mercury\app\src\server\index.ts`
- **Linhas**: 162–169
```typescript
const providerEntries = await Promise.all(
  Object.values(PROVIDERS).map(async (p) => ({
    id: p.id,
    displayName: p.displayName,
    models: await listProviderModels(p.id),
    defaultModel: p.defaultModel,
  })),
);
```
- **Comportamento Observado**:
  Na inicialização ou primeira requisição a `GET /api/acp/providers`, `Promise.all` invoca `listProviderModels` simultaneamente para todos os 39 provedores registrados. Como o cache (`_modelCache`) só é preenchido após a conclusão de cada probe assíncrono (que pode levar até 15 segundos cada), 38 subprocessos são disparados no mesmo instante sem controle de concorrência / pool.

### 1.4 Pontos Fortes e Validações Positivas
- **Catálogo Completo**: 39 provedores mapeados (superando a meta de 38 provedores de MERC-001).
- **Injeção de Variáveis de Ambiente**: Mapeamentos corretos para todos os 11 agentes parametrizados (`OPENCODE_CONFIG_CONTENT`, `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL`, `COPILOT_MODEL`, `CLINE_MODEL`, `GROK_MODEL`, `MISTRAL_MODEL`, `QWEN_MODEL`, `GLM_MODEL`, `KIMI_MODEL`).
- **Resiliência a Caracteres Especiais e Nulos**: Entradas como `""`, `undefined`, `null`, strings com espaços e caracteres especiais em geral executam fallback limpo para `opencode`.
- **Privacidade e PII**: Zero dados pessoais ou credenciais reais nos arquivos (identidades e caminhos sintéticos conforme `AGENTS.md`).

---

## 2. Logic Chain (Cadeia Lógica)

1. **Premissa 1**: Conforme o contrato da interface `getProvider(id: string | undefined): AcpProvider`, a função deve sempre retornar uma instância válida de `AcpProvider` que possua uma função `command(cwd, model)`.
2. **Premissa 2**: Em JavaScript/TypeScript, objetos criados com `{ ... }` contêm métodos de protótipo em `Object.prototype`. Acessar `PROVIDERS[id]` com chaves de protótipo (`"toString"`, `"constructor"`, `"valueOf"`) não retorna `undefined`, mas sim a função nativa correspondente.
3. **Inferência 1**: Quando um identificador como `"toString"` for passado para `getProvider("toString")`, o retorno é `Object.prototype.toString`.
4. **Inferência 2**: Invocar `.command()` no retorno causa `TypeError: provider.command is not a function`, quebrando a resiliência do sistema.
5. **Premissa 3**: Timers ativos sem cancelamento acumulam handles no runtime Bun durante operações de alta frequência ou testes repetidos.
6. **Conclusão**: Para atender aos requisitos de robustez para casos de borda e estabilidade em subprocessos, são necessárias correções pontuais antes da aprovação final.

---

## 3. Caveats (Ressalvas)

- O comportamento dos 38 agentes ACP em execução real foi validado por meio de testes sintéticos, análise estática de comandos, verificação de fallbacks de timeout e terminação segura de processos. Binários externos reais (como `opencode`, `goose`, `kimi`) não foram executados contra servidores remotos ao vivo.
- O thundering herd em `server/index.ts` afeta prioritariamente o boot inicial sem cache; chamadas subsequentes dentro da janela de TTL (5 min) são servidas instantaneamente da memória.

---

## 4. Conclusion (Conclusão e Ações Recomendadas)

**Status:** `REQUEST_CHANGES`

### Alterações Necessárias (Fixes Recomendados para o Dev Agent):

1. **Corrigir `getProvider` e `probeAcpAgentModels` em `app/src/acp/providers.ts`**:
Substituir o acesso indexado direto por verificação com `Object.hasOwn`:
```typescript
export function getProvider(id: string | undefined): AcpProvider {
  if (typeof id === "string" && Object.hasOwn(PROVIDERS, id)) {
    return PROVIDERS[id]!;
  }
  return PROVIDERS.opencode!;
}
```

2. **Blindar `probeAcpAgentModels` e `listProviderModels` contra chaves de protótipo**:
```typescript
export async function probeAcpAgentModels(providerId: string, timeoutMs: number = ACP_PROBE_TIMEOUT_MS): Promise<string[]> {
  if (!providerId || typeof providerId !== "string" || !Object.hasOwn(PROVIDERS, providerId)) return [];
  const provider = PROVIDERS[providerId]!;
  // ...
```
E em `listProviderModels`:
```typescript
export async function listProviderModels(providerId: string): Promise<string[]> {
  if (!providerId || typeof providerId !== "string") return [];
  const cached = _modelCache.get(providerId);
  if (cached && Date.now() - cached.at < MODELS_TTL_MS) return cached.models;

  let models: string[];
  if (providerId === "opencode") {
    models = await listOpenCodeModels();
  } else {
    const probed = await probeAcpAgentModels(providerId, ACP_PROBE_TIMEOUT_MS);
    models = probed.length > 0 ? probed : (Object.hasOwn(PROVIDERS, providerId) ? PROVIDERS[providerId]?.models ?? [] : []);
  }
  _modelCache.set(providerId, { at: Date.now(), models });
  return models;
}
```

3. **Adicionar limpeza de timer em `runWithTimeout`**:
```typescript
async function runWithTimeout(cmd: string[], timeoutMs: number): Promise<string | null> {
  try {
    const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore" });
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const collect = (async () => {
      const [out, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        proc.exited,
      ]);
      return exitCode === 0 ? out : null;
    })();
    const timeout = new Promise<null>((resolve) => {
      timerId = setTimeout(() => {
        try {
          proc.kill();
        } catch {}
        resolve(null);
      }, timeoutMs);
    });
    try {
      return await Promise.race([collect, timeout]);
    } finally {
      if (timerId !== undefined) clearTimeout(timerId);
    }
  } catch {
    return null;
  }
}
```

---

## 5. Verification Method (Método de Verificação Independente)

Para reproduzir e verificar as falhas identificadas:

1. **Executar a suíte de testes unitários expandida com Bun Test**:
   ```bash
   cd D:\mercury\app
   bun test src/acp/providers.test.ts
   ```
2. **Critério de Invalidação do Relatório**:
   - `getProvider("toString").command("/workspace")` executa sem lançar `TypeError` e retorna comando de fallback para `opencode`.
   - `getProvider("constructor")`, `getProvider("valueOf")` e `getProvider("__proto__")` retornam `PROVIDERS.opencode`.
   - Todos os 100% dos testes em `src/acp/providers.test.ts` (incluindo o bloco `Adversarial Edge Cases & Boundary Stress Testing`) passam com sucesso.
