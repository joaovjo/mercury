/**
 * Minimal flag parser. Supports `--key value` and `--flag` (boolean).
 * No external deps — keeps the compiled binary lean.
 */
export type Flags = Record<string, string | boolean>;

export function parseFlags(argv: string[]): {
	positionals: string[];
	flags: Flags;
} {
	const positionals: string[] = [];
	const flags: Flags = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]!;
		if (a.startsWith("--")) {
			const key = a.slice(2);
			const next = argv[i + 1];
			if (next === undefined || next.startsWith("--")) {
				flags[key] = true;
			} else {
				flags[key] = next;
				i++;
			}
		} else {
			positionals.push(a);
		}
	}
	return { positionals, flags };
}

export function str(flags: Flags, key: string): string | undefined {
	const v = flags[key];
	return typeof v === "string" ? v : undefined;
}

export function int(flags: Flags, key: string): number | undefined {
	const v = str(flags, key);
	if (v === undefined) return undefined;
	const n = Number.parseInt(v, 10);
	return Number.isNaN(n) ? undefined : n;
}

export function reqStr(flags: Flags, key: string): string {
	const v = str(flags, key);
	if (v === undefined) {
		console.error(`error: missing required --${key}`);
		process.exit(1);
	}
	return v;
}
