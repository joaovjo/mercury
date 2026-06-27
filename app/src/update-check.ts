/**
 * Update check: tells an installed CLI when a newer release exists, so the
 * user can re-run the one-line installer.
 *
 * Design goals:
 *  - Never block or break a command. All failures are swallowed.
 *  - Hit the network at most once per CHECK_INTERVAL (cached in ~/.mercury/).
 *  - "latest" = the newest published GitHub Release tag (an intentional release,
 *    not just whatever was committed). The Releases API also isn't subject to
 *    the raw.githubusercontent.com edge-cache staleness.
 *  - Opt out entirely with MERCURY_NO_UPDATE_CHECK=1.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { paths, ensureHome } from "./paths.ts";
import { VERSION } from "./version.gen.ts";

const CHECK_INTERVAL_MS = 10 * 60 * 60 * 1000; // 10 hours
const FETCH_TIMEOUT_MS = 1500;
/**
 * GitHub Releases API for the latest published (non-draft, non-prerelease)
 * release. Override with MERCURY_UPDATE_URL for testing (any URL returning
 * JSON with a `tag_name` or `version` field works).
 */
const RELEASES_API =
  process.env.MERCURY_UPDATE_URL ??
  "https://api.github.com/repos/Daniel-Boll/mercury/releases/latest";
const INSTALL_CMD =
  "curl -fsSL https://raw.githubusercontent.com/Daniel-Boll/mercury/main/bootstrap.sh | bash";

interface UpdateCache {
  /** Last time we hit the network (epoch ms). */
  checkedAt: number;
  /** Latest version string we saw on the remote. */
  latest: string;
}

function disabled(): boolean {
  const v = process.env.MERCURY_NO_UPDATE_CHECK;
  return v === "1" || v === "true";
}

function readCache(): UpdateCache | null {
  try {
    if (!existsSync(paths.updateCache)) return null;
    return JSON.parse(readFileSync(paths.updateCache, "utf8")) as UpdateCache;
  } catch {
    return null;
  }
}

function writeCache(c: UpdateCache): void {
  try {
    ensureHome();
    writeFileSync(paths.updateCache, JSON.stringify(c));
  } catch {
    /* best-effort */
  }
}

/** Parse "1.2.3" (ignoring any pre-release/build suffix) into [1,2,3]. */
function parseSemver(v: string): [number, number, number] | null {
  const m = /^\s*v?(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** True when `latest` is strictly greater than `current`. */
export function isNewer(latest: string, current: string): boolean {
  const a = parseSemver(latest);
  const b = parseSemver(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

async function fetchLatest(): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(RELEASES_API, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: {
        accept: "application/vnd.github+json",
        // GitHub requires a UA; identify ourselves politely.
        "user-agent": `mercury/${VERSION}`,
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    // GitHub Releases returns `tag_name` (e.g. "v0.2.0"); test fixtures may
    // return `version`. parseSemver tolerates the leading "v".
    const body = (await res.json()) as { tag_name?: string; version?: string };
    const raw = body.tag_name ?? body.version;
    // Normalize "v0.2.0" -> "0.2.0" so it matches VERSION for display + compare.
    return typeof raw === "string" ? raw.replace(/^v/i, "") : null;
  } catch {
    return null;
  }
}

/**
 * A cached `latest` that is older than the installed build is never
 * legitimate — it means the cache was written by an older binary (or the
 * release it pointed at was since the user upgraded out-of-band). Treat such
 * a cache as stale regardless of its timestamp.
 */
function cacheIsStale(cache: UpdateCache): boolean {
  return isNewer(VERSION, cache.latest);
}

/**
 * Resolve the latest known version, using the cache when it's fresh and
 * refreshing from the network otherwise. Returns null on any failure.
 *
 * The cache is also considered stale (and re-fetched) whenever the installed
 * VERSION is newer than the cached `latest`, so a left-over cache can never
 * pin us to a version older than what's actually installed.
 */
async function resolveLatest(): Promise<string | null> {
  const cache = readCache();
  const now = Date.now();
  if (cache && now - cache.checkedAt < CHECK_INTERVAL_MS && !cacheIsStale(cache)) {
    return cache.latest;
  }
  const latest = await fetchLatest();
  if (latest) {
    writeCache({ checkedAt: now, latest });
    return latest;
  }
  // Network failed — fall back to a stale cache value only if it isn't behind
  // the installed version. Refresh the timestamp lightly so we don't hammer on
  // every invocation.
  if (cache && !cacheIsStale(cache)) {
    writeCache({ checkedAt: now, latest: cache.latest });
    return cache.latest;
  }
  return null;
}

export async function getUpdateStatus(): Promise<{
  current: string;
  latest: string | null;
  updateAvailable: boolean;
}> {
  const resolved = await resolveLatest();
  // Never advertise a `latest` that is behind the installed version: a stale
  // or garbage cache must not be able to report a version older than current.
  const latest = resolved && isNewer(VERSION, resolved) ? VERSION : resolved;
  return {
    current: VERSION,
    latest,
    updateAvailable: latest ? isNewer(latest, VERSION) : false,
  };
}

/**
 * Returns a one-line notice string if a newer version is available, else null.
 * Safe to call from any command; never throws.
 */
export async function checkForUpdate(): Promise<string | null> {
  if (disabled()) return null;
  try {
    const latest = await resolveLatest();
    if (latest && isNewer(latest, VERSION)) {
      return formatNotice(latest);
    }
  } catch {
    /* never surface errors from the update check */
  }
  return null;
}

export function formatNotice(latest: string): string {
  const dim = "\x1b[2m";
  const bold = "\x1b[1m";
  const cyan = "\x1b[36m";
  const reset = "\x1b[0m";
  return (
    `${dim}┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄${reset}\n` +
    `${bold}Mercury ${latest} is available${reset} ${dim}(you have ${VERSION})${reset}\n` +
    `Update:  ${cyan}${INSTALL_CMD}${reset}\n` +
    `${dim}Silence with MERCURY_NO_UPDATE_CHECK=1${reset}`
  );
}

/**
 * Run the update check and print the notice to stderr (so it never pollutes
 * stdout that skills may parse). Awaitable but bounded by FETCH_TIMEOUT_MS.
 */
export async function maybePrintUpdateNotice(): Promise<void> {
  const notice = await checkForUpdate();
  if (notice) console.error("\n" + notice);
}
