/**
 * Agent2Agent (A2A) Protocol Types and Contracts
 * Spec: https://a2a-protocol.org/
 */

export interface AgentSkill {
	id: string;
	name: string;
	description: string;
	tags?: string[];
	inputSchema?: Record<string, unknown>;
	outputSchema?: Record<string, unknown>;
}

export interface AgentCard {
	protocolVersion: "1.0.0" | string;
	name: string;
	description: string;
	version: string;
	homepage?: string;
	provider?: {
		name: string;
		url?: string;
	};
	capabilities: {
		streaming?: boolean;
		pushNotifications?: boolean;
		statefulTasks?: boolean;
	};
	skills: AgentSkill[];
	endpoints: {
		tasks?: string;
		messages?: string;
		webhook?: string;
	};
	authentication?: {
		type: "none" | "bearer" | "oauth2" | "api_key";
		tokenUrl?: string;
	};
}

export type TaskStatus =
	| "submitted"
	| "working"
	| "completed"
	| "failed"
	| "canceled";

export interface A2AMessage {
	id: string;
	role: "user" | "agent" | "system";
	content: string;
	timestamp: string;
}

export interface A2AArtifact {
	id: string;
	name: string;
	type: string;
	uri?: string;
	data?: unknown;
}

export interface A2ATask {
	id: string;
	skillId?: string;
	status: TaskStatus;
	input: Record<string, unknown>;
	output?: Record<string, unknown>;
	error?: string;
	messages: A2AMessage[];
	artifacts: A2AArtifact[];
	createdAt: string;
	updatedAt: string;
}
