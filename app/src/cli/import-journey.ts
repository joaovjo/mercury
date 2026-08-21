import { readFileSync } from "node:fs";
import { db } from "../db/index.ts";
import { notifyChange } from "../db/notify.ts";

/**
 * One-off importer for the legacy JOURNEY.md format.
 * Parses the "Recruiter Outreach Tracker", "Interviews", and
 * "Profile Metrics" markdown tables and loads them into SQLite.
 */
export async function importJourneyCmd(path: string): Promise<void> {
	const md = readFileSync(path, "utf8");
	const d = db();

	let recruiters = 0;
	let interviews = 0;
	let metrics = 0;

	// --- Recruiter Outreach Tracker ---
	// | Name | Company | Date Sent | Accepted? | Response? | Notes |
	for (const row of tableRows(md, "Recruiter Outreach Tracker")) {
		if (row.length < 6) continue;
		const [name, company, dateSent, accepted, , notes] = row;
		if (!name || name === "Name") continue;
		const status = mapStatus(accepted ?? "");
		d.query(`
      INSERT INTO recruiters (name, company, date_contacted, status, note, source_skill)
      VALUES ($name, $company, $date, $status, $note, 'import-journey')
      ON CONFLICT(username, company) DO NOTHING
    `).run({
			$name: name,
			$company: company ?? null,
			$date: dateSent && dateSent !== "?" ? dateSent : null,
			$status: status,
			$note: notes ?? null,
		});
		recruiters++;
	}

	// --- Interviews ---
	// | Company | Date | Stage | Status | Notes |
	for (const row of tableRows(md, "## Interviews")) {
		if (row.length < 5) continue;
		const [company, date, stage, status, notes] = row;
		if (!company || company === "Company") continue;
		d.query(`
      INSERT INTO interviews (company, scheduled_at, stage, status, notes)
      VALUES ($company, $when, $stage, $status, $notes)
    `).run({
			$company: company,
			$when: date && date !== "TBD" ? date : null,
			$stage: stage ?? null,
			$status: (status ?? "scheduled").toLowerCase(),
			$notes: notes ?? null,
		});
		interviews++;
	}

	// --- Profile Metrics ---
	// | Date | Search Appearances/wk | Profile Views | Connections |
	for (const row of tableRows(md, "Profile Metrics")) {
		if (row.length < 4) continue;
		const [date, sa, pv, conn] = row;
		if (!date || date === "Date") continue;
		d.query(`
      INSERT INTO profile_metrics (captured_at, search_appearances, profile_views, connections)
      VALUES ($at, $sa, $pv, $conn)
    `).run({
			$at: date,
			$sa: num(sa),
			$pv: num(pv),
			$conn: num(conn),
		});
		metrics++;
	}

	await notifyChange("recruiters");
	console.log(
		`Imported: ${recruiters} recruiters, ${interviews} interviews, ${metrics} metric snapshots`,
	);
}

/** Extract data rows from the first markdown table following a heading/label. */
function tableRows(md: string, afterMarker: string): string[][] {
	const idx = md.indexOf(afterMarker);
	if (idx === -1) return [];
	const rest = md.slice(idx);
	const lines = rest.split("\n");
	const rows: string[][] = [];
	let inTable = false;
	for (const line of lines) {
		const t = line.trim();
		if (t.startsWith("|")) {
			// skip separator rows like |---|---|
			if (/^\|[\s:|-]+\|$/.test(t)) {
				inTable = true;
				continue;
			}
			const cells = t
				.slice(1, -1)
				.split("|")
				.map((c) => c.trim());
			rows.push(cells);
			inTable = true;
		} else if (inTable && t === "") {
			break; // table ended
		}
	}
	// drop the header row (first row before separator)
	return rows.slice(1);
}

function mapStatus(accepted: string): string {
	const a = accepted.toLowerCase();
	if (a.includes("1st") || a.includes("accept") || a.includes("✅"))
		return "accepted";
	return "pending";
}

function num(s: string | undefined): number | null {
	if (!s) return null;
	const n = Number.parseInt(s.replace(/[^\d]/g, ""), 10);
	return Number.isNaN(n) ? null : n;
}
