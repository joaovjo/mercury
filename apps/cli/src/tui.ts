import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Flags } from "./flags.ts";

/**
 * `mercury tui` — launches the interactive OpenTUI terminal application.
 */
export async function tuiCmd(_flags: Flags): Promise<void> {
	const here = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		join(here, "../../tui/src/index.tsx"),
		join(process.cwd(), "apps/tui/src/index.tsx"),
		join(homedir(), ".mercury/src/apps/tui/src/index.tsx"),
	];
	const tuiEntry = candidates.find((c) => existsSync(c));

	if (!tuiEntry) {
		console.error("error: could not locate apps/tui entrypoint.");
		process.exit(1);
	}

	const proc = Bun.spawn(["bun", "run", tuiEntry], {
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	});

	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		process.exit(exitCode);
	}
}
