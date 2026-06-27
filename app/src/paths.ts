import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

/**
 * Central path resolution for Mercury.
 * Everything personal lives under ~/.mercury/ (overridable via MERCURY_HOME).
 */
export const MERCURY_HOME = process.env.MERCURY_HOME ?? join(homedir(), ".mercury");

export const paths = {
  home: MERCURY_HOME,
  db: join(MERCURY_HOME, "mercury.db"),
  config: join(MERCURY_HOME, "config.json"),
  /** Lockfile written by a running dashboard so the CLI can notify it of DB changes. */
  serverLock: join(MERCURY_HOME, "dashboard.lock"),
  /** Tailored resume artifacts default location (per-project override possible later). */
  artifacts: join(MERCURY_HOME, "artifacts"),
  /** Cache file for the once-per-interval "newer version available" check. */
  updateCache: join(MERCURY_HOME, "update-check.json"),
};

/** Ensure ~/.mercury/ and its subdirs exist. Safe to call repeatedly. */
export function ensureHome(): void {
  for (const dir of [paths.home, paths.artifacts]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

export interface MercuryConfig {
  /** LinkedIn username of the candidate (single-profile assumption for v1). */
  username?: string;
  displayName?: string;
  /** Default ACP provider id. */
  provider?: "opencode" | "claude-code";
  /** Optional explicit LinkedIn MCP connection command. */
  linkedinMcpCommand?: string[];
  /** Outreach relationship-memory settings (issue #11). Deep-partial: any
   *  omitted field falls back to DEFAULT_OUTREACH_CONFIG via loadOutreachConfig. */
  outreach?: Partial<Omit<OutreachConfig, "inmail" | "invites">> & {
    inmail?: Partial<OutreachConfig["inmail"]>;
    invites?: Partial<OutreachConfig["invites"]>;
  };
}

/**
 * Outreach tracking config (issue #11). Mirrors the spec's `[outreach]` TOML
 * block, but lives as nested JSON in config.json to match Mercury's existing
 * single-config-file convention (we don't pull in a TOML parser for the binary).
 */
export interface OutreachConfig {
  /** Days after an invite with no accept before it's withdraw-eligible. */
  inviteWithdrawDays: number;
  /** Days after first post-accept message with no reply before a nudge is due. */
  followupAfterDays: number;
  /** Days after a nudge with no reply before marking unresponsive + block. */
  followupGraceDays: number;
  /** Company-scoped block policy after a terminal-non-engaged outcome. */
  companyBlock: "permanent" | "cooldown";
  /** Cooldown length in months when companyBlock = "cooldown". */
  companyBlockCooldownMonths: number;
  /** Never auto-send: skills draft and ask for consent. */
  requireSendConsent: boolean;
  inmail: {
    plan: "career" | "business" | "recruiter_lite" | "sales_navigator" | "none";
    monthlyAllotment: number;
    rolloverCap: number;
    cycleResetDay: number;
    /** Never spend InMail credits below this floor. */
    reserveFloor: number;
  };
  invites: {
    /** Weekly connection-invite soft cap (separate budget from InMail). */
    weeklyLimit: number;
  };
}

/** Defaults per issue #11 §6 (cooldown chosen as the default block policy). */
export const DEFAULT_OUTREACH_CONFIG: OutreachConfig = {
  inviteWithdrawDays: 7,
  followupAfterDays: 4,
  followupGraceDays: 7,
  companyBlock: "cooldown",
  companyBlockCooldownMonths: 9,
  requireSendConsent: true,
  inmail: {
    plan: "career",
    monthlyAllotment: 5,
    rolloverCap: 15,
    cycleResetDay: 1,
    reserveFloor: 1,
  },
  invites: {
    weeklyLimit: 100,
  },
};

export function loadConfig(): MercuryConfig {
  if (!existsSync(paths.config)) return {};
  try {
    return JSON.parse(require("node:fs").readFileSync(paths.config, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Resolve the effective outreach config: saved values deep-merged over defaults
 * so the core lib always receives a complete, well-typed config object.
 */
export function loadOutreachConfig(): OutreachConfig {
  const saved = loadConfig().outreach ?? {};
  const d = DEFAULT_OUTREACH_CONFIG;
  return {
    ...d,
    ...saved,
    inmail: { ...d.inmail, ...(saved.inmail ?? {}) },
    invites: { ...d.invites, ...(saved.invites ?? {}) },
  };
}

export function saveConfig(cfg: MercuryConfig): void {
  ensureHome();
  require("node:fs").writeFileSync(paths.config, JSON.stringify(cfg, null, 2));
}
