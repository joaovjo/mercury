import { db } from "../db/index.ts";
import { callTool } from "./linkedin.ts";

/**
 * Resolve a company name to its numeric LinkedIn URN id (required for the
 * people-search current_company filter). Cached in the `companies` table.
 */
export async function resolveCompanyUrn(name: string): Promise<string | null> {
	const d = db();
	const cached = d
		.query("SELECT urn_id FROM companies WHERE name = ? COLLATE NOCASE")
		.get(name) as { urn_id: string | null } | null;
	if (cached?.urn_id) return cached.urn_id;

	const profile = (await callTool("get_company_profile", {
		company_name: name,
	})) as {
		references?: { about?: Array<{ kind: string; value?: string }> };
	};
	const urn =
		profile?.references?.about?.find((r) => r.kind === "company_urn")?.value ??
		null;

	d.query(
		"INSERT INTO companies (name, urn_id) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET urn_id = excluded.urn_id",
	).run(name, urn);
	return urn;
}

export interface JobSearchParams {
	keywords: string;
	location?: string;
	workType?: string;
	maxPages?: number;
}

/** Instant raw job search via the LinkedIn MCP. */
export async function searchJobs(p: JobSearchParams): Promise<unknown> {
	const args: Record<string, unknown> = {
		keywords: p.keywords,
		max_pages: p.maxPages ?? 1,
	};
	if (p.location) args.location = p.location;
	if (p.workType) args.work_type = p.workType;
	return callTool("search_jobs", args);
}

export interface PeopleSearchParams {
	keywords: string;
	company?: string; // name; resolved to URN automatically
	location?: string;
}

/** Instant raw people search via the LinkedIn MCP (recruiter discovery). */
export async function searchPeople(p: PeopleSearchParams): Promise<unknown> {
	const args: Record<string, unknown> = { keywords: p.keywords };
	if (p.company) {
		const urn = await resolveCompanyUrn(p.company);
		if (urn) args.current_company = urn;
	}
	if (p.location) args.location = p.location;
	return callTool("search_people", args);
}

/** Full detail for a single job id. */
export async function jobDetails(jobId: string): Promise<unknown> {
	return callTool("get_job_details", { job_id: jobId });
}
