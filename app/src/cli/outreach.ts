/**
 * `mercury outreach <sub>` — outreach relationship-memory CLI (issue #11).
 *
 * Subcommands:
 *   log      Record a new attempt (after a send) or a queued candidate.
 *   update   Transition an attempt's state (accept/followup/engaged/etc).
 *   check    Blacklist check for (--username, --company-urn) — exit 1 if blocked.
 *   due      List attempts with a due follow-up/withdraw/close action.
 *   list     List attempts, optionally filtered by --company-urn / --state.
 *   blocked  List individuals blocked for a --company-urn.
 *   budget   Show or set (--plan --remaining --allotment --rollover-cap --reserve-floor) InMail budget.
 *   withdraw Withdraw a pending invite (browser) + mark invite_ignored + block.
 *
 * Honors require_send_consent: this CLI never *sends* anything to LinkedIn on
 * its own except `withdraw` (an explicit, user-invoked action). Skills do the
 * sending and then call `log`.
 */
import { type Flags, str, int, reqStr } from "./flags.ts";
import { loadOutreachConfig } from "../paths.ts";
import {
  logAttempt,
  transition,
  checkBlocked,
  dueAttempts,
  blockedForCompany,
  getBudget,
  setBudget,
  notifyOutreach,
  type OutreachAttempt,
} from "../outreach/store.ts";
import { db } from "../db/index.ts";
import type { OutreachState, Channel } from "../outreach/core.ts";

function fmtAttempt(a: OutreachAttempt): string {
  const who = a.person_name ? `${a.person_name} (${a.person_username})` : a.person_username;
  const co = a.company_name ?? a.company_urn;
  const due = a.next_action_due ? ` · due ${a.next_action_due.slice(0, 10)}` : "";
  return `#${a.id} ${who} @ ${co} — ${a.state}${due}`;
}

export async function outreachCmd(sub: string, flags: Flags): Promise<void> {
  switch (sub) {
    case "log": {
      const a = logAttempt({
        username: reqStr(flags, "username"),
        name: str(flags, "name"),
        companyUrn: reqStr(flags, "company-urn"),
        companyName: str(flags, "company"),
        jobId: str(flags, "job-id"),
        channel: (str(flags, "channel") as Channel) ?? "connect_note",
        costCredits: int(flags, "cost") === 1 ? 1 : 0,
        messageBody: str(flags, "message"),
        state: str(flags, "state") as OutreachState | undefined,
        sourceSkill: str(flags, "source-skill"),
        recruiterId: int(flags, "recruiter-id"),
      });
      await notifyOutreach();
      console.log(`outreach attempt #${a.id} logged: ${fmtAttempt(a)}`);
      return;
    }

    case "update": {
      const id = int(flags, "id");
      if (id === undefined) {
        console.error("error: missing --id");
        process.exit(1);
      }
      const to = reqStr(flags, "state") as OutreachState;
      try {
        const a = transition(id, to, { reason: str(flags, "reason") });
        await notifyOutreach();
        console.log(`outreach #${id} → ${a.state}`);
      } catch (err) {
        console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
      return;
    }

    case "check": {
      const username = reqStr(flags, "username");
      const urn = reqStr(flags, "company-urn");
      const res = checkBlocked(username, urn);
      if (res.blocked) {
        console.log(`BLOCKED: ${username} @ ${urn} — ${res.reason}`);
        process.exit(1); // non-zero so scripts/skills can gate on it
      }
      console.log(`OK: ${username} is not blocked for ${urn}`);
      return;
    }

    case "due": {
      const on = str(flags, "on"); // optional YYYY-MM-DD override
      const onIso = on ? new Date(on).toISOString() : undefined;
      const items = dueAttempts(db(), loadOutreachConfig(), onIso);
      if (!items.length) {
        console.log("nothing due");
        return;
      }
      for (const { attempt, action } of items) {
        console.log(`[${action.kind.toUpperCase()}] ${fmtAttempt(attempt)} — ${action.reason}`);
      }
      return;
    }

    case "list": {
      const urn = str(flags, "company-urn");
      const state = str(flags, "state");
      const clauses: string[] = [];
      const params: Record<string, string> = {};
      if (urn) {
        clauses.push("company_urn = $c");
        params.$c = urn;
      }
      if (state) {
        clauses.push("state = $s");
        params.$s = state;
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const rows = db()
        .query(`SELECT * FROM outreach_attempts ${where} ORDER BY updated_at DESC`)
        .all(params) as OutreachAttempt[];
      if (!rows.length) {
        console.log("no attempts");
        return;
      }
      for (const a of rows) console.log(fmtAttempt(a));
      return;
    }

    case "blocked": {
      const urn = reqStr(flags, "company-urn");
      const rows = blockedForCompany(urn);
      if (!rows.length) {
        console.log(`no one blocked for ${urn}`);
        return;
      }
      console.log(`Blocked for ${urn}:`);
      for (const a of rows) {
        const until = a.block_until ? ` (until ${a.block_until.slice(0, 10)})` : " (permanent)";
        console.log(`  ${a.person_name ?? a.person_username}: ${a.state}${until} — ${a.reason ?? ""}`);
      }
      return;
    }

    case "budget": {
      const patch: Record<string, string | number> = {};
      if (str(flags, "plan")) patch.plan = str(flags, "plan")!;
      if (int(flags, "remaining") !== undefined) patch.credits_remaining = int(flags, "remaining")!;
      if (int(flags, "allotment") !== undefined)
        patch.inmail_monthly_allotment = int(flags, "allotment")!;
      if (int(flags, "rollover-cap") !== undefined)
        patch.inmail_rollover_cap = int(flags, "rollover-cap")!;
      if (int(flags, "reserve-floor") !== undefined)
        patch.reserve_floor = int(flags, "reserve-floor")!;
      if (int(flags, "reset-day") !== undefined) patch.cycle_reset_day = int(flags, "reset-day")!;

      const b = Object.keys(patch).length ? setBudget(patch) : getBudget();
      if (Object.keys(patch).length) await notifyOutreach();
      console.log(
        `InMail budget [${b.plan}]: ${b.credits_remaining} remaining` +
          ` (reserve ${b.reserve_floor}, used ${b.credits_used_this_cycle}/cycle,` +
          ` allotment ${b.inmail_monthly_allotment}, cap ${b.inmail_rollover_cap})`,
      );
      return;
    }

    case "withdraw": {
      const id = int(flags, "id");
      if (id === undefined) {
        console.error("error: missing --id");
        process.exit(1);
      }
      const { withdrawInvitation } = await import("../mcp/withdraw.ts");
      const a = db().query("SELECT * FROM outreach_attempts WHERE id = ?").get(id) as
        | OutreachAttempt
        | undefined;
      if (!a) {
        console.error(`error: outreach attempt #${id} not found`);
        process.exit(1);
      }
      // Attempt the browser withdrawal; degrade gracefully on failure so the
      // dedupe/block bookkeeping still happens (the invite just lingers on LI).
      let withdrawn = false;
      try {
        withdrawn = await withdrawInvitation(a.person_username);
      } catch (err) {
        console.error(
          `warn: browser withdrawal failed (${err instanceof Error ? err.message : err}); ` +
            `marking blocked anyway`,
        );
      }
      const reason = withdrawn
        ? "invite withdrawn + company-blocked"
        : "withdrawal unconfirmed; company-blocked (invite may still be pending on LinkedIn)";
      transition(id, "invite_ignored", { reason });
      await notifyOutreach();
      console.log(`outreach #${id} → invite_ignored (${withdrawn ? "withdrawn" : "degraded"})`);
      return;
    }

    default:
      console.error(
        `unknown outreach subcommand: ${sub}\n` +
          `usage: mercury outreach log|update|check|due|list|blocked|budget|withdraw`,
      );
      process.exit(1);
  }
}
