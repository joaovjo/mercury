/**
 * Outreach store (issue #11) — SQLite operations built on the pure core logic.
 * Wraps outreach_attempts + outreach_budget. Keeps SQL in one place so the CLI,
 * server queries, and skills share identical semantics.
 */
import type { Database } from "bun:sqlite";
import { db, now } from "../db/index.ts";
import { notifyChange } from "../db/notify.ts";
import { loadOutreachConfig, type OutreachConfig } from "../paths.ts";
import {
  type OutreachState,
  type Channel,
  type AttemptLike,
  type DueAction,
  isBlocking,
  dueAction,
  nextActionDue,
  blockUntil,
  canTransition,
  BLOCKING_STATES,
} from "./core.ts";

export interface OutreachAttempt extends AttemptLike {
  id: number;
  person_username: string;
  person_name: string | null;
  recruiter_id: number | null;
  company_urn: string;
  company_name: string | null;
  job_id: string | null;
  channel: string | null;
  cost_credits: number;
  credit_refunded: number;
  refund_eligible_until: string | null;
  message_body: string | null;
  state: OutreachState;
  accepted_at: string | null;
  replied_at: string | null;
  withdrawn_at: string | null;
  closed_at: string | null;
  next_action_due: string | null;
  reason: string | null;
  source_skill: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetRow {
  id: number;
  plan: string | null;
  inmail_monthly_allotment: number;
  inmail_rollover_cap: number;
  cycle_reset_day: number;
  credits_remaining: number;
  credits_used_this_cycle: number;
  reserve_floor: number;
  last_synced: string | null;
}

/**
 * Result of a blacklist check for (person, company_urn): whether the person is
 * currently blocked for that company, and the blocking attempt if so.
 */
export interface BlockCheck {
  blocked: boolean;
  attempt?: OutreachAttempt;
  reason?: string;
}

/**
 * Is `username` blocked for `companyUrn` right now? Looks for any attempt in a
 * blocking state whose cooldown hasn't expired. The (username, urn) composite
 * index makes this a cheap lookup.
 */
export function checkBlocked(
  username: string,
  companyUrn: string,
  d: Database = db(),
  nowIso: string = now(),
): BlockCheck {
  const rows = d
    .query(
      `SELECT * FROM outreach_attempts
       WHERE person_username = $u AND company_urn = $c
         AND state IN ('invite_ignored','unresponsive','do_not_contact')
       ORDER BY updated_at DESC`,
    )
    .all({ $u: username, $c: companyUrn }) as OutreachAttempt[];

  for (const a of rows) {
    if (isBlocking(a, nowIso)) {
      const until = a.block_until ? ` until ${a.block_until.slice(0, 10)}` : " (permanent)";
      return {
        blocked: true,
        attempt: a,
        reason: `${a.state}${until} — ${a.reason ?? "no reason recorded"}`,
      };
    }
  }
  return { blocked: false };
}

export interface LogAttemptInput {
  username: string;
  name?: string;
  companyUrn: string;
  companyName?: string;
  jobId?: string;
  channel: Channel;
  costCredits?: 0 | 1;
  messageBody?: string;
  /** Initial state; defaults to `invited` for connect/inmail, `queued` if unsent. */
  state?: OutreachState;
  sourceSkill?: string;
  recruiterId?: number;
}

/**
 * Record a new outreach attempt (after a send, or as a queued item). Sets
 * sent_at + next_action_due for sent states, and refund window for InMail.
 * Decrements the InMail budget when a credit is spent.
 */
export function logAttempt(
  input: LogAttemptInput,
  d: Database = db(),
  cfg: OutreachConfig = loadOutreachConfig(),
  nowIso: string = now(),
): OutreachAttempt {
  const state: OutreachState = input.state ?? "invited";
  const sent = state !== "queued";
  const cost = input.costCredits ?? 0;

  const base: AttemptLike = {
    state,
    sent_at: sent ? nowIso : null,
    first_msg_at: null,
    followed_up_at: null,
    block_until: null,
  };
  const due = nextActionDue(base, cfg);
  const refundUntil =
    input.channel === "inmail" && cost === 1 ? addDaysIso(nowIso, 90) : null;

  const row = d
    .query(
      `INSERT INTO outreach_attempts (
         person_username, person_name, recruiter_id, company_urn, company_name,
         job_id, channel, cost_credits, refund_eligible_until, message_body,
         state, sent_at, next_action_due, source_skill, created_at, updated_at
       ) VALUES (
         $u, $n, $rid, $curn, $cname, $job, $ch, $cost, $refund, $body,
         $state, $sent, $due, $skill, $now, $now
       ) RETURNING *`,
    )
    .get({
      $u: input.username,
      $n: input.name ?? null,
      $rid: input.recruiterId ?? null,
      $curn: input.companyUrn,
      $cname: input.companyName ?? null,
      $job: input.jobId ?? null,
      $ch: input.channel,
      $cost: cost,
      $refund: refundUntil,
      $body: input.messageBody ?? null,
      $state: state,
      $sent: base.sent_at,
      $due: due,
      $skill: input.sourceSkill ?? null,
      $now: nowIso,
    }) as OutreachAttempt;

  if (cost === 1) spendCredit(d, nowIso);
  return row;
}

/**
 * Transition an attempt to a new state, validating the move and applying the
 * side-effects each state implies (timestamps, next_action_due, cooldown).
 * Throws on an illegal transition so callers surface a clear error.
 */
export function transition(
  id: number,
  to: OutreachState,
  opts: { reason?: string } = {},
  d: Database = db(),
  cfg: OutreachConfig = loadOutreachConfig(),
  nowIso: string = now(),
): OutreachAttempt {
  const a = d.query("SELECT * FROM outreach_attempts WHERE id = ?").get(id) as
    | OutreachAttempt
    | undefined;
  if (!a) throw new Error(`outreach attempt #${id} not found`);
  if (a.state === to) return a; // idempotent no-op
  if (!canTransition(a.state, to))
    throw new Error(`illegal outreach transition: ${a.state} → ${to} (attempt #${id})`);

  const sets: string[] = ["state = $state", "updated_at = $now"];
  const params: Record<string, string | number | null> = { $id: id, $state: to, $now: nowIso };
  if (opts.reason !== undefined) {
    sets.push("reason = $reason");
    params.$reason = opts.reason;
  }

  // Per-state side effects.
  if (to === "accepted") {
    sets.push("accepted_at = COALESCE(accepted_at, $now)");
    sets.push("first_msg_at = COALESCE(first_msg_at, $now)");
  }
  if (to === "followed_up") sets.push("followed_up_at = $now");
  if (to === "engaged") sets.push("replied_at = COALESCE(replied_at, $now)");
  if (to === "invite_ignored") sets.push("withdrawn_at = $now");
  if (to === "unresponsive" || to === "engaged" || to === "do_not_contact")
    sets.push("closed_at = COALESCE(closed_at, $now)");

  // Cooldown for blocking states.
  if (BLOCKING_STATES.has(to)) {
    const bu = blockUntil(cfg, nowIso);
    sets.push("block_until = $bu");
    params.$bu = bu;
  }

  // Recompute next_action_due against the would-be new row.
  const projected: AttemptLike = {
    state: to,
    sent_at: a.sent_at,
    first_msg_at: to === "accepted" ? nowIso : a.first_msg_at,
    followed_up_at: to === "followed_up" ? nowIso : a.followed_up_at,
    block_until: a.block_until,
  };
  sets.push("next_action_due = $due");
  params.$due = nextActionDue(projected, cfg);

  // InMail refund: a reply within the window refunds the credit.
  if (to === "engaged" && a.cost_credits === 1 && a.credit_refunded === 0) {
    if (!a.refund_eligible_until || new Date(nowIso) <= new Date(a.refund_eligible_until)) {
      sets.push("credit_refunded = 1");
      refundCredit(d, nowIso);
    }
  }

  return d
    .query(`UPDATE outreach_attempts SET ${sets.join(", ")} WHERE id = $id RETURNING *`)
    .get(params) as OutreachAttempt;
}

/** Attempts with a due action right now (or as of `onIso`), with the action. */
export function dueAttempts(
  d: Database = db(),
  cfg: OutreachConfig = loadOutreachConfig(),
  onIso: string = now(),
): Array<{ attempt: OutreachAttempt; action: DueAction }> {
  const rows = d
    .query(
      `SELECT * FROM outreach_attempts
       WHERE state IN ('invited','accepted','followed_up')
       ORDER BY next_action_due ASC`,
    )
    .all() as OutreachAttempt[];
  const out: Array<{ attempt: OutreachAttempt; action: DueAction }> = [];
  for (const a of rows) {
    const action = dueAction(a, cfg, onIso);
    if (action) out.push({ attempt: a, action });
  }
  return out;
}

/** All individuals currently blocked for a given company URN. */
export function blockedForCompany(
  companyUrn: string,
  d: Database = db(),
  nowIso: string = now(),
): OutreachAttempt[] {
  const rows = d
    .query(
      `SELECT * FROM outreach_attempts
       WHERE company_urn = $c
         AND state IN ('invite_ignored','unresponsive','do_not_contact')
       ORDER BY updated_at DESC`,
    )
    .all({ $c: companyUrn }) as OutreachAttempt[];
  return rows.filter((a) => isBlocking(a, nowIso));
}

// ── Budget ────────────────────────────────────────────────────────────────

export function getBudget(d: Database = db()): BudgetRow {
  return d.query("SELECT * FROM outreach_budget WHERE id = 1").get() as BudgetRow;
}

export function spendCredit(d: Database = db(), nowIso: string = now()): void {
  d.query(
    `UPDATE outreach_budget
       SET credits_remaining = MAX(0, credits_remaining - 1),
           credits_used_this_cycle = credits_used_this_cycle + 1,
           last_synced = $now
     WHERE id = 1`,
  ).run({ $now: nowIso });
}

export function refundCredit(d: Database = db(), nowIso: string = now()): void {
  d.query(
    `UPDATE outreach_budget
       SET credits_remaining = MIN(inmail_rollover_cap, credits_remaining + 1),
           credits_used_this_cycle = MAX(0, credits_used_this_cycle - 1),
           last_synced = $now
     WHERE id = 1`,
  ).run({ $now: nowIso });
}

export function setBudget(
  patch: Partial<Omit<BudgetRow, "id">>,
  d: Database = db(),
  nowIso: string = now(),
): BudgetRow {
  const cols = Object.keys(patch);
  if (cols.length) {
    const sets = cols.map((c) => `${c} = $${c}`).join(", ");
    const params: Record<string, unknown> = { $now: nowIso };
    for (const [k, v] of Object.entries(patch)) params[`$${k}`] = v;
    d.query(`UPDATE outreach_budget SET ${sets}, last_synced = $now WHERE id = 1`).run(
      params as Record<string, string | number | null>,
    );
  }
  return getBudget(d);
}

// ── helpers ─────────────────────────────────────────────────────────────────

function addDaysIso(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

/** Notify a running dashboard that outreach data changed. */
export async function notifyOutreach(): Promise<void> {
  await notifyChange("outreach_attempts");
}
