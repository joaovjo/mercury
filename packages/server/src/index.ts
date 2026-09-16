import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SessionManager, listProviderModels, PROVIDERS } from "@mercury/acp";
import { ensureHome, getUpdateStatus, loadConfig, paths } from "@mercury/core";
import { db, now } from "@mercury/db";
import { searchJobs, searchPeople, jobDetails } from "@mercury/mcp";
import { runSync } from "@mercury/recruiter";
import { buildAgentCard } from "@mercury/a2a";
import { EMBEDDED_ASSETS } from "./assets.ts";
import { queries } from "./queries.ts";

export { queries } from "./queries.ts";
export { EMBEDDED_ASSETS } from "./assets.ts";

/** Directory holding the built UI assets (apps/web/dist), resolved relative to project or home. */
function webDir(): string {
	const here = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		join(here, "../../../apps/web/dist"),
		join(process.cwd(), "apps/web/dist"),
		join(homedir(), ".mercury/src/apps/web/dist"),
	];
	return candidates.find((c) => existsSync(c)) ?? candidates[0]!;
}

/**
 * Resolve the Mercury workspace the agent should run in. This is the directory
 * the spawned agent uses as its cwd / ACP session root.
 */
export function resolveWorkspace(explicit?: string): string {
	if (explicit) return resolve(explicit);
	let dir = process.cwd();
	for (;;) {
		const hasSkills = existsSync(join(dir, ".claude", "skills"));
		const projData = join(dir, ".mercury");
		const hasProjData =
			existsSync(projData) && resolve(projData) !== resolve(paths.home);
		if (hasSkills || hasProjData) return dir;
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return process.cwd();
}

export type WSData = { token: string };

export interface ServerOptions {
	port?: number;
	token?: string;
	noOpen?: boolean;
	workspace?: string;
}

export async function startDashboardServer(options: ServerOptions = {}): Promise<{
	server: import("bun").Server<WSData>;
	url: string;
	token: string;
}> {
	ensureHome();
	db(); // ensure schema

	const port = options.port ?? 0; // 0 = OS-assigned
	const token = options.token ?? crypto.randomUUID();
	const noOpen = options.noOpen === true;
	const root = webDir();

	const sockets = new Set<import("bun").ServerWebSocket<WSData>>();
	let updateRunning = false;

	const workspace = resolveWorkspace(options.workspace);
	const acp = new SessionManager(workspace, (event) =>
		broadcast(sockets, event),
	);

	const server = Bun.serve<WSData>({
		port,
		hostname: "127.0.0.1",
		idleTimeout: 60,
		async fetch(req, srv) {
			const url = new URL(req.url);
			const path = url.pathname;

			// --- A2A Protocol Agent Card ---
			if (path === "/.well-known/agent.json") {
				return Response.json(buildAgentCard(`http://127.0.0.1:${srv.port}`));
			}

			// --- WebSocket upgrade for live updates ---
			if (path === "/ws") {
				if (url.searchParams.get("token") !== token) {
					return new Response("forbidden", { status: 403 });
				}
				if (srv.upgrade(req, { data: { token } }))
					return undefined as unknown as Response;
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

			// --- REST API ---
			if (path.startsWith("/api/")) {
				if (url.searchParams.get("token") !== token) {
					return new Response("forbidden", { status: 403 });
				}
				if (path.startsWith("/api/search/")) {
					return handleSearch(path, req);
				}
				if (path === "/api/update-status") {
					return Response.json(await getUpdateStatus());
				}
				if (path === "/api/answer" && req.method === "POST") {
					const body = (await req.json().catch(() => ({}))) as {
						key?: string;
						value?: string;
						category?: string;
					};
					const key = (body.key ?? "").trim();
					if (!key)
						return Response.json({ error: "missing key" }, { status: 400 });
					db()
						.query(
							`INSERT INTO applicant_answers (key, value, category, updated_at)
               VALUES ($key, $value, $cat, $at)
               ON CONFLICT(key) DO UPDATE SET
                 value = excluded.value,
                 category = COALESCE(excluded.category, applicant_answers.category),
                 updated_at = excluded.updated_at`,
						)
						.run({
							$key: key,
							$value: body.value ?? null,
							$cat: body.category ?? "custom",
							$at: now(),
						});
					broadcast(sockets, { type: "changed", table: "applicant_answers" });
					return Response.json({ ok: true });
				}
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
					void acp.run(
						body.provider ?? "opencode",
						body.skill ?? "",
						body.params ?? {},
						body.model,
					);
					return Response.json({ ok: true });
				}
				if (path === "/api/acp/cancel" && req.method === "POST") {
					acp.cancel();
					return Response.json({ ok: true });
				}
				if (path === "/api/recruiters/sync" && req.method === "POST") {
					const body = (await req.json().catch(() => ({}))) as {
						apply?: boolean;
					};
					try {
						const result = await runSync({ apply: body.apply === true });
						if (body.apply === true && result.changes.length) {
							db()
								.query(
									`INSERT INTO activity_log (kind, skill, summary)
                   VALUES ('recruiter_sync', 'recruiter-sync', $summary)`,
								)
								.run({
									$summary: `Sync: ${result.changes.length} accepted (${result.changes
										.map((c) => c.name)
										.join(", ")})`,
								});
							broadcast(sockets, { type: "changed", table: "recruiters" });
							broadcast(sockets, { type: "changed", table: "activity_log" });
						}
						return Response.json(result);
					} catch (err) {
						return Response.json(
							{ error: err instanceof Error ? err.message : String(err) },
							{ status: 502 },
						);
					}
				}
				return handleApi(path);
			}

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

	writeFileSync(
		paths.serverLock,
		JSON.stringify({ port: server.port, token, pid: process.pid }),
	);

	void Promise.all(
		Object.values(PROVIDERS).map((p) =>
			listProviderModels(p.id).catch(() => []),
		),
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
	console.log(`\n  Mercury dashboard running at:\n  ${dashUrl}`);
	console.log(`  Agent workspace: ${workspace}\n`);
	if (!noOpen) await openBrowser(dashUrl);

	return { server, url: dashUrl, token };
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
		case "/api/recruiters/due":
			return Response.json(queries.recruitersDue());
		case "/api/outreach":
			return Response.json(queries.outreach());
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

async function serveStatic(
	root: string,
	path: string,
	token: string,
): Promise<Response> {
	const rel = path === "/" ? "/index.html" : path;

	const embedded = EMBEDDED_ASSETS[rel] ?? EMBEDDED_ASSETS["/index.html"];
	if (EMBEDDED_ASSETS[rel]) {
		return new Response(Buffer.from(EMBEDDED_ASSETS[rel]!, "base64"), {
			headers: { "content-type": contentType(rel) },
		});
	}

	const file = Bun.file(join(root, rel));
	if (await file.exists()) return new Response(file);
	const index = Bun.file(join(root, "index.html"));
	if (await index.exists()) return new Response(index);
	if (embedded) {
		return new Response(Buffer.from(embedded, "base64"), {
			headers: { "content-type": "text/html" },
		});
	}
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
<p>Run <code>bun run build:web</code>, then refresh.</p>
</body>`;
}
