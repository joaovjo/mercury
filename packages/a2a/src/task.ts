import type { A2ATask, TaskStatus } from "./types.ts";

/**
 * In-memory stateful task tracker for A2A tasks.
 */
export class A2ATaskManager {
	private tasks = new Map<string, A2ATask>();

	createTask(skillId: string, input: Record<string, unknown>): A2ATask {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		const task: A2ATask = {
			id,
			skillId,
			status: "submitted",
			input,
			messages: [],
			artifacts: [],
			createdAt: now,
			updatedAt: now,
		};
		this.tasks.set(id, task);
		return task;
	}

	getTask(id: string): A2ATask | undefined {
		return this.tasks.get(id);
	}

	updateStatus(id: string, status: TaskStatus, output?: Record<string, unknown>, error?: string): A2ATask {
		const task = this.tasks.get(id);
		if (!task) throw new Error(`A2A Task #${id} not found`);
		task.status = status;
		task.updatedAt = new Date().toISOString();
		if (output !== undefined) task.output = output;
		if (error !== undefined) task.error = error;
		return task;
	}

	addMessage(id: string, role: "user" | "agent" | "system", content: string): A2ATask {
		const task = this.tasks.get(id);
		if (!task) throw new Error(`A2A Task #${id} not found`);
		task.messages.push({
			id: crypto.randomUUID(),
			role,
			content,
			timestamp: new Date().toISOString(),
		});
		task.updatedAt = new Date().toISOString();
		return task;
	}

	listTasks(): A2ATask[] {
		return Array.from(this.tasks.values());
	}
}
