/**
 * Regression tests for issue #13 — `mercury update` must never trust a cached
 * `latest` that is behind the installed VERSION, and must report the installed
 * version when up to date.
 *
 * These run before importing update-check.ts so MERCURY_HOME points at an
 * isolated temp dir (paths.ts reads the env at import time). A local HTTP stub
 * backs MERCURY_UPDATE_URL so we control what "the remote" returns.
 */
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
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
const { VERSION } = await import("./version.gen.ts");
const { paths } = await import("./paths.ts");

// VERSION is baked into the binary; derive test fixtures relative to it.
// OLDER must be strictly less than VERSION regardless of the patch number
// (VERSION=0.8.0 → patch 0, so drop a major to stay safely behind).
const [maj, min] = VERSION.split(".").map(Number);
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
    // Cache claims latest=OLDER, written 'now' so it's within CHECK_INTERVAL.
    writeCache(OLDER, 0);
    remoteLatest = NEWER; // remote actually has a newer release
    const status = await getUpdateStatus();
    expect(status.current).toBe(VERSION);
    expect(status.latest).toBe(NEWER);
    expect(status.updateAvailable).toBe(true);
  });

  test("never reports latest older than installed, even if network also fails", async () => {
    writeCache(OLDER, 0);
    remoteOk = false; // network down → would normally fall back to stale cache
    const status = await getUpdateStatus();
    // Must NOT advertise OLDER. Clamp to current at worst.
    expect(status.latest).not.toBe(OLDER);
    expect(status.updateAvailable).toBe(false);
    if (status.latest !== null) expect(isNewer(VERSION, status.latest)).toBe(false);
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
    // And it should have written the fresh value to cache.
    const cached = JSON.parse(readFileSync(paths.updateCache, "utf8"));
    expect(cached.latest).toBe(NEWER);
  });

  test("fresh, valid cache (>= VERSION) is used without a network hit", async () => {
    writeCache(NEWER, 0);
    remoteOk = false; // prove we did NOT need the network
    const status = await getUpdateStatus();
    expect(status.latest).toBe(NEWER);
    expect(status.updateAvailable).toBe(true);
  });
});
