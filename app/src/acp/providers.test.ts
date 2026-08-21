import { describe, expect, test } from "bun:test";
import {
	getProvider,
	listProviderModels,
	PROVIDERS,
	probeAcpAgentModels,
} from "./providers.ts";

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
			const cmdResult = p.command("/synthetic/workspace");
			expect(Array.isArray(cmdResult.cmd)).toBe(true);
			expect(cmdResult.cmd.length).toBeGreaterThan(0);
			expect(
				cmdResult.cmd.every((arg) => typeof arg === "string" && arg.length > 0),
			).toBe(true);

			// Verify command with synthetic model
			const cmdWithModel = p.command(
				"/synthetic/workspace",
				"synthetic-test-model",
			);
			expect(Array.isArray(cmdWithModel.cmd)).toBe(true);
			expect(cmdWithModel.cmd.length).toBeGreaterThan(0);
		}
	});

	test("opencode command includes --cwd and workspace parameter", () => {
		const res = PROVIDERS.opencode.command("/custom/synthetic/work/dir");
		expect(res.cmd).toContain("--cwd");
		expect(res.cmd).toContain("/custom/synthetic/work/dir");
	});
});

describe("ACP Providers Registry — Model Environment Injections", () => {
	const modelCases: Array<{ id: string; envKey: string }> = [
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
			const res = p.command("/synthetic/workspace", "synthetic-model-id");
			expect(res.env).toBeDefined();
			expect(res.env?.[c.envKey]).toBe("synthetic-model-id");
		});
	}

	test("opencode: injects OPENCODE_CONFIG_CONTENT JSON when model is specified", () => {
		const res = PROVIDERS.opencode.command(
			"/synthetic/workspace",
			"synthetic/claude-model",
		);
		expect(res.env).toBeDefined();
		expect(res.env?.OPENCODE_CONFIG_CONTENT).toBe(
			JSON.stringify({ model: "synthetic/claude-model" }),
		);
	});

	test("opencode: env is undefined when no model is specified", () => {
		const res = PROVIDERS.opencode.command("/synthetic/workspace");
		expect(res.env).toBeUndefined();
	});

	test("claude-code: always maintains CLAUDECODE in env", () => {
		const withoutModel = PROVIDERS["claude-code"].command(
			"/synthetic/workspace",
		);
		expect(withoutModel.env?.CLAUDECODE).toBe("");
		expect(withoutModel.env?.ANTHROPIC_MODEL).toBeUndefined();

		const withModel = PROVIDERS["claude-code"].command(
			"/synthetic/workspace",
			"synthetic-opus",
		);
		expect(withModel.env?.CLAUDECODE).toBe("");
		expect(withModel.env?.ANTHROPIC_MODEL).toBe("synthetic-opus");
	});

	test("static providers without model-specific env variables return undefined env", () => {
		const staticProviders = [
			"cursor",
			"goose",
			"devin",
			"cortex-code",
			"poolside",
			"vtcode",
		];
		for (const id of staticProviders) {
			const p = PROVIDERS[id];
			expect(p).toBeDefined();
			const res = p.command("/synthetic/workspace", "synthetic-custom-model");
			expect(res.env).toBeUndefined();
		}
	});
});

describe("getProvider — Lookups and Fallbacks", () => {
	test("returns correct provider for valid registered IDs", () => {
		expect(getProvider("opencode").id).toBe("opencode");
		expect(getProvider("claude-code").id).toBe("claude-code");
		expect(getProvider("claude-acp").id).toBe("claude-acp");
		expect(getProvider("gemini").id).toBe("gemini");
		expect(getProvider("cursor").id).toBe("cursor");
		expect(getProvider("qwen-code").id).toBe("qwen-code");
		expect(getProvider("devin").id).toBe("devin");
		expect(getProvider("deepagents").id).toBe("deepagents");
	});

	test("falls back to opencode when id is undefined", () => {
		const p = getProvider(undefined);
		expect(p.id).toBe("opencode");
	});

	test("falls back to opencode when id is unknown", () => {
		const p = getProvider("non-existent-provider-id-99");
		expect(p.id).toBe("opencode");
	});

	test("falls back to opencode when id is empty string", () => {
		const p = getProvider("");
		expect(p.id).toBe("opencode");
	});
});

describe("listProviderModels & Discovery Strategy", () => {
	test("returns non-empty model list for opencode", async () => {
		const models = await listProviderModels("opencode");
		expect(Array.isArray(models)).toBe(true);
		expect(models.length).toBeGreaterThan(0);
	});

	test("returns static fallback models when agent probe fails or binary is uninstalled", async () => {
		const models = await listProviderModels("gemini");
		expect(Array.isArray(models)).toBe(true);
		expect(models.length).toBeGreaterThan(0);
		// Must contain standard models configured in registry
		expect(models).toEqual(PROVIDERS.gemini.models);
	});

	test("returns empty array for unknown provider id", async () => {
		const models = await listProviderModels("unknown-fake-agent");
		expect(Array.isArray(models)).toBe(true);
		expect(models.length).toBe(0);
	});

	test("caches model list across repeated calls", async () => {
		const first = await listProviderModels("claude-code");
		const second = await listProviderModels("claude-code");
		expect(first).toEqual(second);
	});

	test("probeAcpAgentModels returns empty array on unknown provider without throwing", async () => {
		const probed = await probeAcpAgentModels("unknown-fake-agent", 100);
		expect(Array.isArray(probed)).toBe(true);
		expect(probed.length).toBe(0);
	});
});

describe("Adversarial Edge Cases & Boundary Stress Testing", () => {
	const PROTOTYPE_PROPERTIES = [
		"toString",
		"valueOf",
		"constructor",
		"hasOwnProperty",
		"isPrototypeOf",
		"propertyIsEnumerable",
		"toLocaleString",
		"__proto__",
	];

	for (const prop of PROTOTYPE_PROPERTIES) {
		test(`getProvider: safely handles prototype property "${prop}" without returning prototype methods`, () => {
			const p = getProvider(prop);
			expect(p).toBeDefined();
			expect(p).toBe(PROVIDERS.opencode);
			expect(p.id).toBe("opencode");
			expect(typeof p.command).toBe("function");
			const cmd = p.command("/synthetic/workspace");
			expect(Array.isArray(cmd.cmd)).toBe(true);
			expect(cmd.cmd).toContain("opencode");
		});

		test(`listProviderModels: safely handles prototype property "${prop}" returning empty array`, async () => {
			const models = await listProviderModels(prop);
			expect(Array.isArray(models)).toBe(true);
			expect(models.length).toBe(0);
		});
	}

	const SPECIAL_INPUTS = [
		"   ",
		"\t\n\r",
		"<script>alert(1)</script>",
		"../../etc/passwd",
		"; rm -rf /",
		"@#$%^&*()_+~`|}{[]:;?><,.",
		"null",
		"undefined",
	];

	for (const input of SPECIAL_INPUTS) {
		test(`getProvider: safely falls back to opencode for special input: ${JSON.stringify(input)}`, () => {
			const p = getProvider(input);
			expect(p).toBeDefined();
			expect(p.id).toBe("opencode");
			expect(typeof p.command).toBe("function");
			const cmd = p.command("/synthetic/workspace");
			expect(cmd.cmd).toContain("opencode");
		});
	}

	test("getProvider: safely handles null and non-string types", () => {
		const fromNull = getProvider(null as any);
		expect(fromNull.id).toBe("opencode");

		const fromNumber = getProvider(123 as any);
		expect(fromNumber.id).toBe("opencode");

		const fromObject = getProvider({} as any);
		expect(fromObject.id).toBe("opencode");
	});

	test("listProviderModels: handles null, undefined and non-string types gracefully", async () => {
		const fromNull = await listProviderModels(null as any);
		expect(Array.isArray(fromNull)).toBe(true);

		const fromUndef = await listProviderModels(undefined as any);
		expect(Array.isArray(fromUndef)).toBe(true);
	});

	test("subprocess: probeAcpAgentModels with 1ms timeout terminates cleanly without deadlock", async () => {
		const start = Date.now();
		const result = await probeAcpAgentModels("claude-code", 1);
		const elapsed = Date.now() - start;
		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(0);
		// Must complete within bounded time (< 2000ms), not hang indefinitely
		expect(elapsed).toBeLessThan(2000);
	});
});
