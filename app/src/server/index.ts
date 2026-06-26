import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Flags } from "../cli/flags.ts";
import { int, str } from "../cli/flags.ts";
import { ensureHome, paths } from "../paths.ts";
import { db } from "../db/index.ts";
import { queries } from "./queries.ts";
import { SessionManager } from "../acp/session.ts";
import { PROVIDERS, listProviderModels } from "../acp/providers.ts";
import { loadConfig } from "../paths.ts";
import { EMBEDDED_ASSETS } from "./assets.gen.ts";
import { getUpdateStatus } from "../update-check.ts";
import { runUpdate } from "../cli/update.ts";

/** Directory holding the built Svelte assets (web/dist), resolved next to this file or the binary. */
function webDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "../../web/dist"), // running from source
    join(here, "web"), // embedded next to compiled binary
    join(process.cwd(), "web/dist"),
  ];
  return candidates.find((c) => existsSync(c)) ?? candidates[0]!;
}

type WSData = { token: string };

export async function dashboardCmd(flags: Flags): Promise<void> {
  ensureHome();
  db(); // ensure schema

  const port = int(flags, "port") ?? 0; // 0 = OS-assigned
  const token = crypto.randomUUID();
  const noOpen = flags["no-open"] === true;
  const root = webDir();

  const sockets = new Set<import("bun").ServerWebSocket<WSData>>();
  let updateRunning = false;

  // ACP session manager — forwards agent updates to all connected sockets.
  const acp = new SessionManager(process.cwd(), (event) => broadcast(sockets, event));

  const server = Bun.serve<WSData>({
    port,
    hostname: "127.0.0.1",
    async fetch(req, srv) {
      const url = new URL(req.url);
      const path = url.pathname;

      // --- WebSocket upgrade for live updates ---
      if (path === "/ws") {
        if (url.searchParams.get("token") !== token) {
          return new Response("forbidden", { status: 403 });
        }
        if (srv.upgrade(req, { data: { token } })) return undefined as unknown as Response;
        return new Response("upgrade failed", { status: 400 });
      }

      // --- Internal change hook (called by the CLI after a write) ---
      if (path === "/_internal/changed" && req.method === "POST") {
        if (req.headers.get("x-mercury-token") !== token) {
          return new Response("forbidden", { status: 403 });
        }
        const body = (await req.json().catch(() => ({}))) as { table?: string };
        broadcast(sockets, { type: "changed", table: body.table ?? "unknown" });
        return Response.json({ ok: true });
      }

      // --- REST API (read-only in Phase 1) ---
      if (path.startsWith("/api/")) {
        if (url.searchParams.get("token") !== token) {
          return new Response("forbidden", { status: 403 });
        }
        // Search endpoints (Phase 2) — POST with JSON body, hit LinkedIn MCP.
        if (path.startsWith("/api/search/")) {
          return handleSearch(path, req);
        }
        if (path === "/api/update-status") {
          return Response.json(await getUpdateStatus());
        }
        if (path === "/api/update" && req.method === "POST") {
          if (updateRunning) return Response.json({ ok: true, running: true });
          updateRunning = true;
          void runUpdate((event) => {
            broadcast(sockets, { type: "update", event });
            if (event.type === "done") updateRunning = false;
          }).catch((err) => {
            updateRunning = false;
            broadcast(sockets, {
              type: "update",
              event: { type: "line", stream: "stderr", text: String(err) + "\n" },
            });
            broadcast(sockets, { type: "update", event: { type: "done", code: 1 } });
          });
          return Response.json({ ok: true, running: true });
        }
        // ACP endpoints (Phase 3) — launch skills via the agent.
        if (path === "/api/acp/providers") {
          const cfg = loadConfig();
          const providerEntries = await Promise.all(
            Object.values(PROVIDERS).map(async (p) => ({
              id: p.id,
              displayName: p.displayName,
              models: await listProviderModels(p.id),
              defaultModel: p.defaultModel,
            })),
          );
          return Response.json({
            providers: providerEntries,
            default: cfg.provider ?? "opencode",
          });
        }
        if (path === "/api/acp/run" && req.method === "POST") {
          const body = (await req.json().catch(() => ({}))) as {
            provider?: string;
            skill?: string;
            params?: Record<string, string>;
            model?: string;
          };
          // Fire and forget — progress streams over the WebSocket.
          void acp.run(body.provider ?? "opencode", body.skill ?? "", body.params ?? {}, body.model);
          return Response.json({ ok: true });
        }
        if (path === "/api/acp/cancel" && req.method === "POST") {
          acp.cancel();
          return Response.json({ ok: true });
        }
        return handleApi(path);
      }

      // --- Static assets (Svelte build) ---
      return serveStatic(root, path, token);
    },
    websocket: {
      open(ws) {
        sockets.add(ws);
        ws.send(JSON.stringify({ type: "hello" }));
      },
      close(ws) {
        sockets.delete(ws);
      },
      message() {
        /* client is read-only in Phase 1 */
      },
    },
  });

  // Write lockfile so the CLI can notify us of DB changes.
  writeFileSync(paths.serverLock, JSON.stringify({ port: server.port, token, pid: process.pid }));

  // Warm the provider/model cache in the background so the first visit to
  // Launch/Profile (which call /api/acp/providers) doesn't pay the cold-start
  // cost of shelling out to `opencode models` / `claude config list`.
  void Promise.all(
    Object.values(PROVIDERS).map((p) => listProviderModels(p.id).catch(() => [])),
  );

  const cleanup = () => {
    try {
      if (existsSync(paths.serverLock)) unlinkSync(paths.serverLock);
    } catch {}
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  const dashUrl = `http://127.0.0.1:${server.port}/?token=${token}`;
  console.log(`\n  Mercury dashboard running at:\n  ${dashUrl}\n`);
  if (!noOpen) await openBrowser(dashUrl);
}

function broadcast(
  sockets: Set<import("bun").ServerWebSocket<WSData>>,
  msg: unknown,
): void {
  const data = JSON.stringify(msg);
  for (const ws of sockets) ws.send(data);
}

function handleApi(path: string): Response {
  switch (path) {
    case "/api/overview":
      return Response.json(queries.overview());
    case "/api/recruiters":
      return Response.json(queries.recruiters());
    case "/api/jobs":
      return Response.json(queries.jobs());
    case "/api/metrics":
      return Response.json(queries.metrics());
    case "/api/interviews":
      return Response.json(queries.interviews());
    case "/api/applications":
      return Response.json(queries.applications());
    case "/api/answers":
      return Response.json(queries.answers());
    case "/api/activity":
      return Response.json(queries.activity());
    case "/api/profile":
      return Response.json(queries.profile());
    case "/api/profile-snapshot":
      return Response.json(queries.profileSnapshot());
    default:
      return new Response("not found", { status: 404 });
  }
}

async function handleSearch(path: string, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const { searchJobs, searchPeople, jobDetails } = await import("../mcp/search.ts");
    switch (path) {
      case "/api/search/jobs":
        return Response.json(
          await searchJobs({
            keywords: String(body.keywords ?? ""),
            location: body.location ? String(body.location) : undefined,
            workType: body.workType ? String(body.workType) : undefined,
            maxPages: body.maxPages ? Number(body.maxPages) : undefined,
          }),
        );
      case "/api/search/people":
        return Response.json(
          await searchPeople({
            keywords: String(body.keywords ?? ""),
            company: body.company ? String(body.company) : undefined,
            location: body.location ? String(body.location) : undefined,
          }),
        );
      case "/api/search/job-details":
        return Response.json(await jobDetails(String(body.jobId ?? "")));
      default:
        return new Response("not found", { status: 404 });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

async function serveStatic(root: string, path: string, token: string): Promise<Response> {
  const rel = path === "/" ? "/index.html" : path;

  // 1) Embedded assets (compiled binary) take priority.
  const embedded = EMBEDDED_ASSETS[rel] ?? EMBEDDED_ASSETS["/index.html"];
  if (EMBEDDED_ASSETS[rel]) {
    return new Response(Buffer.from(EMBEDDED_ASSETS[rel]!, "base64"), {
      headers: { "content-type": contentType(rel) },
    });
  }

  // 2) On-disk build (running from source).
  const file = Bun.file(join(root, rel));
  if (await file.exists()) return new Response(file);
  // SPA fallback
  const index = Bun.file(join(root, "index.html"));
  if (await index.exists()) return new Response(index);
  // Embedded SPA fallback
  if (embedded) {
    return new Response(Buffer.from(embedded, "base64"), {
      headers: { "content-type": "text/html" },
    });
  }
  // No build yet — serve a helpful placeholder.
  return new Response(placeholderHtml(token), {
    headers: { "content-type": "text/html" },
  });
}

function contentType(p: string): string {
  if (p.endsWith(".html")) return "text/html";
  if (p.endsWith(".js")) return "text/javascript";
  if (p.endsWith(".css")) return "text/css";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".json")) return "application/json";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

async function openBrowser(url: string): Promise<void> {
  const cmd =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  try {
    Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
  } catch {
    /* headless / no browser — URL already printed */
  }
}

function placeholderHtml(_token: string): string {
  return `<!doctype html><meta charset=utf8><title>Mercury</title>
<body style="font-family:system-ui;background:#0a0a0f;color:#e4e4e7;padding:40px">
<h1 style="background:linear-gradient(135deg,#0077b5,#6dd5ed);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Mercury</h1>
<p>Server is running, but the web UI hasn't been built yet.</p>
<p>Run <code>cd app/web &amp;&amp; bun install &amp;&amp; bun run build</code>, then refresh.</p>
</body>`;
}
