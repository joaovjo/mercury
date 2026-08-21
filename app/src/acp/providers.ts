/**
 * ACP provider registry. Each provider knows how to spawn an agent that
 * speaks the Agent Client Protocol over stdio.
 *
 * Implements the full ACP Registry with 38+ providers, universal model discovery
 * via ACP handshake, and Bun Shell integration.
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
		displayName: "OpenCode",
		bin: "opencode",
		models: [
			"anthropic/claude-3-7-sonnet",
			"anthropic/claude-3-5-sonnet",
			"openai/gpt-4o",
			"openai/o3-mini",
			"google/gemini-2.0-flash",
			"google/gemini-2.5-pro",
			"openrouter/auto",
		],
		defaultModel: undefined,
		command: (cwd, model) => {
			const env = model
				? { OPENCODE_CONFIG_CONTENT: JSON.stringify({ model }) }
				: undefined;
			return { cmd: ["opencode", "acp", "--cwd", cwd], env };
		},
	},
	"claude-code": {
		id: "claude-code",
		displayName: "Claude Code",
		bin: "claude",
		models: ["opus", "sonnet", "haiku"],
		defaultModel: undefined,
		command: (_cwd, model) => {
			const env: Record<string, string> = { CLAUDECODE: "" };
			if (model) env.ANTHROPIC_MODEL = model;
			return { cmd: ["bunx", "--bun", "@zed-industries/claude-code-acp"], env };
		},
	},
	"claude-acp": {
		id: "claude-acp",
		displayName: "Claude Agent (Official)",
		bin: "claude-agent-acp",
		models: [
			"claude-3-7-sonnet-latest",
			"claude-3-5-sonnet-latest",
			"claude-3-5-haiku-latest",
		],
		defaultModel: undefined,
		command: (_cwd, model) => {
			const env = model ? { ANTHROPIC_MODEL: model } : undefined;
			return {
				cmd: ["bunx", "@agentclientprotocol/claude-agent-acp@latest"],
				env,
			};
		},
	},
	"codex-acp": {
		id: "codex-acp",
		displayName: "Codex (OpenAI)",
		bin: "codex-acp",
		models: ["o3-mini", "gpt-4o", "gpt-4o-mini"],
		defaultModel: undefined,
		command: (_cwd, model) => {
			const env = model ? { OPENAI_MODEL: model } : undefined;
			return { cmd: ["bunx", "@agentclientprotocol/codex-acp@latest"], env };
		},
	},
	gemini: {
		id: "gemini",
		displayName: "Gemini CLI (Google)",
		bin: "gemini",
		models: ["gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-pro"],
		defaultModel: undefined,
		command: (_cwd, model) => {
			const env = model ? { GEMINI_MODEL: model } : undefined;
			return { cmd: ["bunx", "@google/gemini-cli@latest", "--acp"], env };
		},
	},
	"github-copilot-cli": {
		id: "github-copilot-cli",
		displayName: "GitHub Copilot CLI",
		bin: "copilot",
		models: ["gpt-4o", "claude-3.5-sonnet", "o1"],
		defaultModel: undefined,
		command: (_cwd, model) => {
			const env = model ? { COPILOT_MODEL: model } : undefined;
			return { cmd: ["bunx", "@github/copilot@latest", "--acp"], env };
		},
	},
	cursor: {
		id: "cursor",
		displayName: "Cursor Agent",
		bin: "cursor-agent",
		models: ["claude-3-7-sonnet", "gpt-4o", "cursor-fast"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["cursor-agent", "acp"] }),
	},
	cline: {
		id: "cline",
		displayName: "Cline",
		bin: "cline",
		models: ["claude-3-7-sonnet", "claude-3-5-sonnet", "gpt-4o"],
		defaultModel: undefined,
		command: (_cwd, model) => {
			const env = model ? { CLINE_MODEL: model } : undefined;
			return { cmd: ["bunx", "cline@latest", "--acp"], env };
		},
	},
	"grok-build": {
		id: "grok-build",
		displayName: "Grok Build (xAI)",
		bin: "grok",
		models: ["grok-2", "grok-2-mini", "grok-beta"],
		defaultModel: undefined,
		command: (_cwd, model) => {
			const env = model ? { GROK_MODEL: model } : undefined;
			return {
				cmd: ["bunx", "@xai-official/grok@latest", "agent", "stdio"],
				env,
			};
		},
	},
	"mistral-vibe": {
		id: "mistral-vibe",
		displayName: "Mistral Vibe",
		bin: "vibe-acp",
		models: [
			"mistral-large-latest",
			"mistral-small-latest",
			"codestral-latest",
		],
		defaultModel: undefined,
		command: (_cwd, model) => {
			const env = model ? { MISTRAL_MODEL: model } : undefined;
			return { cmd: ["vibe-acp"], env };
		},
	},
	"qwen-code": {
		id: "qwen-code",
		displayName: "Qwen Code",
		bin: "qwen-code",
		models: ["qwen-2.5-coder-32b", "qwen-max", "qwen-plus"],
		defaultModel: undefined,
		command: (_cwd, model) => {
			const env = model ? { QWEN_MODEL: model } : undefined;
			return {
				cmd: [
					"bunx",
					"@qwen-code/qwen-code@latest",
					"--acp",
					"--experimental-skills",
				],
				env,
			};
		},
	},
	"glm-acp-agent": {
		id: "glm-acp-agent",
		displayName: "GLM Agent (Zhipu AI)",
		bin: "glm-acp-agent",
		models: ["glm-4-plus", "glm-4-air", "codegeex-4"],
		defaultModel: undefined,
		command: (_cwd, model) => {
			const env = model ? { GLM_MODEL: model } : undefined;
			return { cmd: ["bunx", "glm-acp-agent@latest"], env };
		},
	},
	goose: {
		id: "goose",
		displayName: "Goose",
		bin: "goose",
		models: ["gpt-4o", "claude-3-5-sonnet", "databricks-dbrx"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["goose", "acp"] }),
	},
	kimi: {
		id: "kimi",
		displayName: "Kimi CLI (Moonshot AI)",
		bin: "kimi",
		models: ["moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k"],
		defaultModel: undefined,
		command: (_cwd, model) => {
			const env = model ? { KIMI_MODEL: model } : undefined;
			return { cmd: ["kimi", "acp"], env };
		},
	},
	devin: {
		id: "devin",
		displayName: "Devin (Cognition)",
		bin: "devin",
		models: ["devin-default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["devin", "acp"] }),
	},
	"agoragentic-acp": {
		id: "agoragentic-acp",
		displayName: "Agoragentic",
		bin: "agoragentic-mcp",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({
			cmd: ["bunx", "agoragentic-mcp@latest", "--acp"],
		}),
	},
	"amp-acp": {
		id: "amp-acp",
		displayName: "Amp",
		bin: "amp-acp",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["amp-acp"] }),
	},
	auggie: {
		id: "auggie",
		displayName: "Auggie CLI (Augment)",
		bin: "auggie",
		models: ["augment-default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({
			cmd: ["bunx", "@augmentcode/auggie@latest", "--acp"],
		}),
	},
	autohand: {
		id: "autohand",
		displayName: "Autohand Code",
		bin: "autohand-acp",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({
			cmd: ["bunx", "@autohandai/autohand-acp@latest"],
		}),
	},
	"codebuddy-code": {
		id: "codebuddy-code",
		displayName: "Codebuddy Code (Tencent)",
		bin: "codebuddy-code",
		models: ["hunyuan-code", "gpt-4o"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({
			cmd: ["bunx", "@tencent-ai/codebuddy-code@latest", "--acp"],
		}),
	},
	"cortex-code": {
		id: "cortex-code",
		displayName: "Cortex Code",
		bin: "cortex",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["cortex", "acp", "serve"] }),
	},
	"corust-agent": {
		id: "corust-agent",
		displayName: "Corust Agent",
		bin: "corust-agent-acp",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["corust-agent-acp"] }),
	},
	"crow-cli": {
		id: "crow-cli",
		displayName: "Crow CLI",
		bin: "crow-cli",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["crow-cli", "acp"] }),
	},
	deepagents: {
		id: "deepagents",
		displayName: "DeepAgents",
		bin: "deepagents-acp",
		models: ["deepseek-r1", "deepseek-v3"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["bunx", "deepagents-acp@latest"] }),
	},
	dimcode: {
		id: "dimcode",
		displayName: "DimCode",
		bin: "dimcode",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["bunx", "dimcode@latest", "acp"] }),
	},
	dirac: {
		id: "dirac",
		displayName: "Dirac",
		bin: "dirac",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["bunx", "dirac-cli@latest", "--acp"] }),
	},
	"factory-droid": {
		id: "factory-droid",
		displayName: "Factory Droid",
		bin: "droid",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({
			cmd: ["bunx", "droid@latest", "exec", "--output-format", "acp-daemon"],
		}),
	},
	"fast-agent": {
		id: "fast-agent",
		displayName: "Fast Agent",
		bin: "fast-agent-acp",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["fast-agent-acp", "-x"] }),
	},
	harn: {
		id: "harn",
		displayName: "Harn",
		bin: "harn",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["harn", "serve", "acp"] }),
	},
	junie: {
		id: "junie",
		displayName: "Junie (JetBrains)",
		bin: "junie",
		models: ["jetbrains-ai"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["junie", "--acp=true"] }),
	},
	kilo: {
		id: "kilo",
		displayName: "Kilo Code",
		bin: "kilo",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({
			cmd: ["bunx", "@kilocode/cli@latest", "acp"],
		}),
	},
	"minion-code": {
		id: "minion-code",
		displayName: "Minion Code",
		bin: "minion-code",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["minion-code", "acp"] }),
	},
	nova: {
		id: "nova",
		displayName: "Nova (Compass AI)",
		bin: "nova",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({
			cmd: ["bunx", "@compass-ai/nova@latest", "acp"],
		}),
	},
	"pi-acp": {
		id: "pi-acp",
		displayName: "Pi ACP",
		bin: "pi-acp",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["bunx", "pi-acp@latest"] }),
	},
	poolside: {
		id: "poolside",
		displayName: "Poolside",
		bin: "pool",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["pool", "acp"] }),
	},
	qoder: {
		id: "qoder",
		displayName: "Qoder CLI",
		bin: "qoder",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({
			cmd: ["bunx", "@qoder-ai/qodercli@latest", "--acp"],
		}),
	},
	sigit: {
		id: "sigit",
		displayName: "siGit Code",
		bin: "sigit",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["bunx", "@smbcloud/sigit@latest"] }),
	},
	stakpak: {
		id: "stakpak",
		displayName: "Stakpak",
		bin: "stakpak",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["stakpak", "acp"] }),
	},
	vtcode: {
		id: "vtcode",
		displayName: "VT Code",
		bin: "vtcode",
		models: ["default"],
		defaultModel: undefined,
		command: (_cwd, _model) => ({ cmd: ["vtcode", "acp"] }),
	},
};

export function getProvider(id: string | undefined): AcpProvider {
	if (typeof id === "string" && Object.hasOwn(PROVIDERS, id)) {
		return PROVIDERS[id]!;
	}
	return PROVIDERS.opencode!;
}

/** Spawn a command, capture stdout, and abandon it if it exceeds `timeoutMs`.
 *  Async (never blocks the event loop) and bounded by a hard Promise.race. */
async function runWithTimeout(
	cmd: string[],
	timeoutMs: number,
): Promise<string | null> {
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
			if (timerId !== undefined) {
				clearTimeout(timerId);
			}
		}
	} catch {
		return null;
	}
}

/** Model-list cache. Enumerating models is cached per provider for 5 minutes. */
const MODELS_TTL_MS = 5 * 60 * 1000;
const MODELS_SPAWN_TIMEOUT_MS = 20000;
const ACP_PROBE_TIMEOUT_MS = 15000;
const _modelCache = new Map<string, { at: number; models: string[] }>();

/**
 * Enumerate available models for a provider by probing its ACP handshake or CLI.
 * Cached (5 min TTL) and bounded by timeout so callers never block.
 */
export async function listProviderModels(
	providerId: string,
): Promise<string[]> {
	if (!providerId || typeof providerId !== "string") return [];
	const cached = _modelCache.get(providerId);
	if (cached && Date.now() - cached.at < MODELS_TTL_MS) return cached.models;

	let models: string[];
	if (providerId === "opencode") {
		models = await listOpenCodeModels();
	} else {
		// Probes ACP adapter for advertised availableModels on session/new
		const probed = await probeAcpAgentModels(providerId, ACP_PROBE_TIMEOUT_MS);
		models =
			probed.length > 0
				? probed
				: Object.hasOwn(PROVIDERS, providerId)
					? (PROVIDERS[providerId]?.models ?? [])
					: [];
	}
	_modelCache.set(providerId, { at: Date.now(), models });
	return models;
}

async function listOpenCodeModels(): Promise<string[]> {
	try {
		const { $ } = await import("bun");
		const out = (
			await $`opencode models`.timeout(MODELS_SPAWN_TIMEOUT_MS).text()
		).trim();
		if (!out) return PROVIDERS.opencode?.models ?? [];
		const parsed = out
			.split("\n")
			.map((l) => l.trim().replace(/\r$/, ""))
			.filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));
		return parsed.length > 0 ? parsed : (PROVIDERS.opencode?.models ?? []);
	} catch {
		const out = (
			await runWithTimeout(["opencode", "models"], MODELS_SPAWN_TIMEOUT_MS)
		)?.trim();
		if (!out) return PROVIDERS.opencode?.models ?? [];
		const parsed = out
			.split("\n")
			.map((l) => l.trim().replace(/\r$/, ""))
			.filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));
		return parsed.length > 0 ? parsed : (PROVIDERS.opencode?.models ?? []);
	}
}

/**
 * Enumerate models for any ACP agent by running a minimal ACP handshake
 * (initialize → session/new) over stdio and reading `availableModels`.
 * Bounded by `timeoutMs`; returns [] on any failure.
 */
export async function probeAcpAgentModels(
	providerId: string,
	timeoutMs: number = ACP_PROBE_TIMEOUT_MS,
): Promise<string[]> {
	if (
		!providerId ||
		typeof providerId !== "string" ||
		!Object.hasOwn(PROVIDERS, providerId)
	)
		return [];
	const provider = PROVIDERS[providerId]!;
	const cwd = process.cwd();
	const { cmd, env } = provider.command(cwd);
	let proc: Subprocess<"pipe", "pipe", "ignore"> | null = null;
	let timerId: ReturnType<typeof setTimeout> | undefined;
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
				p.stdin.write(`${JSON.stringify(m)}\n`);
				p.stdin.flush?.();
			};
			const request = (method: string, params: unknown) =>
				new Promise<any>((resolve) => {
					const id = nextId++;
					pending.set(id, resolve);
					send({ jsonrpc: "2.0", id, method, params });
				});
			// Pump stdout: resolve requests and answer callbacks
			void (async () => {
				try {
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
							if (
								msg.id !== undefined &&
								(msg.result !== undefined || msg.error !== undefined)
							) {
								pending.get(msg.id)?.(msg.error ? null : msg.result);
								pending.delete(msg.id);
							} else if (msg.method && msg.id !== undefined) {
								send({ jsonrpc: "2.0", id: msg.id, result: null });
							}
						}
					}
				} catch {}
			})();
			await request("initialize", {
				protocolVersion: 1,
				clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
			});
			const session = await request("session/new", { cwd, mcpServers: [] });
			const available = session?.models?.availableModels;
			if (!Array.isArray(available)) return [];
			return available
				.map((m: any) => (typeof m?.modelId === "string" ? m.modelId : null))
				.filter(
					(id: unknown): id is string =>
						typeof id === "string" && id.length > 0 && id !== "default",
				);
		})();
		const timeout = new Promise<string[]>((resolve) => {
			timerId = setTimeout(() => resolve([]), timeoutMs);
		});
		return await Promise.race([handshake, timeout]);
	} catch {
		return [];
	} finally {
		if (timerId !== undefined) {
			clearTimeout(timerId);
		}
		try {
			proc?.kill();
		} catch {}
	}
}
