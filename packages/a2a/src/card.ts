import { VERSION } from "@mercury/core";
import type { AgentCard } from "./types.ts";

/**
 * Builds the standard Agent Card for Mercury according to the A2A spec.
 * Typically served at `/.well-known/agent.json`.
 */
export function buildAgentCard(baseUrl?: string): AgentCard {
	const base = baseUrl ? baseUrl.replace(/\/$/, "") : "";
	return {
		protocolVersion: "1.0.0",
		name: "Mercury",
		description:
			"AI job-search companion for recruiter tracking, job discovery, ATS auto-fill, and outreach relationship memory.",
		version: VERSION,
		homepage: "https://github.com/joaovjo/mercury",
		provider: {
			name: "Mercury Project",
			url: "https://github.com/joaovjo/mercury",
		},
		capabilities: {
			streaming: true,
			pushNotifications: true,
			statefulTasks: true,
		},
		skills: [
			{
				id: "job-scout",
				name: "Job Scout",
				description:
					"Scouts, filters, and ranks matching job opportunities based on candidate profile and preferences.",
				tags: ["jobs", "search", "recruitment"],
			},
			{
				id: "recruiter-tracker",
				name: "Recruiter Tracker",
				description:
					"Manages outreach lifecycle, syncs accepted invites, and computes cadence due dates.",
				tags: ["outreach", "networking", "linkedin"],
			},
			{
				id: "portal-filler",
				name: "Portal Filler",
				description:
					"Matches ATS application form fields to stored candidate answers with exact and fuzzy matching.",
				tags: ["ats", "applications", "form-filler"],
			},
			{
				id: "profile-optimizer",
				name: "Profile Optimizer",
				description:
					"Analyzes LinkedIn profile metrics, headline fit, and keyword density scores.",
				tags: ["profile", "scoring", "analytics"],
			},
		],
		endpoints: {
			tasks: `${base}/api/a2a/tasks`,
			messages: `${base}/api/a2a/messages`,
		},
		authentication: {
			type: "bearer",
		},
	};
}

export function validateAgentCard(card: unknown): card is AgentCard {
	if (!card || typeof card !== "object") return false;
	const c = card as Partial<AgentCard>;
	return (
		typeof c.name === "string" &&
		typeof c.version === "string" &&
		typeof c.protocolVersion === "string" &&
		Array.isArray(c.skills)
	);
}
