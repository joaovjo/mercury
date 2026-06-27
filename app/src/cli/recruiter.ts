import { db, now } from "../db/index.ts";
import { notifyChange } from "../db/notify.ts";
import { type Flags, str, int, reqStr } from "./flags.ts";

/** mercury recruiter add|update */
export async function recruiterCmd(sub: string, flags: Flags): Promise<void> {
  const d = db();
  if (sub === "add") {
    const name = reqStr(flags, "name");
    const stmt = d.query(`
      INSERT INTO recruiters (name, username, company, title, location, degree, mutuals_json, status, date_contacted, note, source_skill)
      VALUES ($name, $username, $company, $title, $location, $degree, $mutuals, $status, $date, $note, $skill)
      ON CONFLICT(username, company) DO UPDATE SET
        status = excluded.status,
        note = COALESCE(excluded.note, recruiters.note),
        updated_at = datetime('now')
      RETURNING id
    `);
    const row = stmt.get({
      $name: name,
      $username: str(flags, "username") ?? null,
      $company: str(flags, "company") ?? null,
      $title: str(flags, "title") ?? null,
      $location: str(flags, "location") ?? null,
      $degree: str(flags, "degree") ?? null,
      $mutuals: str(flags, "mutuals") ?? null,
      $status: str(flags, "status") ?? "pending",
      $date: str(flags, "date") ?? now(),
      $note: str(flags, "note") ?? null,
      $skill: str(flags, "source-skill") ?? "recruiter-outreach",
    }) as { id: number };
    await notifyChange("recruiters");
    console.log(`recruiter #${row.id} (${name}) saved`);
    return;
  }
  if (sub === "update") {
    const id = int(flags, "id");
    if (id === undefined) {
      console.error("error: missing --id");
      process.exit(1);
    }
    const status = str(flags, "status");
    const sets: string[] = ["updated_at = datetime('now')"];
    const params: Record<string, string | number | null> = { $id: id };
    if (status) {
      sets.push("status = $status");
      params.$status = status;
      if (status === "accepted") sets.push("accepted_at = COALESCE(accepted_at, datetime('now'))");
      if (status === "replied") sets.push("replied_at = COALESCE(replied_at, datetime('now'))");
    }
    // Editable scalar fields. Previously only --status/--note were honored and
    // any --username/--degree/etc were silently dropped (no error, no write).
    for (const f of ["note", "username", "company", "title", "location", "degree"] as const) {
      const v = str(flags, f);
      if (v !== undefined) {
        sets.push(`${f} = $${f}`);
        params[`$${f}`] = v;
      }
    }
    d.query(`UPDATE recruiters SET ${sets.join(", ")} WHERE id = $id`).run(params);
    await notifyChange("recruiters");
    console.log(`recruiter #${id} updated`);
    return;
  }
  if (sub === "sync") {
    await recruiterSyncCmd(flags);
    return;
  }
  console.error(`unknown recruiter subcommand: ${sub}\nusage: mercury recruiter add|update|sync`);
  process.exit(1);
}

/**
 * `mercury recruiter sync` — reconcile pending recruiters with LinkedIn by
 * detecting which ones are now first-degree connections (i.e. accepted).
 *
 *   --apply      write the pending→accepted transitions (default: dry-run)
 *   --json       emit machine-readable JSON
 *
 * Requires the LinkedIn MCP to be reachable (it drives `search_people`). On a
 * machine without it configured, detection errors are reported per-company as
 * "skipped" rather than crashing.
 */
async function recruiterSyncCmd(flags: Flags): Promise<void> {
  const { runSync } = await import("../recruiter/sync.ts");
  const apply = flags.apply === true;
  const asJson = flags.json === true;

  let result;
  try {
    result = await runSync({ apply });
  } catch (err) {
    console.error(`error: recruiter sync failed — ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  if (apply && result.changes.length) {
    await notifyChange("recruiters");
    const names = result.changes.map((c) => c.name).join(", ");
    const { activityCmd } = await import("./records.ts");
    await activityCmd({
      kind: "recruiter_sync",
      skill: "recruiter-sync",
      summary: `Sync: ${result.changes.length} accepted (${names})`,
    });
  }

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const verb = apply ? "applied" : "would apply (dry-run)";
  console.log(
    `recruiter sync — scanned ${result.scanned} pending across ${result.companiesQueried} compan${result.companiesQueried === 1 ? "y" : "ies"}`,
  );
  if (!result.changes.length) {
    console.log("  no new acceptances detected");
  } else {
    console.log(`  ${result.changes.length} ${verb}:`);
    for (const c of result.changes) {
      console.log(`    #${c.id} ${c.name} @ ${c.company ?? "?"} — ${c.from} → ${c.to} (by ${c.matchedBy})`);
    }
  }
  if (result.skipped.length) {
    console.log(`  skipped (detection error): ${result.skipped.join(", ")}`);
  }
  if (!apply && result.changes.length) {
    console.log(`\n  re-run with --apply to write these changes.`);
  }
}
