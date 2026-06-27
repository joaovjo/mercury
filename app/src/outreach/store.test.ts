/**
 * Integration tests for outreach/store.ts (issue #11).
 * Uses an in-memory SQLite database (new Database(":memory:")) with SCHEMA_SQL
 * applied, bypassing the memoized db() singleton entirely. Every store function
 * accepts an explicit `d` argument for exactly this purpose.
 */
import { describe, expect, test, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { SCHEMA_SQL } from "../db/schema.ts";
import { DEFAULT_OUTREACH_CONFIG, type OutreachConfig } from "../paths.ts";
import { addDays } from "./core.ts";
import {
  logAttempt,
  checkBlocked,
  transition,
  dueAttempts,
  blockedForCompany,
  getBudget,
  setBudget,
  spendCredit,
  refundCredit,
} from "./store.ts";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Create a fresh in-memory DB with the full Mercury schema + seeded budget. */
function makeDb(): Database {
  const d = new Database(":memory:");
  d.exec("PRAGMA journal_mode = WAL;");
  d.exec("PRAGMA foreign_keys = ON;");
  d.exec(SCHEMA_SQL);
  // Seed the singleton budget row (id=1) — mirrors seedOutreachBudget in db/index.ts
  d.exec(
    `INSERT INTO outreach_budget (id, plan, inmail_monthly_allotment,
       inmail_rollover_cap, cycle_reset_day, credits_remaining,
       credits_used_this_cycle, reserve_floor)
     VALUES (1, 'career', 5, 15, 1, 10, 0, 1)`,
  );
  return d;
}

const CFG: OutreachConfig = DEFAULT_OUTREACH_CONFIG;
const NOW = "2025-06-01T12:00:00.000Z";

// ── logAttempt ────────────────────────────────────────────────────────────────

describe("logAttempt", () => {
  let d: Database;
  beforeEach(() => { d = makeDb(); });

  test("connect_note → state=invited, sent_at set, next_action_due set", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    expect(a.state).toBe("invited");
    expect(a.sent_at).toBe(NOW);
    // next_action_due = sent_at + inviteWithdrawDays (7)
    expect(a.next_action_due).toBe(addDays(NOW, CFG.inviteWithdrawDays));
  });

  test("queued state → sent_at is null, next_action_due is null", () => {
    const a = logAttempt(
      {
        username: "bob",
        companyUrn: "urn:li:company:2",
        channel: "connect_note",
        state: "queued",
      },
      d, CFG, NOW,
    );
    expect(a.state).toBe("queued");
    expect(a.sent_at).toBeNull();
    expect(a.next_action_due).toBeNull();
  });

  test("inmail with cost_credits=1 → spends a credit and sets refund_eligible_until", () => {
    const before = getBudget(d).credits_remaining;
    const a = logAttempt(
      {
        username: "carol",
        companyUrn: "urn:li:company:3",
        channel: "inmail",
        costCredits: 1,
      },
      d, CFG, NOW,
    );
    expect(a.cost_credits).toBe(1);
    expect(a.refund_eligible_until).not.toBeNull();
    // refund window is 90 days
    const refundDate = new Date(a.refund_eligible_until!);
    const sentDate = new Date(NOW);
    const diffDays = (refundDate.getTime() - sentDate.getTime()) / 86_400_000;
    expect(diffDays).toBe(90);
    // credit was spent
    expect(getBudget(d).credits_remaining).toBe(before - 1);
  });

  test("inmail with cost_credits=0 → no credit spent, no refund window", () => {
    const before = getBudget(d).credits_remaining;
    const a = logAttempt(
      {
        username: "dave",
        companyUrn: "urn:li:company:4",
        channel: "inmail",
        costCredits: 0,
      },
      d, CFG, NOW,
    );
    expect(a.cost_credits).toBe(0);
    expect(a.refund_eligible_until).toBeNull();
    expect(getBudget(d).credits_remaining).toBe(before);
  });

  test("message channel → state=invited, sent_at set", () => {
    const a = logAttempt(
      { username: "eve", companyUrn: "urn:li:company:5", channel: "message" },
      d, CFG, NOW,
    );
    expect(a.state).toBe("invited");
    expect(a.sent_at).toBe(NOW);
  });
});

// ── checkBlocked ──────────────────────────────────────────────────────────────

describe("checkBlocked", () => {
  let d: Database;
  beforeEach(() => { d = makeDb(); });

  test("no attempts → not blocked", () => {
    const r = checkBlocked("alice", "urn:li:company:1", d, NOW);
    expect(r.blocked).toBe(false);
    expect(r.attempt).toBeUndefined();
  });

  test("active (invited) attempt → not blocked", () => {
    logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    const r = checkBlocked("alice", "urn:li:company:1", d, NOW);
    expect(r.blocked).toBe(false);
  });

  test("invite_ignored within cooldown → blocked", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    transition(a.id, "invite_ignored", { reason: "no response" }, d, CFG, NOW);
    const r = checkBlocked("alice", "urn:li:company:1", d, NOW);
    expect(r.blocked).toBe(true);
    expect(r.attempt?.state).toBe("invite_ignored");
  });

  test("invite_ignored for company A does NOT block for company B (per-company scoping)", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:A", channel: "connect_note" },
      d, CFG, NOW,
    );
    transition(a.id, "invite_ignored", { reason: "no response" }, d, CFG, NOW);

    // Same person, different company URN → should NOT be blocked
    const r = checkBlocked("alice", "urn:li:company:B", d, NOW);
    expect(r.blocked).toBe(false);
  });

  test("invite_ignored past cooldown → not blocked", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    transition(a.id, "invite_ignored", { reason: "no response" }, d, CFG, NOW);

    // Check far in the future (past the 9-month cooldown)
    const farFuture = addDays(NOW, 365);
    const r = checkBlocked("alice", "urn:li:company:1", d, farFuture);
    expect(r.blocked).toBe(false);
  });

  test("do_not_contact (permanent) → always blocked", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    const permanentCfg: OutreachConfig = { ...CFG, companyBlock: "permanent" };
    transition(a.id, "invite_ignored", { reason: "DNC" }, d, permanentCfg, NOW);

    // Even far in the future, permanent block stays
    const farFuture = addDays(NOW, 3650);
    const r = checkBlocked("alice", "urn:li:company:1", d, farFuture);
    expect(r.blocked).toBe(true);
  });

  test("different username for same company → not blocked", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    transition(a.id, "invite_ignored", { reason: "no response" }, d, CFG, NOW);

    // Different person, same company → not blocked
    const r = checkBlocked("bob", "urn:li:company:1", d, NOW);
    expect(r.blocked).toBe(false);
  });
});

// ── transition ────────────────────────────────────────────────────────────────

describe("transition", () => {
  let d: Database;
  beforeEach(() => { d = makeDb(); });

  test("illegal transition throws with descriptive message", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    // queued→engaged is illegal (must go through invited first)
    // But we logged as invited (default), so let's try invited→unresponsive (illegal)
    expect(() => transition(a.id, "unresponsive", {}, d, CFG, NOW)).toThrow(
      /illegal outreach transition/,
    );
  });

  test("transition to non-existent attempt throws", () => {
    expect(() => transition(9999, "accepted", {}, d, CFG, NOW)).toThrow(
      /not found/,
    );
  });

  test("idempotent: same state → no-op, returns existing row", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    const a2 = transition(a.id, "invited", {}, d, CFG, NOW);
    expect(a2.state).toBe("invited");
    expect(a2.id).toBe(a.id);
  });

  test("invited → accepted sets accepted_at and first_msg_at", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    const a2 = transition(a.id, "accepted", {}, d, CFG, NOW);
    expect(a2.state).toBe("accepted");
    expect(a2.accepted_at).toBe(NOW);
    expect(a2.first_msg_at).toBe(NOW);
    // next_action_due = first_msg_at + followupAfterDays (4)
    expect(a2.next_action_due).toBe(addDays(NOW, CFG.followupAfterDays));
  });

  test("accepted → followed_up sets followed_up_at", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    transition(a.id, "accepted", {}, d, CFG, NOW);
    const a2 = transition(a.id, "followed_up", {}, d, CFG, NOW);
    expect(a2.state).toBe("followed_up");
    expect(a2.followed_up_at).toBe(NOW);
    expect(a2.next_action_due).toBe(addDays(NOW, CFG.followupGraceDays));
  });

  test("invite_ignored sets block_until (cooldown)", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    const a2 = transition(a.id, "invite_ignored", { reason: "no response" }, d, CFG, NOW);
    expect(a2.state).toBe("invite_ignored");
    expect(a2.block_until).not.toBeNull();
    // block_until should be ~9 months from NOW
    const blockDate = new Date(a2.block_until!);
    const nowDate = new Date(NOW);
    const diffMonths =
      (blockDate.getFullYear() - nowDate.getFullYear()) * 12 +
      (blockDate.getMonth() - nowDate.getMonth());
    expect(diffMonths).toBe(CFG.companyBlockCooldownMonths);
  });

  test("engaged refunds InMail credit (cost_credits=1 within refund window)", () => {
    const before = getBudget(d).credits_remaining;
    const a = logAttempt(
      {
        username: "alice",
        companyUrn: "urn:li:company:1",
        channel: "inmail",
        costCredits: 1,
      },
      d, CFG, NOW,
    );
    // Credit was spent on logAttempt
    expect(getBudget(d).credits_remaining).toBe(before - 1);

    // Transition to engaged within refund window → credit refunded
    const a2 = transition(a.id, "engaged", {}, d, CFG, NOW);
    expect(a2.state).toBe("engaged");
    expect(a2.credit_refunded).toBe(1);
    expect(getBudget(d).credits_remaining).toBe(before);
  });

  test("engaged does NOT refund when cost_credits=0", () => {
    const before = getBudget(d).credits_remaining;
    const a = logAttempt(
      {
        username: "alice",
        companyUrn: "urn:li:company:1",
        channel: "connect_note",
        costCredits: 0,
      },
      d, CFG, NOW,
    );
    expect(getBudget(d).credits_remaining).toBe(before); // no spend
    const a2 = transition(a.id, "engaged", {}, d, CFG, NOW);
    expect(a2.credit_refunded).toBe(0);
    expect(getBudget(d).credits_remaining).toBe(before); // no change
  });

  test("engaged sets replied_at and closed_at", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    const a2 = transition(a.id, "engaged", {}, d, CFG, NOW);
    expect(a2.replied_at).toBe(NOW);
    expect(a2.closed_at).toBe(NOW);
  });

  test("invite_ignored sets withdrawn_at", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    const a2 = transition(a.id, "invite_ignored", {}, d, CFG, NOW);
    expect(a2.withdrawn_at).toBe(NOW);
  });
});

// ── dueAttempts ───────────────────────────────────────────────────────────────

describe("dueAttempts", () => {
  let d: Database;
  beforeEach(() => { d = makeDb(); });

  test("no attempts → empty array", () => {
    expect(dueAttempts(d, CFG, NOW)).toHaveLength(0);
  });

  test("invited past inviteWithdrawDays → withdraw action", () => {
    // sent 8 days ago (past 7-day threshold)
    const sentAt = addDays(NOW, -8);
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, sentAt,
    );
    // Manually update sent_at to be in the past (logAttempt uses nowIso as sent_at)
    // The attempt was logged with sentAt as nowIso, so sent_at = sentAt
    const results = dueAttempts(d, CFG, NOW);
    expect(results).toHaveLength(1);
    expect(results[0]!.action.kind).toBe("withdraw");
    expect(results[0]!.attempt.id).toBe(a.id);
  });

  test("invited not yet past threshold → not in due list", () => {
    // sent 3 days ago (under 7-day threshold)
    const sentAt = addDays(NOW, -3);
    logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, sentAt,
    );
    expect(dueAttempts(d, CFG, NOW)).toHaveLength(0);
  });

  test("accepted past followupAfterDays → followup action", () => {
    const sentAt = addDays(NOW, -10);
    const a = logAttempt(
      { username: "bob", companyUrn: "urn:li:company:2", channel: "connect_note" },
      d, CFG, sentAt,
    );
    // Transition to accepted 5 days ago (past 4-day threshold)
    const acceptedAt = addDays(NOW, -5);
    transition(a.id, "accepted", {}, d, CFG, acceptedAt);

    const results = dueAttempts(d, CFG, NOW);
    expect(results).toHaveLength(1);
    expect(results[0]!.action.kind).toBe("followup");
  });

  test("followed_up past followupGraceDays → close action", () => {
    const sentAt = addDays(NOW, -20);
    const a = logAttempt(
      { username: "carol", companyUrn: "urn:li:company:3", channel: "connect_note" },
      d, CFG, sentAt,
    );
    transition(a.id, "accepted", {}, d, CFG, addDays(NOW, -15));
    transition(a.id, "followed_up", {}, d, CFG, addDays(NOW, -8));

    const results = dueAttempts(d, CFG, NOW);
    expect(results).toHaveLength(1);
    expect(results[0]!.action.kind).toBe("close");
  });

  test("terminal states are excluded from due list", () => {
    const sentAt = addDays(NOW, -10);
    const a = logAttempt(
      { username: "dave", companyUrn: "urn:li:company:4", channel: "connect_note" },
      d, CFG, sentAt,
    );
    transition(a.id, "invite_ignored", {}, d, CFG, NOW);
    expect(dueAttempts(d, CFG, NOW)).toHaveLength(0);
  });
});

// ── blockedForCompany ─────────────────────────────────────────────────────────

describe("blockedForCompany", () => {
  let d: Database;
  beforeEach(() => { d = makeDb(); });

  test("no attempts → empty array", () => {
    expect(blockedForCompany("urn:li:company:1", d, NOW)).toHaveLength(0);
  });

  test("active attempt → not in blocked list", () => {
    logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    expect(blockedForCompany("urn:li:company:1", d, NOW)).toHaveLength(0);
  });

  test("invite_ignored within cooldown → in blocked list", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    transition(a.id, "invite_ignored", {}, d, CFG, NOW);
    const blocked = blockedForCompany("urn:li:company:1", d, NOW);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.person_username).toBe("alice");
  });

  test("multiple blocked people for same company", () => {
    const a1 = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    const a2 = logAttempt(
      { username: "bob", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    transition(a1.id, "invite_ignored", {}, d, CFG, NOW);
    transition(a2.id, "invite_ignored", {}, d, CFG, NOW);
    const blocked = blockedForCompany("urn:li:company:1", d, NOW);
    expect(blocked).toHaveLength(2);
  });

  test("invite_ignored past cooldown → not in blocked list", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:1", channel: "connect_note" },
      d, CFG, NOW,
    );
    transition(a.id, "invite_ignored", {}, d, CFG, NOW);
    const farFuture = addDays(NOW, 365);
    expect(blockedForCompany("urn:li:company:1", d, farFuture)).toHaveLength(0);
  });

  test("different company URN → not in blocked list", () => {
    const a = logAttempt(
      { username: "alice", companyUrn: "urn:li:company:A", channel: "connect_note" },
      d, CFG, NOW,
    );
    transition(a.id, "invite_ignored", {}, d, CFG, NOW);
    expect(blockedForCompany("urn:li:company:B", d, NOW)).toHaveLength(0);
  });
});

// ── budget: getBudget / setBudget / spendCredit / refundCredit ────────────────

describe("budget", () => {
  let d: Database;
  beforeEach(() => { d = makeDb(); });

  test("getBudget returns the seeded row", () => {
    const b = getBudget(d);
    expect(b.id).toBe(1);
    expect(b.credits_remaining).toBe(10);
    expect(b.reserve_floor).toBe(1);
  });

  test("spendCredit decrements credits_remaining by 1", () => {
    const before = getBudget(d).credits_remaining;
    spendCredit(d, NOW);
    expect(getBudget(d).credits_remaining).toBe(before - 1);
  });

  test("spendCredit clamps at 0 (never goes negative)", () => {
    // Drain to 0
    setBudget({ credits_remaining: 0 }, d, NOW);
    spendCredit(d, NOW);
    expect(getBudget(d).credits_remaining).toBe(0);
  });

  test("spendCredit increments credits_used_this_cycle", () => {
    const before = getBudget(d).credits_used_this_cycle;
    spendCredit(d, NOW);
    expect(getBudget(d).credits_used_this_cycle).toBe(before + 1);
  });

  test("refundCredit increments credits_remaining by 1", () => {
    spendCredit(d, NOW); // spend first
    const before = getBudget(d).credits_remaining;
    refundCredit(d, NOW);
    expect(getBudget(d).credits_remaining).toBe(before + 1);
  });

  test("refundCredit clamps at inmail_rollover_cap", () => {
    // Set credits_remaining to rollover_cap
    const b = getBudget(d);
    setBudget({ credits_remaining: b.inmail_rollover_cap }, d, NOW);
    refundCredit(d, NOW);
    expect(getBudget(d).credits_remaining).toBe(b.inmail_rollover_cap);
  });

  test("refundCredit decrements credits_used_this_cycle (clamps at 0)", () => {
    setBudget({ credits_used_this_cycle: 0 }, d, NOW);
    refundCredit(d, NOW);
    expect(getBudget(d).credits_used_this_cycle).toBe(0);
  });

  test("setBudget patches individual fields", () => {
    const b = setBudget({ credits_remaining: 7, reserve_floor: 2 }, d, NOW);
    expect(b.credits_remaining).toBe(7);
    expect(b.reserve_floor).toBe(2);
    // Other fields unchanged
    expect(b.inmail_rollover_cap).toBe(15);
  });

  test("setBudget with empty patch → no-op, returns current row", () => {
    const before = getBudget(d);
    const after = setBudget({}, d, NOW);
    expect(after.credits_remaining).toBe(before.credits_remaining);
  });

  test("setBudget sets last_synced", () => {
    setBudget({ credits_remaining: 5 }, d, NOW);
    expect(getBudget(d).last_synced).toBe(NOW);
  });
});
