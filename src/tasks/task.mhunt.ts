import { MonsterName } from "alclient";
import { Bot, BotMode } from "../classes/bot.js";
import Config from "../utils/config.js";
import { LogLevel } from "../utils/logger.js";
import TaskLauncher from "./launcher.js";
import Task from "./task.js";

export async function mhunt_start<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	if (gc.rip) return timeout;

	const ids = Config.get_config<MonsterName[]>("allowed_hunt_ids") ?? [];
	if (gc.s.monsterhunt !== undefined) {
		// Check if the monsterhunt is allowed.
		self.log(`Quest target is '${gc.s.monsterhunt.id}'`, LogLevel.INFO);
		if (ids.includes(gc.s.monsterhunt.id) && !ids.includes(self.targets[0])) {
			self.targets = [gc.s.monsterhunt.id];
			self.log("ID allowed, Monster hunt started!", LogLevel.WARNING);
			await TaskLauncher.restart(mhunt_finish, self, Task.Constants.Timeouts.MHUNT_FINISH);
		} else self.log("ID not allowed, Monster hunt ignored!", LogLevel.INFO);
		return gc.s.monsterhunt.ms;
	}
	// Go and take the monsterhunt quest.
	const mode = self.mode;
	self.mode = BotMode.Idle;

	try {
		self.log("On the way to start a quest", LogLevel.INFO);
		TaskLauncher.stop(Task.move, self);
		if (gc.smartMoving) await gc.stopSmartMove();
		await gc.smartMove("monsterhunter");
		await gc.getMonsterHuntQuest();
	} catch (e) { throw new Error(e.message) } finally {
		// Restore the mode and restart the move task.
		self.mode = mode;
		await TaskLauncher.restart(Task.move, self, Task.Constants.Timeouts.MOVE);
	}
	return timeout;
}

export async function mhunt_finish<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	if (gc.rip) return timeout;

	const mhunt = gc.s.monsterhunt;
	if (mhunt === undefined || mhunt.c !== 0) return timeout;


	const mode = self.mode;
	self.mode = BotMode.Idle;

	try {
		// Stop the move task, since this task will take the hand on the movement temporarily.
		TaskLauncher.stop(Task.move, self);
		if (gc.smartMoving) await gc.stopSmartMove();
		await gc.smartMove("monsterhunter");
		await gc.finishMonsterHuntQuest();

		self.log("Monster hunt completed!", LogLevel.INFO);
		await TaskLauncher.restart(mhunt_start, self, Task.Constants.Timeouts.MHUNT_START);
	} catch (e) { throw new Error(e.message) } finally {
		// Restore the mode and restart the move task.
		self.mode = mode;
		await TaskLauncher.restart(Task.move, self, Task.Constants.Timeouts.MOVE);
	}
	return timeout;
}
