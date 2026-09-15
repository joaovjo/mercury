import { existsSync, readFileSync } from "node:fs";
import { paths } from "@mercury/core";

/**
 * After a write, notify a running dashboard server (if any) so the UI can
 * live-refresh. The server writes a lockfile containing {port, token}.
 * Best-effort: silently no-ops if no server is running.
 */
export async function notifyChange(table: string): Promise<void> {
	if (!existsSync(paths.serverLock)) return;
	try {
		const { port, token } = JSON.parse(readFileSync(paths.serverLock, "utf8"));
		await fetch(`http://127.0.0.1:${port}/_internal/changed`, {
			method: "POST",
			headers: { "content-type": "application/json", "x-mercury-token": token },
			body: JSON.stringify({ table }),
			signal: AbortSignal.timeout(500),
		});
	} catch {
		// server gone or stale lockfile — ignore
	}
}
