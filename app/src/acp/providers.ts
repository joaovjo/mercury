/**
 * ACP provider registry. Each provider knows how to spawn an agent that
 * speaks the Agent Client Protocol over stdio.
 */

import type { Subprocess } from "bun";

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
    // Fallback only. At runtime models are discovered live from the adapter
    // (see probeClaudeCodeModels). These stable aliases are used when that probe
    // fails (adapter missing, not logged in, timeout); they're what
    // ANTHROPIC_MODEL accepts and always resolve to the current generation.
    models: ["opus", "sonnet", "haiku"],
    defaultModel: undefined,
    // Zed's ACP adapter wraps the Claude Code CLI.
    // Model is passed via ANTHROPIC_MODEL env rather than a CLI flag.
    command: (cwd, model) => {
      // The adapter refuses to start when it sees CLAUDECODE set (its
      // nested-session guard). When the dashboard itself is launched from
      // inside a Claude Code session that var is inherited, which would
      // otherwise make every claude-code run fail at session/new. Neutralize
      // the guard for the spawned child; this is the adapter's documented
      // escape hatch ("unset the CLAUDECODE environment variable").
      const env: Record<string, string> = { CLAUDECODE: "" };
      if (model) env.ANTHROPIC_MODEL = model;
      return { cmd: ["npx", "-y", "@zed-industries/claude-code-acp"], env };
    },
  },
};

export function getProvider(id: string | undefined): AcpProvider {
  return PROVIDERS[id ?? "opencode"] ?? PROVIDERS.opencode!;
}

/** Spawn a command, capture stdout, and abandon it if it exceeds `timeoutMs`.
 *  Async (never blocks the event loop) and bounded by a hard Promise.race so a
 *  CLI that ignores SIGKILL still can't stall the caller past the timeout. */
async function runWithTimeout(cmd: string[], timeoutMs: number): Promise<string | null> {
  try {
    const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore" });
    const collect = (async () => {
      const [out, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        proc.exited,
      ]);
      return exitCode === 0 ? out : null;
    })();
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch {}
        resolve(null);
      }, timeoutMs),
    );
    return await Promise.race([collect, timeout]);
  } catch {
    return null;
  }
}

/** Model-list cache. Enumerating models is slow (`opencode models`, or spawning
 *  the Claude Code ACP adapter for a session probe), so cache the result per
 *  provider for the lifetime of the dashboard process with a short TTL. */
const MODELS_TTL_MS = 5 * 60 * 1000;
const MODELS_SPAWN_TIMEOUT_MS = 4000;
// The Claude probe spawns the ACP adapter and runs initialize + session/new,
// which is heavier than a plain CLI call (npx resolve + adapter boot + session
// create). Result is cached and warmed on boot, so a generous bound is fine.
const CLAUDE_PROBE_TIMEOUT_MS = 15000;
const _modelCache = new Map<string, { at: number; models: string[] }>();

/**
 * Enumerate available models for a provider by invoking its native CLI.
 * Cached (5 min TTL) and bounded by an 8s spawn timeout so the dashboard
 * never blocks on a slow or hanging CLI.
 *
 * - OpenCode: runs `opencode models` and parses line-oriented output.
 * - Claude Code: probes the ACP adapter for its advertised availableModels.
 * - Unknown providers return the static list from the provider definition.
 * Returns an empty array on any error (command missing, timeout, non-zero exit).
 */
export async function listProviderModels(providerId: string): Promise<string[]> {
  const cached = _modelCache.get(providerId);
  if (cached && Date.now() - cached.at < MODELS_TTL_MS) return cached.models;

  let models: string[];
  switch (providerId) {
    case "opencode":
      models = await listOpenCodeModels();
      break;
    case "claude-code":
      models = await listClaudeCodeModels();
      break;
    default:
      models = PROVIDERS[providerId]?.models ?? [];
  }
  _modelCache.set(providerId, { at: Date.now(), models });
  return models;
}

async function listOpenCodeModels(): Promise<string[]> {
  const out = (await runWithTimeout(["opencode", "models"], MODELS_SPAWN_TIMEOUT_MS))?.trim();
  if (!out) return [];
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));
}

async function listClaudeCodeModels(): Promise<string[]> {
  // The Claude Code CLI has no model-enumeration command, but the ACP adapter
  // advertises its own `availableModels` on session/new. Probe that live so new
  // models are discovered automatically; fall back to the provider's stable
  // aliases only if the probe fails (adapter missing, not logged in, timeout).
  const probed = await probeClaudeCodeModels(CLAUDE_PROBE_TIMEOUT_MS);
  return probed.length ? probed : PROVIDERS["claude-code"]?.models ?? [];
}

/**
 * Enumerate Claude Code models by running a minimal ACP handshake against the
 * adapter (initialize → session/new) and reading the `availableModels` it
 * advertises. Auto-discovers the installed CLI's real lineup instead of relying
 * on a hardcoded list. Bounded by `timeoutMs`; returns [] on any failure.
 */
async function probeClaudeCodeModels(timeoutMs: number): Promise<string[]> {
  const cwd = process.cwd();
  const { cmd, env } = PROVIDERS["claude-code"]!.command(cwd);
  let proc: Subprocess<"pipe", "pipe", "ignore"> | null = null;
  try {
    proc = Bun.spawn(cmd, {
      cwd,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "ignore",
      env: env ? { ...process.env, ...env } : undefined,
    });
    const p = proc;
    const handshake = (async (): Promise<string[]> => {
      const reader = p.stdout.getReader();
      const decoder = new TextDecoder();
      const pending = new Map<number, (v: any) => void>();
      let buf = "";
      let nextId = 1;
      const send = (m: unknown) => {
        p.stdin.write(JSON.stringify(m) + "\n");
        p.stdin.flush?.();
      };
      const request = (method: string, params: unknown) =>
        new Promise<any>((resolve) => {
          const id = nextId++;
          pending.set(id, resolve);
          send({ jsonrpc: "2.0", id, method, params });
        });
      // Pump stdout: resolve our requests and null-answer any agent callback so
      // the adapter never blocks waiting on us during the probe.
      void (async () => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            let msg: any;
            try {
              msg = JSON.parse(line);
            } catch {
              continue;
            }
            if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
              pending.get(msg.id)?.(msg.error ? null : msg.result);
              pending.delete(msg.id);
            } else if (msg.method && msg.id !== undefined) {
              send({ jsonrpc: "2.0", id: msg.id, result: null });
            }
          }
        }
      })();
      await request("initialize", {
        protocolVersion: 1,
        clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
      });
      const session = await request("session/new", { cwd, mcpServers: [] });
      const available = session?.models?.availableModels;
      if (!Array.isArray(available)) return [];
      // Drop "default" — the UI already offers a Default entry, and an empty
      // model selection is what triggers the provider's own default.
      return available
        .map((m: any) => (typeof m?.modelId === "string" ? m.modelId : null))
        .filter((id: unknown): id is string => typeof id === "string" && id.length > 0 && id !== "default");
    })();
    const timeout = new Promise<string[]>((resolve) => setTimeout(() => resolve([]), timeoutMs));
    return await Promise.race([handshake, timeout]);
  } catch {
    return [];
  } finally {
    try {
      proc?.kill("SIGKILL");
    } catch {}
  }
}
