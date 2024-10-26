import { Bot, BotMode } from "../classes/bot.js";
import { LogLevel } from "../utils/logger.js";

interface TaskLauncher<T extends Bot> {
	(self: T, task_launcher_fn: TaskLauncher<T>): Promise<void>;
}

function get_timeout_name(
	task: <T extends Bot>(self: T, timeout: number) => Promise<number>
): string {
	return `task_${task.name}`;
}

export function start<T extends Bot>(
	task: <T extends Bot>(self: T, timeout: number) => Promise<number>,
	self: T,
	default_timeout: number
) {
	const timeout_name = get_timeout_name(task);
	const time_fn = (task_launcher_fn: TaskLauncher<T>, timeout: number) => {
		self.gc().timeouts.set(timeout_name,
			setTimeout(task_launcher_fn, timeout, self, task_launcher_fn)
		)
	};
	const task_launcher: TaskLauncher<T> = async (self: T, task_launcher_fn: TaskLauncher<T>) => {
		const timeout = self.gc().timeouts.get(timeout_name);
		clearTimeout(timeout);
		self.gc().timeouts.delete(timeout_name);
		// If the bot is idle or the socket is disconnected, reschedule the task.
		if (self.is_mode(BotMode.Idle) || self.gc().socket.disconnected || self.gc().ready === false)
			return time_fn(task_launcher_fn, default_timeout);
		// Else, run the task.
		await task<T>(self, default_timeout).then((timeout: number) =>
			time_fn(task_launcher_fn, timeout)
		).catch(e => {
			self.log(`[${task.name.toUpperCase()}] ~> ${e.message}`, LogLevel.ERROR);
			time_fn(task_launcher_fn, default_timeout)
		});
	};
	// Start the first task after 4s.
	time_fn(task_launcher, 4000);
}

export function stop<T extends Bot>(
	task: <T extends Bot>(self: T, timeout: number) => Promise<number>,
	self: T
) {
	const timeout_name = get_timeout_name(task);
	const timeout = self.gc().timeouts.get(timeout_name);
	self.gc().timeouts.delete(timeout_name);
	clearTimeout(timeout);
}

export async function restart<T extends Bot>(
	task: <T extends Bot>(self: T, timeout: number) => Promise<number>,
	self: T,
	default_timeout: number
) {
	stop<T>(task, self);
	start<T>(task, self, default_timeout);
}

export default { start, stop, restart };
