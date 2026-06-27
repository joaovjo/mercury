/**
 * Unit tests for outreach/core.ts (issue #11) — pure functions only, no DB/IO.
 */
import { describe, expect, test } from "bun:test";
import {
  canTransition,
  decideChannel,
  isBlocking,
  dueAction,
  nextActionDue,
  blockUntil,
  addMonths,
  addDays,
  daysBetween,
  BLOCKING_STATES,
  TERMINAL_STATES,
  type OutreachState,
  type AttemptLike,
} from "./core.ts";
import { DEFAULT_OUTREACH_CONFIG } from "../paths.ts";

// ── canTransition ─────────────────────────────────────────────────────────────

describe("canTransition — legal transitions", () => {
  test("queued → invited", () => expect(canTransition("queued", "invited")).toBe(true));
  test("queued → do_not_contact", () =>
    expect(canTransition("queued", "do_not_contact")).toBe(true));
  test("invited → accepted", () => expect(canTransition("invited", "accepted")).toBe(true));
  test("invited → invite_ignored", () =>
    expect(canTransition("invited", "invite_ignored")).toBe(true));
  test("invited → engaged (reply before accept)", () =>
    expect(canTransition("invited", "engaged")).toBe(true));
  test("accepted → followed_up", () =>
    expect(canTransition("accepted", "followed_up")).toBe(true));
  test("accepted → engaged", () => expect(canTransition("accepted", "engaged")).toBe(true));
  test("accepted → unresponsive", () =>
    expect(canTransition("accepted", "unresponsive")).toBe(true));
  test("followed_up → unresponsive", () =>
    expect(canTransition("followed_up", "unresponsive")).toBe(true));
  test("followed_up → engaged", () =>
    expect(canTransition("followed_up", "engaged")).toBe(true));
  test("unresponsive → engaged (late reply rescues)", () =>
    expect(canTransition("unresponsive", "engaged")).toBe(true));
  test("invite_ignored → invited (re-eligible after cooldown)", () =>
    expect(canTransition("invite_ignored", "invited")).toBe(true));
  test("do_not_contact → queued (manual unblock)", () =>
    expect(canTransition("do_not_contact", "queued")).toBe(true));
  test("do_not_contact → invited (manual unblock)", () =>
    expect(canTransition("do_not_contact", "invited")).toBe(true));
  test("engaged → do_not_contact", () =>
    expect(canTransition("engaged", "do_not_contact")).toBe(true));
});

describe("canTransition — illegal transitions", () => {
  test("queued → engaged (must go through invited first)", () =>
    expect(canTransition("queued", "engaged")).toBe(false));
  test("queued → accepted", () => expect(canTransition("queued", "accepted")).toBe(false));
  test("queued → unresponsive", () =>
    expect(canTransition("queued", "unresponsive")).toBe(false));
  test("invite_ignored → accepted (must re-invite first)", () =>
    expect(canTransition("invite_ignored", "accepted")).toBe(false));
  test("invite_ignored → engaged", () =>
    expect(canTransition("invite_ignored", "engaged")).toBe(false));
  test("engaged → invited (can't re-invite an engaged contact)", () =>
    expect(canTransition("engaged", "invited")).toBe(false));
  test("engaged → accepted", () => expect(canTransition("engaged", "accepted")).toBe(false));
  test("unresponsive → invited", () =>
    expect(canTransition("unresponsive", "invited")).toBe(false));
  test("followed_up → invited", () =>
    expect(canTransition("followed_up", "invited")).toBe(false));
  test("accepted → invite_ignored", () =>
    expect(canTransition("accepted", "invite_ignored")).toBe(false));
});

// ── decideChannel ─────────────────────────────────────────────────────────────

describe("decideChannel", () => {
  const base = { openProfile: false, highValue: false, creditsRemaining: 10, reserveFloor: 1 };

  test("1st degree → free direct message", () => {
    const r = decideChannel({ ...base, degree: "1st" });
    expect(r.channel).toBe("message");
    expect(r.costCredits).toBe(0);
  });

  test("2nd degree → free connect_note", () => {
    const r = decideChannel({ ...base, degree: "2nd" });
    expect(r.channel).toBe("connect_note");
    expect(r.costCredits).toBe(0);
  });

  test("3rd+ open profile → free inmail", () => {
    const r = decideChannel({ ...base, degree: "3rd", openProfile: true });
    expect(r.channel).toBe("inmail");
    expect(r.costCredits).toBe(0);
  });

  test("out-of-network open profile → free inmail", () => {
    const r = decideChannel({ ...base, degree: "out", openProfile: true });
    expect(r.channel).toBe("inmail");
    expect(r.costCredits).toBe(0);
  });

  test("3rd+ high-value with budget above reserve → inmail cost 1", () => {
    const r = decideChannel({
      degree: "3rd",
      openProfile: false,
      highValue: true,
      creditsRemaining: 5,
      reserveFloor: 1,
    });
    expect(r.channel).toBe("inmail");
    expect(r.costCredits).toBe(1);
  });

  test("3rd+ high-value at reserve floor → queue (no credit spent)", () => {
    const r = decideChannel({
      degree: "3rd",
      openProfile: false,
      highValue: true,
      creditsRemaining: 1,
      reserveFloor: 1,
    });
    expect(r.channel).toBe("queue");
    expect(r.costCredits).toBe(0);
  });

  test("3rd+ high-value below reserve floor → queue", () => {
    const r = decideChannel({
      degree: "3rd",
      openProfile: false,
      highValue: true,
      creditsRemaining: 0,
      reserveFloor: 1,
    });
    expect(r.channel).toBe("queue");
    expect(r.costCredits).toBe(0);
  });

  test("3rd+ not high-value → intro (no credit spent)", () => {
    const r = decideChannel({
      degree: "3rd",
      openProfile: false,
      highValue: false,
      creditsRemaining: 10,
      reserveFloor: 1,
    });
    expect(r.channel).toBe("intro");
    expect(r.costCredits).toBe(0);
  });

  test("out-of-network not high-value → intro", () => {
    const r = decideChannel({
      degree: "out",
      openProfile: false,
      highValue: false,
      creditsRemaining: 10,
      reserveFloor: 1,
    });
    expect(r.channel).toBe("intro");
    expect(r.costCredits).toBe(0);
  });
});

// ── isBlocking ────────────────────────────────────────────────────────────────

describe("isBlocking", () => {
  const now = "2025-06-01T12:00:00.000Z";

  function attempt(
    state: OutreachState,
    block_until: string | null,
  ): AttemptLike {
    return { state, sent_at: null, first_msg_at: null, followed_up_at: null, block_until };
  }

  test("blocking state within cooldown → true", () => {
    const future = addDays(now, 30);
    expect(isBlocking(attempt("invite_ignored", future), now)).toBe(true);
  });

  test("blocking state past block_until → false (cooldown expired)", () => {
    const past = addDays(now, -1);
    expect(isBlocking(attempt("invite_ignored", past), now)).toBe(false);
  });

  test("blocking state with null block_until → true (permanent block)", () => {
    expect(isBlocking(attempt("do_not_contact", null), now)).toBe(true);
  });

  test("unresponsive within cooldown → true", () => {
    const future = addDays(now, 60);
    expect(isBlocking(attempt("unresponsive", future), now)).toBe(true);
  });

  test("unresponsive past cooldown → false", () => {
    const past = addDays(now, -1);
    expect(isBlocking(attempt("unresponsive", past), now)).toBe(false);
  });

  test("non-blocking state (invited) → false", () => {
    expect(isBlocking(attempt("invited", null), now)).toBe(false);
  });

  test("non-blocking state (accepted) → false", () => {
    expect(isBlocking(attempt("accepted", null), now)).toBe(false);
  });

  test("non-blocking state (engaged) → false", () => {
    expect(isBlocking(attempt("engaged", null), now)).toBe(false);
  });

  test("non-blocking state (queued) → false", () => {
    expect(isBlocking(attempt("queued", null), now)).toBe(false);
  });

  test("BLOCKING_STATES set contains invite_ignored, unresponsive, do_not_contact", () => {
    expect(BLOCKING_STATES.has("invite_ignored")).toBe(true);
    expect(BLOCKING_STATES.has("unresponsive")).toBe(true);
    expect(BLOCKING_STATES.has("do_not_contact")).toBe(true);
    expect(BLOCKING_STATES.has("engaged")).toBe(false);
    expect(BLOCKING_STATES.has("invited")).toBe(false);
  });
});

// ── dueAction ─────────────────────────────────────────────────────────────────

describe("dueAction", () => {
  // DEFAULT_OUTREACH_CONFIG: inviteWithdrawDays=7, followupAfterDays=4, followupGraceDays=7
  const cfg = DEFAULT_OUTREACH_CONFIG;
  const BASE = "2025-06-01T12:00:00.000Z";

  function attempt(
    state: OutreachState,
    overrides: Partial<AttemptLike> = {},
  ): AttemptLike {
    return {
      state,
      sent_at: null,
      first_msg_at: null,
      followed_up_at: null,
      block_until: null,
      ...overrides,
    };
  }

  // invited → withdraw after inviteWithdrawDays (7)
  test("invited: no action before threshold (6 days)", () => {
    const sent_at = addDays(BASE, -6);
    const now = BASE;
    expect(dueAction(attempt("invited", { sent_at }), cfg, now)).toBeNull();
  });

  test("invited: withdraw due exactly at threshold (7 days)", () => {
    const sent_at = addDays(BASE, -7);
    const now = BASE;
    const action = dueAction(attempt("invited", { sent_at }), cfg, now);
    expect(action?.kind).toBe("withdraw");
  });

  test("invited: withdraw due past threshold (10 days)", () => {
    const sent_at = addDays(BASE, -10);
    const now = BASE;
    const action = dueAction(attempt("invited", { sent_at }), cfg, now);
    expect(action?.kind).toBe("withdraw");
    expect(action?.reason).toContain("10d");
  });

  test("invited: null sent_at → no action (NaN guard)", () => {
    expect(dueAction(attempt("invited", { sent_at: null }), cfg, BASE)).toBeNull();
  });

  // accepted → followup after followupAfterDays (4)
  test("accepted: no action before threshold (3 days)", () => {
    const first_msg_at = addDays(BASE, -3);
    const now = BASE;
    expect(dueAction(attempt("accepted", { first_msg_at }), cfg, now)).toBeNull();
  });

  test("accepted: followup due exactly at threshold (4 days)", () => {
    const first_msg_at = addDays(BASE, -4);
    const now = BASE;
    const action = dueAction(attempt("accepted", { first_msg_at }), cfg, now);
    expect(action?.kind).toBe("followup");
  });

  test("accepted: followup due past threshold (6 days)", () => {
    const first_msg_at = addDays(BASE, -6);
    const now = BASE;
    const action = dueAction(attempt("accepted", { first_msg_at }), cfg, now);
    expect(action?.kind).toBe("followup");
    expect(action?.reason).toContain("6d");
  });

  test("accepted: null first_msg_at → no action", () => {
    expect(dueAction(attempt("accepted", { first_msg_at: null }), cfg, BASE)).toBeNull();
  });

  // followed_up → close after followupGraceDays (7)
  test("followed_up: no action before threshold (6 days)", () => {
    const followed_up_at = addDays(BASE, -6);
    const now = BASE;
    expect(dueAction(attempt("followed_up", { followed_up_at }), cfg, now)).toBeNull();
  });

  test("followed_up: close due exactly at threshold (7 days)", () => {
    const followed_up_at = addDays(BASE, -7);
    const now = BASE;
    const action = dueAction(attempt("followed_up", { followed_up_at }), cfg, now);
    expect(action?.kind).toBe("close");
  });

  test("followed_up: close due past threshold (9 days)", () => {
    const followed_up_at = addDays(BASE, -9);
    const now = BASE;
    const action = dueAction(attempt("followed_up", { followed_up_at }), cfg, now);
    expect(action?.kind).toBe("close");
    expect(action?.reason).toContain("9d");
  });

  // terminal / other states → null
  test("terminal state (engaged) → null", () => {
    expect(dueAction(attempt("engaged"), cfg, BASE)).toBeNull();
  });

  test("terminal state (invite_ignored) → null", () => {
    expect(dueAction(attempt("invite_ignored"), cfg, BASE)).toBeNull();
  });

  test("terminal state (unresponsive) → null", () => {
    expect(dueAction(attempt("unresponsive"), cfg, BASE)).toBeNull();
  });

  test("queued state → null", () => {
    expect(dueAction(attempt("queued"), cfg, BASE)).toBeNull();
  });
});

// ── nextActionDue ─────────────────────────────────────────────────────────────

describe("nextActionDue", () => {
  const cfg = DEFAULT_OUTREACH_CONFIG;
  const BASE = "2025-06-01T12:00:00.000Z";

  function attempt(
    state: OutreachState,
    overrides: Partial<AttemptLike> = {},
  ): AttemptLike {
    return {
      state,
      sent_at: null,
      first_msg_at: null,
      followed_up_at: null,
      block_until: null,
      ...overrides,
    };
  }

  test("invited: due = sent_at + inviteWithdrawDays (7)", () => {
    const sent_at = BASE;
    const expected = addDays(BASE, 7);
    expect(nextActionDue(attempt("invited", { sent_at }), cfg)).toBe(expected);
  });

  test("invited: null sent_at → null", () => {
    expect(nextActionDue(attempt("invited", { sent_at: null }), cfg)).toBeNull();
  });

  test("accepted: due = first_msg_at + followupAfterDays (4)", () => {
    const first_msg_at = BASE;
    const expected = addDays(BASE, 4);
    expect(nextActionDue(attempt("accepted", { first_msg_at }), cfg)).toBe(expected);
  });

  test("accepted: null first_msg_at → null", () => {
    expect(nextActionDue(attempt("accepted", { first_msg_at: null }), cfg)).toBeNull();
  });

  test("followed_up: due = followed_up_at + followupGraceDays (7)", () => {
    const followed_up_at = BASE;
    const expected = addDays(BASE, 7);
    expect(nextActionDue(attempt("followed_up", { followed_up_at }), cfg)).toBe(expected);
  });

  test("followed_up: null followed_up_at → null", () => {
    expect(nextActionDue(attempt("followed_up", { followed_up_at: null }), cfg)).toBeNull();
  });

  test("terminal state (engaged) → null", () => {
    expect(nextActionDue(attempt("engaged"), cfg)).toBeNull();
  });

  test("queued → null", () => {
    expect(nextActionDue(attempt("queued"), cfg)).toBeNull();
  });
});

// ── blockUntil ────────────────────────────────────────────────────────────────

describe("blockUntil", () => {
  const BASE = "2025-06-01T12:00:00.000Z";

  test("permanent block → null", () => {
    const cfg = { ...DEFAULT_OUTREACH_CONFIG, companyBlock: "permanent" as const };
    expect(blockUntil(cfg, BASE)).toBeNull();
  });

  test("cooldown block → addMonths(now, companyBlockCooldownMonths)", () => {
    const cfg = {
      ...DEFAULT_OUTREACH_CONFIG,
      companyBlock: "cooldown" as const,
      companyBlockCooldownMonths: 9,
    };
    const result = blockUntil(cfg, BASE);
    const expected = addMonths(BASE, 9);
    expect(result).toBe(expected);
  });

  test("cooldown 3 months", () => {
    const cfg = {
      ...DEFAULT_OUTREACH_CONFIG,
      companyBlock: "cooldown" as const,
      companyBlockCooldownMonths: 3,
    };
    const result = blockUntil(cfg, BASE);
    const expected = addMonths(BASE, 3);
    expect(result).toBe(expected);
  });
});

// ── addMonths / addDays / daysBetween ─────────────────────────────────────────

describe("addMonths", () => {
  test("adds 1 month", () => {
    const result = addMonths("2025-01-15T00:00:00.000Z", 1);
    expect(result.startsWith("2025-02-15")).toBe(true);
  });

  test("adds 9 months", () => {
    const result = addMonths("2025-01-01T00:00:00.000Z", 9);
    expect(result.startsWith("2025-10-01")).toBe(true);
  });

  test("crosses year boundary", () => {
    const result = addMonths("2025-06-01T00:00:00.000Z", 9);
    expect(result.startsWith("2026-03-01")).toBe(true);
  });

  test("returns ISO string", () => {
    const result = addMonths("2025-06-01T12:00:00.000Z", 1);
    expect(() => new Date(result)).not.toThrow();
    expect(new Date(result).toISOString()).toBe(result);
  });
});

describe("addDays", () => {
  test("adds 7 days", () => {
    const result = addDays("2025-06-01T12:00:00.000Z", 7);
    expect(result).toBe("2025-06-08T12:00:00.000Z");
  });

  test("adds 0 days → same timestamp", () => {
    const iso = "2025-06-01T12:00:00.000Z";
    expect(addDays(iso, 0)).toBe(iso);
  });

  test("subtracts days (negative)", () => {
    const result = addDays("2025-06-08T12:00:00.000Z", -7);
    expect(result).toBe("2025-06-01T12:00:00.000Z");
  });

  test("crosses month boundary", () => {
    const result = addDays("2025-01-28T00:00:00.000Z", 5);
    expect(result.startsWith("2025-02-02")).toBe(true);
  });
});

describe("daysBetween", () => {
  test("exactly 7 days", () => {
    const from = "2025-06-01T12:00:00.000Z";
    const to = "2025-06-08T12:00:00.000Z";
    expect(daysBetween(from, to)).toBe(7);
  });

  test("0 days (same timestamp)", () => {
    const iso = "2025-06-01T12:00:00.000Z";
    expect(daysBetween(iso, iso)).toBe(0);
  });

  test("fractional days", () => {
    const from = "2025-06-01T00:00:00.000Z";
    const to = "2025-06-01T12:00:00.000Z";
    expect(daysBetween(from, to)).toBe(0.5);
  });

  test("null from → NaN", () => {
    expect(daysBetween(null, "2025-06-01T00:00:00.000Z")).toBeNaN();
  });

  test("undefined from → NaN", () => {
    expect(daysBetween(undefined, "2025-06-01T00:00:00.000Z")).toBeNaN();
  });

  test("negative when to < from", () => {
    const from = "2025-06-08T12:00:00.000Z";
    const to = "2025-06-01T12:00:00.000Z";
    expect(daysBetween(from, to)).toBe(-7);
  });
});

// ── TERMINAL_STATES ───────────────────────────────────────────────────────────

describe("TERMINAL_STATES", () => {
  test("contains invite_ignored, unresponsive, engaged, do_not_contact", () => {
    expect(TERMINAL_STATES.has("invite_ignored")).toBe(true);
    expect(TERMINAL_STATES.has("unresponsive")).toBe(true);
    expect(TERMINAL_STATES.has("engaged")).toBe(true);
    expect(TERMINAL_STATES.has("do_not_contact")).toBe(true);
  });

  test("does not contain active states", () => {
    expect(TERMINAL_STATES.has("queued")).toBe(false);
    expect(TERMINAL_STATES.has("invited")).toBe(false);
    expect(TERMINAL_STATES.has("accepted")).toBe(false);
    expect(TERMINAL_STATES.has("followed_up")).toBe(false);
  });
});
