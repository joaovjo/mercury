import { sweepLinkedinBrowsers } from "@mercury/mcp";
import type { Flags } from "./flags.ts";

/**
 * `mercury linkedin <sub>` — currently just `reset`, which sweeps stale LinkedIn
 * MCP browser sessions and locks. Skills call this as a preflight; users can run
 * it by hand when the LinkedIn MCP starts failing.
 */
export async function linkedinCmd(sub: string, _flags: Flags): Promise<void> {
	if (sub === "reset" || sub === "") {
		const { killed, locksCleared } = await sweepLinkedinBrowsers();
		console.log(
			`linkedin reset — killed ${killed} stale browser process(es), cleared ${locksCleared} stale lock file(s).`,
		);
		return;
	}
	console.error(
		`unknown subcommand: linkedin ${sub}\nusage: mercury linkedin reset`,
	);
	process.exit(1);
}
