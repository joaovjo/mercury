/**
 * ACP provider registry. Each provider knows how to spawn an agent that
 * speaks the Agent Client Protocol over stdio.
 */

export interface AcpProviderCommand {
  cmd: string[];
  env?: Record<string, string>;
}

export interface AcpProvider {
  id: string;
  displayName: string;
  /** Available model IDs for this provider. */
  models: string[];
  /** Default model for this provider (undefined means "use provider default"). */
  defaultModel?: string;
  /** Command + args (+ optional env) to spawn the agent in ACP mode. */
  command: (cwd: string, model?: string) => AcpProviderCommand;
  /** Whether the binary is expected on PATH (used for availability hints). */
  bin: string;
}

export const PROVIDERS: Record<string, AcpProvider> = {
  opencode: {
    id: "opencode",
    displayName: "opencode",
    bin: "opencode",
    models: [],
    defaultModel: undefined,
    command: (cwd, model) => {
      const env = model ? { OPENCODE_CONFIG_CONTENT: JSON.stringify({ model }) } : undefined;
      return { cmd: ["opencode", "acp", "--cwd", cwd], env };
    },
  },
  "claude-code": {
    id: "claude-code",
    displayName: "Claude Code",
    bin: "claude",
    models: [],
    defaultModel: undefined,
    // Zed's ACP adapter wraps the Claude Code CLI.
    // Model is passed via ANTHROPIC_MODEL env rather than a CLI flag.
    command: (cwd, model) => {
      const env = model ? { ANTHROPIC_MODEL: model } : undefined;
      return { cmd: ["npx", "-y", "@zed-industries/claude-code-acp"], env };
    },
  },
};

export function getProvider(id: string | undefined): AcpProvider {
  return PROVIDERS[id ?? "opencode"] ?? PROVIDERS.opencode!;
}

/**
 * Enumerate available models for a provider by invoking its native CLI.
 *
 * - OpenCode: runs `opencode models` and parses line-oriented output.
 *   Returns an empty array on any error (command missing, non-zero exit,
 *   unparseable output).
 * - Claude Code: runs `claude config list` and extracts availableModels.
 * - Unknown providers return an empty array.
 */
export async function listProviderModels(providerId: string): Promise<string[]> {
  switch (providerId) {
    case "opencode":
      return listOpenCodeModels();
    case "claude-code":
      return listClaudeCodeModels();
    default:
      // Fall back to the static list baked into the provider definition.
      return PROVIDERS[providerId]?.models ?? [];
  }
}

async function listOpenCodeModels(): Promise<string[]> {
  try {
    const proc = Bun.spawnSync(["opencode", "models"]);
    if (!proc.success || proc.exitCode !== 0) return [];
    const out = proc.stdout.toString().trim();
    if (!out) return [];
    const models = out
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));
    return models;
  } catch {
    return [];
  }
}

async function listClaudeCodeModels(): Promise<string[]> {
  try {
    const proc = Bun.spawnSync(["claude", "config", "list"]);
    if (!proc.success || proc.exitCode !== 0) return [];
    return parseClaudeConfigModels(proc.stdout.toString());
  } catch {
    return [];
  }
}

function parseClaudeConfigModels(out: string): string[] {
  const trimmed = out.trim();
  if (!trimmed) return [];

  const fromJson = parseClaudeConfigJson(trimmed);
  if (fromJson.length) return fromJson;

  const models = new Set<string>();
  const lines = trimmed.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const match = line.match(/^availableModels\s*[:=]\s*(.+)$/i);
    if (!match) continue;
    collectModelTokens(match[1]!, models);
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j]!.trim();
      if (!next || /^[A-Za-z][A-Za-z0-9_-]*\s*[:=]/.test(next)) break;
      collectModelTokens(next, models);
    }
  }
  return [...models];
}

function parseClaudeConfigJson(out: string): string[] {
  try {
    const config = JSON.parse(out) as { availableModels?: unknown };
    return Array.isArray(config.availableModels)
      ? config.availableModels.filter((m): m is string => typeof m === "string" && m.length > 0)
      : [];
  } catch {
    return [];
  }
}

function collectModelTokens(text: string, models: Set<string>): void {
  const cleaned = text.replace(/[\[\]",]/g, " ");
  for (const token of cleaned.split(/\s+/)) {
    const model = token.trim();
    if (model && model !== "[]") models.add(model);
  }
}
