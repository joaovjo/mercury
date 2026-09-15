import { db } from "@mercury/db";
import { ensureHome, loadConfig, paths, saveConfig } from "@mercury/core";

/** mercury init — scaffold ~/.mercury/, create db, seed config */
export function initCmd(): void {
	ensureHome();
	db(); // triggers schema creation
	const cfg = loadConfig();
	if (!cfg.provider) {
		cfg.provider = "opencode";
		saveConfig(cfg);
	}
	console.log(`Mercury initialized at ${paths.home}`);
	console.log(`  db:     ${paths.db}`);
	console.log(`  config: ${paths.config}`);
	console.log(`Run \`mercury dashboard\` to open the hub.`);
}
