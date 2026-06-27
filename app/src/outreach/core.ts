/**
 * Core outreach logic (issue #11) — PURE functions, no DB/IO.
 *
 * Everything here is deterministic and unit-tested in isolation: the lifecycle
 * state machine, company-scoped block evaluation, follow-up due-date math, and
 * the cost-aware channel decision. The store layer (store.ts) and CLI wire
 * these into SQLite and LinkedIn.
 */
import type { OutreachConfig } from "../paths.ts";

/** Lifecycle states for an outreach attempt (issue #11 §2). */
export type OutreachState =
  | "queued" // identified, nothing sent
  | "invited" // invite + note sent, awaiting accept
  | "invite_ignored" // no accept after threshold → withdraw + block
  | "accepted" // accepted; first message sent; awaiting reply
  | "followed_up" // gentle nudge sent
  | "unresponsive" // followed up, no reply → block
  | "engaged" // they replied (success)
  | "do_not_contact"; // manual block (still company-scoped)

/** States that constitute a company-scoped block (when within cooldown). */
export const BLOCKING_STATES: ReadonlySet<OutreachState> = new Set([
  "invite_ignored",
  "unresponsive",
  "do_not_contact",
]);

/** Terminal states (no further automation). */
export const TERMINAL_STATES: ReadonlySet<OutreachState> = new Set([
  "invite_ignored",
  "unresponsive",
  "engaged",
  "do_not_contact",
]);

/** Allowed transitions. A reply jumps to `engaged` from any active state. */
const TRANSITIONS: Record<OutreachState, ReadonlySet<OutreachState>> = {
  queued: new Set(["invited", "do_not_contact"]),
  invited: new Set(["invite_ignored", "accepted", "engaged", "do_not_contact"]),
  invite_ignored: new Set(["invited"]), // re-eligible after cooldown → re-invite
  accepted: new Set(["followed_up", "engaged", "unresponsive", "do_not_contact"]),
  followed_up: new Set(["unresponsive", "engaged", "do_not_contact"]),
  unresponsive: new Set(["engaged"]), // a late reply still rescues it
  engaged: new Set(["do_not_contact"]),
  do_not_contact: new Set(["queued", "invited"]), // manual unblock path
};

export function canTransition(from: OutreachState, to: OutreachState): boolean {
  return TRANSITIONS[from]?.has(to) ?? false;
}

/** A LinkedIn connection degree as surfaced by search/profile tools. */
export type Degree = "1st" | "2nd" | "3rd" | "out"; // out = 3rd+ / out of network

export type Channel = "message" | "connect_note" | "inmail";

export interface ChannelDecision {
  channel: Channel | "queue" | "intro";
  costCredits: 0 | 1;
  /** Human-readable rationale for surfacing to the user. */
  rationale: string;
}

/**
 * Cost-aware channel decision (issue #11 §5b). Prefers free paths; only spends
 * an InMail credit for a high-value 3rd+ target with no warmer path AND when
 * the budget stays at/above the reserve floor.
 *
 * Priority:
 *   1st degree            → free direct message
 *   2nd degree            → free connect + note (invite budget, not InMail)
 *   3rd+ Open Profile     → free InMail
 *   3rd+ high-value       → InMail = 1 credit (if creditsRemaining - reserve >= 1)
 *   else                  → seek intro / queue
 */
export function decideChannel(opts: {
  degree: Degree;
  openProfile: boolean;
  highValue: boolean;
  creditsRemaining: number;
  reserveFloor: number;
}): ChannelDecision {
  const { degree, openProfile, highValue, creditsRemaining, reserveFloor } = opts;

  if (degree === "1st")
    return { channel: "message", costCredits: 0, rationale: "1st-degree: free direct message" };

  if (degree === "2nd")
    return {
      channel: "connect_note",
      costCredits: 0,
      rationale: "2nd-degree: free connection request + note (invite budget)",
    };

  // 3rd+ / out of network
  if (openProfile)
    return { channel: "inmail", costCredits: 0, rationale: "Open Profile: free InMail" };

  const spendable = creditsRemaining - reserveFloor;
  if (highValue && spendable >= 1)
    return {
      channel: "inmail",
      costCredits: 1,
      rationale: `High-value, no warmer path: spend 1 InMail credit (${spendable} above reserve)`,
    };

  if (highValue)
    return {
      channel: "queue",
      costCredits: 0,
      rationale: `High-value but InMail budget at reserve floor (${creditsRemaining}/${reserveFloor}) — queue for fresh credits`,
    };

  return {
    channel: "intro",
    costCredits: 0,
    rationale: "3rd-degree, not high-value: seek a mutual-connection intro instead of spending a credit",
  };
}

/** Parse an ISO date; returns ms since epoch or NaN. */
function ts(iso: string | null | undefined): number {
  if (!iso) return NaN;
  return new Date(iso).getTime();
}

const DAY_MS = 86_400_000;

export function daysBetween(fromIso: string | null | undefined, nowIso: string): number {
  const a = ts(fromIso);
  const b = ts(nowIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return (b - a) / DAY_MS;
}

/** Add N months to an ISO date, returning ISO. Used for cooldown expiry. */
export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export function addDays(iso: string, days: number): string {
  return new Date(ts(iso) + days * DAY_MS).toISOString();
}

/** Minimal attempt shape the pure evaluators need. */
export interface AttemptLike {
  state: OutreachState;
  sent_at: string | null;
  first_msg_at: string | null;
  followed_up_at: string | null;
  block_until: string | null;
}

/**
 * Is this attempt currently blocking new outreach for its company?
 * A blocking-state attempt blocks until `block_until` (cooldown) passes; a
 * NULL block_until means a permanent block.
 */
export function isBlocking(a: AttemptLike, nowIso: string): boolean {
  if (!BLOCKING_STATES.has(a.state)) return false;
  if (!a.block_until) return true; // permanent
  return ts(a.block_until) > ts(nowIso); // still within cooldown
}

export type DueAction =
  | { kind: "withdraw"; reason: string } // invite ignored → withdraw + block
  | { kind: "followup"; reason: string } // accepted, no reply → nudge
  | { kind: "close"; reason: string }; // followup exhausted → unresponsive + block

/**
 * Compute the due action for an attempt per the three cadence flows (§3),
 * or null if nothing is due yet. `replied` short-circuits everything upstream
 * (the caller marks engaged on reply detection before calling this).
 */
export function dueAction(
  a: AttemptLike,
  cfg: OutreachConfig,
  nowIso: string,
): DueAction | null {
  switch (a.state) {
    case "invited": {
      const d = daysBetween(a.sent_at, nowIso);
      if (!Number.isNaN(d) && d >= cfg.inviteWithdrawDays)
        return {
          kind: "withdraw",
          reason: `invite unaccepted for ${Math.floor(d)}d (≥ ${cfg.inviteWithdrawDays}d)`,
        };
      return null;
    }
    case "accepted": {
      const d = daysBetween(a.first_msg_at, nowIso);
      if (!Number.isNaN(d) && d >= cfg.followupAfterDays)
        return {
          kind: "followup",
          reason: `no reply ${Math.floor(d)}d after first message (≥ ${cfg.followupAfterDays}d)`,
        };
      return null;
    }
    case "followed_up": {
      const d = daysBetween(a.followed_up_at, nowIso);
      if (!Number.isNaN(d) && d >= cfg.followupGraceDays)
        return {
          kind: "close",
          reason: `no reply ${Math.floor(d)}d after follow-up (≥ ${cfg.followupGraceDays}d)`,
        };
      return null;
    }
    default:
      return null;
  }
}

/**
 * The `next_action_due` timestamp to persist for an attempt given its current
 * state, so the due-queue can be a cheap indexed range scan rather than
 * recomputing per row. Returns null for states with no pending automation.
 */
export function nextActionDue(a: AttemptLike, cfg: OutreachConfig): string | null {
  switch (a.state) {
    case "invited":
      return a.sent_at ? addDays(a.sent_at, cfg.inviteWithdrawDays) : null;
    case "accepted":
      return a.first_msg_at ? addDays(a.first_msg_at, cfg.followupAfterDays) : null;
    case "followed_up":
      return a.followed_up_at ? addDays(a.followed_up_at, cfg.followupGraceDays) : null;
    default:
      return null;
  }
}

/**
 * Compute the cooldown expiry (`block_until`) when an attempt enters a blocking
 * state. Returns null for a permanent block.
 */
export function blockUntil(cfg: OutreachConfig, nowIso: string): string | null {
  if (cfg.companyBlock === "permanent") return null;
  return addMonths(nowIso, cfg.companyBlockCooldownMonths);
}
