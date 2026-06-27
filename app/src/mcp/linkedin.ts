import { platform } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadConfig } from "../paths.ts";
import { sweepLinkedinBrowsers } from "../cli/linkedin.ts";

/**
 * Thin wrapper around the LinkedIn MCP server (stdio). Lazily spawns the
 * server process on first use and reuses the connection. Used for instant
 * raw search (the "instant" half of hybrid search).
 */
let _client: Client | null = null;
let _connecting: Promise<Client> | null = null;

/** Default command — overridable via config.linkedinMcpCommand. */
const DEFAULT_CMD = ["uvx", "mcp-server-linkedin@latest"];

async function connect(): Promise<Client> {
  if (_client) return _client;
  if (_connecting) return _connecting;

  _connecting = (async () => {
    // On Windows the LinkedIn MCP leaves orphaned headless browsers that lock
    // the persistent profile and make the next launch fail. Sweep them before
    // spawning so we start clean. No-op-ish elsewhere (see sweepLinkedinBrowsers).
    if (platform() === "win32") await sweepLinkedinBrowsers().catch(() => {});

    const cfg = loadConfig();
    const cmd = cfg.linkedinMcpCommand ?? DEFAULT_CMD;
    const transport = new StdioClientTransport({
      command: cmd[0]!,
      args: cmd.slice(1),
      env: { ...process.env, UV_HTTP_TIMEOUT: "300" } as Record<string, string>,
    });
    const client = new Client({ name: "mercury-dashboard", version: "0.1.0" });
    await client.connect(transport);
    _client = client;
    return client;
  })();

  try {
    return await _connecting;
  } finally {
    _connecting = null;
  }
}

/** Returns the available tool names (for diagnostics / capability checks). */
export async function listTools(): Promise<string[]> {
  const client = await connect();
  const res = await client.listTools();
  return res.tools.map((t) => t.name);
}

/**
 * Call an MCP tool and return its parsed result. MCP tools return content
 * blocks; we extract the first text block and try to JSON-parse it, falling
 * back to the raw text.
 */
export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const client = await connect();
  const res = await client.callTool({ name, arguments: args });
  const content = (res.content ?? []) as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function closeMcp(): Promise<void> {
  try {
    await _client?.close();
  } catch {}
  _client = null;
}
