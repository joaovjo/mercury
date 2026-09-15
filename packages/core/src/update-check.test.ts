import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOME = mkdtempSync(join(tmpdir(), "mercury-update-test-"));
process.env.MERCURY_HOME = HOME;

// Local stub for the GitHub Releases API. `remoteLatest` is mutated per-test.
let remoteLatest: string | null = null;
let remoteOk = true;
const server = Bun.serve({
	port: 0,
	fetch() {
		if (!remoteOk) return new Response("nope", { status: 500 });
		return Response.json({ tag_name: `v${remoteLatest}` });
	},
});
process.env.MERCURY_UPDATE_URL = `http://localhost:${server.port}/`;

// Import AFTER env is set so paths + module constants pick up the overrides.
const { getUpdateStatus, isNewer } = await import("./update-check.ts");
const { VERSION } = await import("./version.ts");
const { paths } = await import("./paths.ts");

const [maj = 0, min = 0] = VERSION.split(".").map(Number);
const OLDER = `${Math.max(0, maj - 1)}.0.0`;
const NEWER = `${maj}.${min + 1}.0`;

function writeCache(latest: string, ageMs = 0): void {
	writeFileSync(
		paths.updateCache,
		JSON.stringify({ checkedAt: Date.now() - ageMs, latest }),
	);
}

function clearCache(): void {
	if (existsSync(paths.updateCache)) rmSync(paths.updateCache);
}

beforeEach(() => {
	clearCache();
	remoteOk = true;
	remoteLatest = null;
});

afterAll(() => {
	server.stop(true);
	rmSync(HOME, { recursive: true, force: true });
});

describe("isNewer sanity (older fixture is actually older)", () => {
	test("OLDER < VERSION < NEWER", () => {
		expect(isNewer(VERSION, OLDER)).toBe(true);
		expect(isNewer(NEWER, VERSION)).toBe(true);
	});
});

describe("issue #13 — stale cache behind installed version", () => {
	test("fresh cache pinned to an OLD version is ignored; re-fetches real latest", async () => {
		writeCache(OLDER, 0);
		remoteLatest = NEWER;
		const status = await getUpdateStatus();
		expect(status.current).toBe(VERSION);
		expect(status.latest).toBe(NEWER);
		expect(status.updateAvailable).toBe(true);
	});

	test("never reports latest older than installed, even if network also fails", async () => {
		writeCache(OLDER, 0);
		remoteOk = false;
		const status = await getUpdateStatus();
		expect(status.latest).not.toBe(OLDER);
		expect(status.updateAvailable).toBe(false);
		if (status.latest !== null)
			expect(isNewer(VERSION, status.latest)).toBe(false);
	});

	test("up-to-date: fresh cache equal to VERSION reports no update", async () => {
		writeCache(VERSION, 0);
		const status = await getUpdateStatus();
		expect(status.latest).toBe(VERSION);
		expect(status.updateAvailable).toBe(false);
	});
});

describe("normal update path still works", () => {
	test("genuinely newer remote release is offered", async () => {
		clearCache();
		remoteLatest = NEWER;
		const status = await getUpdateStatus();
		expect(status.latest).toBe(NEWER);
		expect(status.updateAvailable).toBe(true);
		const cached = JSON.parse(readFileSync(paths.updateCache, "utf8"));
		expect(cached.latest).toBe(NEWER);
	});

	test("fresh, valid cache (>= VERSION) is used without a network hit", async () => {
		writeCache(NEWER, 0);
		remoteOk = false;
		const status = await getUpdateStatus();
		expect(status.latest).toBe(NEWER);
		expect(status.updateAvailable).toBe(true);
	});
});
