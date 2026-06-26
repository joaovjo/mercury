import { db, now } from "../db/index.ts";
import { notifyChange } from "../db/notify.ts";
import { type Flags, str, int, reqStr } from "./flags.ts";

/** mercury job save */
export async function jobCmd(sub: string, flags: Flags): Promise<void> {
  const d = db();
  if (sub === "save") {
    const row = d.query(`
      INSERT INTO jobs (linkedin_job_id, title, company_name, location, work_type, comp, fit, requirements_json, status, link)
      VALUES ($jid, $title, $company, $location, $work, $comp, $fit, $reqs, $status, $link)
      ON CONFLICT(linkedin_job_id) DO UPDATE SET
        fit = COALESCE(excluded.fit, jobs.fit),
        status = COALESCE(excluded.status, jobs.status)
      RETURNING id
    `).get({
      $jid: str(flags, "linkedin-id") ?? null,
      $title: str(flags, "title") ?? null,
      $company: str(flags, "company") ?? null,
      $location: str(flags, "location") ?? null,
      $work: str(flags, "work-type") ?? null,
      $comp: str(flags, "comp") ?? null,
      $fit: str(flags, "fit") ?? null,
      $reqs: str(flags, "requirements") ?? null,
      $status: str(flags, "status") ?? "saved",
      $link: str(flags, "link") ?? null,
    }) as { id: number };
    await notifyChange("jobs");
    console.log(`job #${row.id} saved`);
    return;
  }
  console.error(`unknown job subcommand: ${sub}`);
  process.exit(1);
}

/** mercury metric record */
export async function metricCmd(flags: Flags): Promise<void> {
  const d = db();
  const row = d.query(`
    INSERT INTO profile_metrics (captured_at, search_appearances, profile_views, post_impressions, connections, score, breakdown_json)
    VALUES ($at, $sa, $pv, $pi, $conn, $score, $breakdown)
    RETURNING id
  `).get({
    $at: str(flags, "at") ?? now(),
    $sa: int(flags, "search-appearances") ?? null,
    $pv: int(flags, "profile-views") ?? null,
    $pi: int(flags, "post-impressions") ?? null,
    $conn: int(flags, "connections") ?? null,
    $score: int(flags, "score") ?? null,
    $breakdown: str(flags, "breakdown") ?? null,
  }) as { id: number };
  await notifyChange("profile_metrics");
  console.log(`metric snapshot #${row.id} recorded`);
}

/** mercury score record — convenience that records a score-only metric row */
export async function scoreCmd(flags: Flags): Promise<void> {
  const d = db();
  const value = int(flags, "value");
  if (value === undefined) {
    console.error("error: missing --value");
    process.exit(1);
  }
  d.query(`
    INSERT INTO profile_metrics (captured_at, score, breakdown_json)
    VALUES ($at, $score, $breakdown)
  `).run({
    $at: now(),
    $score: value,
    $breakdown: str(flags, "signals") ?? null,
  });
  await notifyChange("profile_metrics");
  console.log(`score ${value} recorded`);
}

/** mercury interview add */
export async function interviewCmd(sub: string, flags: Flags): Promise<void> {
  const d = db();
  if (sub === "add") {
    const company = reqStr(flags, "company");
    const row = d.query(`
      INSERT INTO interviews (company, scheduled_at, stage, status, notes)
      VALUES ($company, $when, $stage, $status, $notes)
      RETURNING id
    `).get({
      $company: company,
      $when: str(flags, "when") ?? null,
      $stage: str(flags, "stage") ?? null,
      $status: str(flags, "status") ?? "scheduled",
      $notes: str(flags, "note") ?? null,
    }) as { id: number };
    await notifyChange("interviews");
    console.log(`interview #${row.id} (${company}) added`);
    return;
  }
  console.error(`unknown interview subcommand: ${sub}`);
  process.exit(1);
}

/** mercury application add | update */
export async function applicationCmd(sub: string, flags: Flags): Promise<void> {
  const d = db();
  if (sub === "add") {
    const row = d.query(`
      INSERT INTO applications (job_id, resume_path, cover_letter_path, report_path, keyword_score, status, applied_at, portal, external_url)
      VALUES ($job, $resume, $cover, $report, $score, $status, $applied, $portal, $url)
      RETURNING id
    `).get({
      $job: int(flags, "job-id") ?? null,
      $resume: str(flags, "resume-path") ?? null,
      $cover: str(flags, "cover-path") ?? null,
      $report: str(flags, "report-path") ?? null,
      $score: int(flags, "keyword-score") ?? null,
      $status: str(flags, "status") ?? "draft",
      $applied: str(flags, "applied-at") ?? null,
      $portal: str(flags, "portal") ?? null,
      $url: str(flags, "external-url") ?? null,
    }) as { id: number };
    await notifyChange("applications");
    console.log(`application #${row.id} added`);
    return;
  }
  if (sub === "update") {
    const id = int(flags, "id");
    if (id === undefined) {
      console.error("error: missing required --id");
      process.exit(1);
    }
    // Build a partial UPDATE from only the flags actually provided, so callers
    // can transition status without clobbering portal/url/json columns.
    const sets: string[] = [];
    const params: Record<string, string | number | null> = { $id: id };
    const map: Record<string, string> = {
      status: "status",
      portal: "portal",
      "external-url": "external_url",
      fields: "fields_filled_json",
      unfilled: "unfilled_json",
      "applied-at": "applied_at",
      "resume-path": "resume_path",
      "cover-path": "cover_letter_path",
      "report-path": "report_path",
    };
    for (const [flag, col] of Object.entries(map)) {
      const v = str(flags, flag);
      if (v !== undefined) {
        sets.push(`${col} = $${col}`);
        params[`$${col}`] = v;
      }
    }
    if (sets.length === 0) {
      console.error("error: nothing to update (pass --status/--portal/--external-url/--fields/--unfilled/...)");
      process.exit(1);
    }
    const res = d.query(
      `UPDATE applications SET ${sets.join(", ")} WHERE id = $id RETURNING id`,
    ).get(params) as { id: number } | null;
    if (!res) {
      console.error(`error: application #${id} not found`);
      process.exit(1);
    }
    await notifyChange("applications");
    console.log(`application #${id} updated`);
    return;
  }
  console.error(`unknown application subcommand: ${sub}`);
  process.exit(1);
}

/** mercury answer set | list — reusable PII/eligibility/links/EEO answer store. */
export async function answerCmd(sub: string, flags: Flags): Promise<void> {
  const d = db();
  if (sub === "set") {
    const key = reqStr(flags, "key");
    const value = str(flags, "value") ?? null;
    d.query(`
      INSERT INTO applicant_answers (key, value, category, updated_at)
      VALUES ($key, $value, $cat, $at)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        category = COALESCE(excluded.category, applicant_answers.category),
        updated_at = excluded.updated_at
    `).run({
      $key: key,
      $value: value,
      $cat: str(flags, "category") ?? "custom",
      $at: now(),
    });
    await notifyChange("applicant_answers");
    console.log(`answer '${key}' set`);
    return;
  }
  if (sub === "list") {
    const cat = str(flags, "category");
    const rows = cat
      ? d.query(`SELECT key, value, category, updated_at FROM applicant_answers WHERE category = ? ORDER BY category, key`).all(cat)
      : d.query(`SELECT key, value, category, updated_at FROM applicant_answers ORDER BY category, key`).all();
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  console.error(`unknown answer subcommand: ${sub}`);
  process.exit(1);
}

/** mercury activity log */
export async function activityCmd(flags: Flags): Promise<void> {
  const d = db();
  d.query(`
    INSERT INTO activity_log (kind, skill, summary, payload_json)
    VALUES ($kind, $skill, $summary, $payload)
  `).run({
    $kind: str(flags, "kind") ?? "skill-run",
    $skill: str(flags, "skill") ?? null,
    $summary: str(flags, "summary") ?? null,
    $payload: str(flags, "payload") ?? null,
  });
  await notifyChange("activity_log");
  console.log("activity logged");
}
