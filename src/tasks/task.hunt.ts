import { MonsterName } from "alclient";
import { Bot, BotMode } from "../classes/bot.js";
import Config from "../utils/config.js";
import { LogLevel } from "../utils/logger.js";
import TaskLauncher from "./launcher.js";
import Task from "./task.js";

export async function hunt_start<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	if (gc.rip) return timeout;

	const ids = Config.get_config<MonsterName[]>("allowed_hunt_ids") ?? [];
	if (gc.s.monsterhunt !== undefined) {
		// TODO: Fading Timeouts make me come back there even though it's still defined
		// -- Find someway to avoid it.

		// Check if the monsterhunt is allowed.
		self.log(`Quest target is '${gc.s.monsterhunt.id}'`, LogLevel.INFO);
		if (ids.includes(gc.s.monsterhunt.id)) {
			self.log({
				message: 'ID allowed, Monster hunt started!',
				data: { duration: gc.s.monsterhunt.ms, quantity: gc.s.monsterhunt.c }
			}, LogLevel.WARNING);
			self.targets = [gc.s.monsterhunt.id];
			TaskLauncher.restart(hunt_finish, self, Task.Constants.Timeouts.HUNT_FINISH);
		} else self.log("ID not allowed, Monster hunt ignored!", LogLevel.INFO);
		return gc.s.monsterhunt.ms + gc.ping + Task.Constants.Timeouts.HUNT_OFFSET;
	}
	// Go and take the monsterhunt quest.
	const mode = self.mode;
	self.mode = BotMode.Idle;

	await new Promise<void>(async (resolve, reject) => {
		self.log("On the way to start a quest", LogLevel.INFO);
		TaskLauncher.stop(Task.move, self);
		if (gc.smartMoving) await gc.stopSmartMove().catch(reject);
		await gc.smartMove("monsterhunter").catch(reject);
		await gc.getMonsterHuntQuest().catch(reject);
		resolve();
	}).catch(e => { throw new Error(e.message) }).finally(() => {
		self.mode = mode;
		TaskLauncher.restart(Task.move, self, Task.Constants.Timeouts.MOVE);
	});
	return timeout;
}

export async function hunt_finish<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	if (gc.rip) return timeout;

	const mhunt = gc.s.monsterhunt;
	if (mhunt === undefined || mhunt.c !== 0) return timeout;

	const mode = self.mode;

	await new Promise<void>(async (resolve, reject) => {
		self.mode = BotMode.Idle;
		TaskLauncher.stop(Task.move, self);
		if (gc.smartMoving) await gc.stopSmartMove().catch(reject);
		await gc.smartMove("monsterhunter").catch(reject);
		await gc.finishMonsterHuntQuest().catch(reject);

		self.log("Monster hunt completed!", LogLevel.INFO);
		TaskLauncher.restart(hunt_start, self, Task.Constants.Timeouts.HUNT_START);
		timeout = timeout + Task.Constants.Timeouts.HUNT_OFFSET;
		self.targets = Config.get_config<MonsterName[]>("targets") ?? [];
		resolve();
	}).catch(e => { throw new Error(e.message) }).finally(() => {
		self.mode = mode;
		TaskLauncher.restart(Task.move, self, Task.Constants.Timeouts.MOVE);
	});
	return timeout;
}
