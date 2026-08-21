# Suporte a Todos os Agentes do ACP Registry com Bun Nativo e Descoberta Universal de Modelos

Expandir o registro de provedores ACP (`PROVIDERS` em `d:\mercury\app\src\acp\providers.ts`) para incluir todos os 38 agentes listados no [ACP Registry oficial](https://agentclientprotocol.com/get-started/registry), utilizando **Bun Shell** (`import { $ } from "bun"`) e **descoberta universal de modelos via protocolo ACP e CLI**.

## Diretrizes de Implementação com Bun

Conforme orientado, utilizaremos as APIs nativas do Bun:
- **[Bun Shell (`import { $ } from "bun"`)](https://bun.com/docs/runtime/shell)**: para execução segura de comandos, timeout (`$.timeout()`), captura de stdout e execução cross-platform (Windows PowerShell / POSIX).
- **[bunx (`bunx <package>`)](https://bun.com/docs/pm/bunx)**: para execução sob demanda e sem instalação prévia dos agentes distribuídos via npm no ACP Registry.
- **[Bun Child Process & Streams](https://bun.com/docs/runtime/child-process)**: controle de processos ACP stdio e encerramento limpo sem erros de sinais no Windows.

---

## Descoberta Universal de Modelos (ACP Handshake & CLI)

O protocolo **Agent Client Protocol (ACP)** padroniza a enumeração de modelos: na resposta do método `session/new`, o agente envia `models.availableModels: [...]`.

Implementaremos um sistema de descoberta de modelos em camadas para **todos os agentes**:
1. **Descoberta Nativa via CLI**: Agentes com comandos rápidos de listagem (como `opencode models`) utilizam `$` do Bun Shell com timeout seguro.
2. **Descoberta Universal via ACP Handshake (`probeAcpAgentModels`)**:
   - Para qualquer provedor configurado, executa um handshake ACP rápido (`initialize` → `session/new`) usando stdin/stdout stream do Bun.
   - Extrai a lista `models.availableModels` retornada pelo agente.
   - Encerra o processo de probe de forma limpa.
3. **Cache com TTL e Fallback Estático**:
   - Cache de 5 minutos em memória por provedor (`_modelCache`).
   - Aquecimento assíncrono em background sem travar o boot ou requisições.
   - Fallback para modelos conhecidos/padrão caso o agente ainda não esteja instalado ou configurado com credenciais.

---

## Provedores Suportados (Total: 38 Provedores do ACP Registry)

1. **OpenCode** (`opencode`): `opencode acp --cwd <cwd>` (descoberta via CLI `opencode models` + fallback)
2. **Claude Code** (`claude-code`): `bunx --bun @zed-industries/claude-code-acp` (descoberta via ACP probe)
3. **Claude Agent** (`claude-acp`): `bunx @agentclientprotocol/claude-agent-acp@latest` (descoberta via ACP probe)
4. **Codex (OpenAI)** (`codex-acp`): `bunx @agentclientprotocol/codex-acp@latest` (descoberta via ACP probe)
5. **Gemini CLI** (`gemini`): `bunx @google/gemini-cli@latest --acp`
6. **GitHub Copilot** (`github-copilot-cli`): `bunx @github/copilot@latest --acp`
7. **Cursor** (`cursor`): `cursor-agent acp`
8. **Cline** (`cline`): `bunx cline@latest --acp`
9. **Grok Build (xAI)** (`grok-build`): `bunx @xai-official/grok@latest agent stdio`
10. **Mistral Vibe** (`mistral-vibe`): `vibe-acp`
11. **Qwen Code** (`qwen-code`): `bunx @qwen-code/qwen-code@latest --acp --experimental-skills`
12. **GLM Agent (Zhipu AI)** (`glm-acp-agent`): `bunx glm-acp-agent@latest`
13. **goose** (`goose`): `goose acp`
14. **Kimi CLI** (`kimi`): `kimi acp`
15. **Devin** (`devin`): `devin acp`
16. **Agoragentic** (`agoragentic-acp`): `bunx agoragentic-mcp@latest --acp`
17. **Amp** (`amp-acp`): `amp-acp`
18. **Auggie CLI** (`auggie`): `bunx @augmentcode/auggie@latest --acp`
19. **Autohand Code** (`autohand`): `bunx @autohandai/autohand-acp@latest`
20. **Codebuddy Code** (`codebuddy-code`): `bunx @tencent-ai/codebuddy-code@latest --acp`
21. **Cortex Code** (`cortex-code`): `cortex acp serve`
22. **Corust Agent** (`corust-agent`): `corust-agent-acp`
23. **crow-cli** (`crow-cli`): `crow-cli acp`
24. **DeepAgents** (`deepagents`): `bunx deepagents-acp@latest`
25. **DimCode** (`dimcode`): `bunx dimcode@latest acp`
26. **Dirac** (`dirac`): `bunx dirac-cli@latest --acp`
27. **Factory Droid** (`factory-droid`): `bunx droid@latest exec --output-format acp-daemon`
28. **fast-agent** (`fast-agent`): `fast-agent-acp -x`
29. **Harn** (`harn`): `harn serve acp`
30. **Junie (JetBrains)** (`junie`): `junie --acp=true`
31. **Kilo Code** (`kilo`): `bunx @kilocode/cli@latest acp`
32. **Minion Code** (`minion-code`): `minion-code acp`
33. **Nova (Compass AI)** (`nova`): `bunx @compass-ai/nova@latest acp`
34. **pi ACP** (`pi-acp`): `bunx pi-acp@latest`
35. **Poolside** (`poolside`): `pool acp`
36. **Qoder CLI** (`qoder`): `bunx @qoder-ai/qodercli@latest --acp`
37. **siGit Code** (`sigit`): `bunx @smbcloud/sigit@latest`
38. **Stakpak** (`stakpak`): `stakpak acp`
39. **VT Code** (`vtcode`): `vtcode acp`

---

## Arquivos Modificados

### [MODIFY] [providers.ts](file:///d:/mercury/app/src/acp/providers.ts)
- Implementar todos os 38 provedores com comandos `bunx` / binários correspondentes e variáveis de ambiente.
- Implementar `probeAcpAgentModels(providerId, timeoutMs)` genérico para descobrir modelos de qualquer agente ACP via handshake stdio.
- Implementar chamada CLI com Bun Shell (`$`) para `opencode models`.
- Utilizar encerramento seguro de processo sem `SIGKILL` direto no Windows.

### [MODIFY] [paths.ts](file:///d:/mercury/app/src/paths.ts)
- Definir `MercuryConfig.provider?: string` para suportar qualquer ID de provedor registrado.

### [MODIFY] [index.ts (server)](file:///d:/mercury/app/src/server/index.ts)
- Honrar `--provider <id>` da CLI e carregar os provedores de forma assíncrona/segura.

### [NEW] [providers.test.ts](file:///d:/mercury/app/src/acp/providers.test.ts)
- Testes unitários para validação de integridade dos 38 provedores, funções de comando e enumeração de modelos.

---

## Verificação
- `bun run typecheck`
- `bun test src/acp/providers.test.ts`
- `bun test` (todos os testes)
- Validação do endpoint `/api/acp/providers` e visualização na interface do Mercury.
