import { readFileSync, writeFileSync } from "node:fs";
import type { Subprocess } from "bun";
import { getProvider, type AcpProviderCommand } from "./providers.ts";

/**
 * Minimal Agent Client Protocol (ACP) client.
 *
 * ACP is newline-delimited JSON-RPC 2.0 over the agent's stdio. We act as the
 * *client* (editor side): we spawn the agent, run the initialize handshake,
 * create a session, send prompts, and receive streaming `session/update`
 * notifications. The agent may call back into us for fs access and permission.
 *
 * Spec: https://agentclientprotocol.com
 */

type Json = unknown;
interface RpcMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: Json;
  result?: Json;
  error?: { code: number; message: string; data?: Json };
}

export interface AcpEvents {
  /** Streaming update from the agent (text chunks, tool calls, plans, …). */
  onUpdate?: (update: Json) => void;
  /** Permission request — return the chosen optionId. */
  onPermission?: (params: Json) => Promise<string>;
  /** Agent log/stderr line. */
  onLog?: (line: string) => void;
  /** Agent process exited. */
  onExit?: (code: number | null) => void;
}

export class AcpClient {
  private proc: Subprocess<"pipe", "pipe", "pipe"> | null = null;
  private nextId = 1;
  private pending = new Map<
    number | string,
    { resolve: (v: Json) => void; reject: (e: Error) => void }
  >();
  private buf = "";
  private sessionId: string | null = null;

  constructor(
    private providerId: string,
    private cwd: string,
    private events: AcpEvents = {},
    private model?: string,
  ) {}

  /** Spawn the agent and run the initialize handshake + create a session. */
  async start(): Promise<void> {
    const provider = getProvider(this.providerId);
    const spawnOpts: AcpProviderCommand = provider.command(this.cwd, this.model);
    this.proc = Bun.spawn(spawnOpts.cmd, {
      cwd: this.cwd,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: spawnOpts.env ? { ...process.env, ...spawnOpts.env } : undefined,
    });

    this.readStdout();
    this.readStderr();
    this.proc.exited.then((code) => this.events.onExit?.(code));

    // 1) initialize — advertise our client capabilities
    await this.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
      },
    });

    // 2) session/new — bound to the Mercury workspace cwd
    const session = (await this.request("session/new", {
      cwd: this.cwd,
      mcpServers: [],
    })) as { sessionId: string };
    this.sessionId = session.sessionId;
  }

  /** Send a prompt to the active session. Resolves when the turn ends. */
  async prompt(text: string): Promise<Json> {
    if (!this.sessionId) throw new Error("no active ACP session");
    return this.request("session/prompt", {
      sessionId: this.sessionId,
      prompt: [{ type: "text", text }],
    });
  }

  async cancel(): Promise<void> {
    if (!this.sessionId) return;
    await this.notify("session/cancel", { sessionId: this.sessionId });
  }

  stop(): void {
    try {
      this.proc?.kill();
    } catch {}
    this.proc = null;
  }

  // --- JSON-RPC plumbing ---

  private send(msg: RpcMessage): void {
    const line = JSON.stringify(msg) + "\n";
    this.proc?.stdin.write(line);
    this.proc?.stdin.flush?.();
  }

  private request(method: string, params: Json): Promise<Json> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  private notify(method: string, params: Json): void {
    this.send({ jsonrpc: "2.0", method, params });
  }

  private async readStdout(): Promise<void> {
    if (!this.proc) return;
    const reader = this.proc.stdout.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      this.buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = this.buf.indexOf("\n")) !== -1) {
        const line = this.buf.slice(0, nl).trim();
        this.buf = this.buf.slice(nl + 1);
        if (line) this.handleLine(line);
      }
    }
  }

  private async readStderr(): Promise<void> {
    if (!this.proc) return;
    const reader = this.proc.stderr.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        if (line.trim()) this.events.onLog?.(line.trim());
      }
    }
  }

  private async handleLine(line: string): Promise<void> {
    let msg: RpcMessage;
    try {
      msg = JSON.parse(line);
    } catch {
      this.events.onLog?.(line);
      return;
    }

    // Response to one of our requests
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result ?? null);
      }
      return;
    }

    // Request or notification FROM the agent
    if (msg.method) {
      await this.handleAgentCall(msg);
    }
  }

  private async handleAgentCall(msg: RpcMessage): Promise<void> {
    const { method, params, id } = msg;
    const respond = (result: Json) =>
      id !== undefined && this.send({ jsonrpc: "2.0", id, result });
    const fail = (message: string) =>
      id !== undefined &&
      this.send({ jsonrpc: "2.0", id, error: { code: -32000, message } });

    switch (method) {
      case "session/update":
        this.events.onUpdate?.(params);
        respond(null);
        break;

      case "session/request_permission": {
        try {
          const optionId = this.events.onPermission
            ? await this.events.onPermission(params)
            : firstAllowOption(params);
          respond({ outcome: { outcome: "selected", optionId } });
        } catch (e) {
          fail(e instanceof Error ? e.message : String(e));
        }
        break;
      }

      case "fs/read_text_file": {
        try {
          const p = params as { path: string };
          respond({ content: readFileSync(p.path, "utf8") });
        } catch (e) {
          fail(e instanceof Error ? e.message : String(e));
        }
        break;
      }

      case "fs/write_text_file": {
        try {
          const p = params as { path: string; content: string };
          writeFileSync(p.path, p.content);
          respond(null);
        } catch (e) {
          fail(e instanceof Error ? e.message : String(e));
        }
        break;
      }

      default:
        // Unknown notification — ignore; unknown request — null result.
        if (id !== undefined) respond(null);
    }
  }
}

/** Default permission resolver: pick the first allow-ish option. */
function firstAllowOption(params: Json): string {
  const p = params as { options?: Array<{ optionId: string; kind?: string }> };
  const opts = p.options ?? [];
  const allow = opts.find((o) => o.kind?.includes("allow")) ?? opts[0];
  return allow?.optionId ?? "allow";
}
