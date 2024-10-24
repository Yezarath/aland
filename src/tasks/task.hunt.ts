import { MonsterName } from "alclient";
import { Bot, BotState } from "../classes/bot.js";
import CaughtPromise from "../utils/caught_promise.js";
import Config from "../utils/config.js";
import { LogLevel } from "../utils/logger.js";
import { sleep } from "../utils/sleep.js";
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
		self.log(`Quest target is '${gc.s.monsterhunt.id}'`, LogLevel.EVENT);
		if (ids.includes(gc.s.monsterhunt.id)) {
			self.log({
				message: 'ID allowed, Monster hunt started!',
				data: { duration: gc.s.monsterhunt.ms, quantity: gc.s.monsterhunt.c }
			}, LogLevel.EVENT);
			self.targets = [gc.s.monsterhunt.id];
			TaskLauncher.restart(hunt_finish, self, Task.Constants.Timeouts.HUNT_FINISH);
		} else self.log("ID not allowed, Monster hunt ignored!", LogLevel.EVENT);
		return gc.s.monsterhunt.ms + gc.ping + Task.Constants.Timeouts.HUNT_OFFSET;
	}
	// Go and take the monsterhunt quest.
	if (!self.is_state(BotState.ATTACKING)) return timeout;

	const state = self.state;
	self.state = BotState.TAKE_QUEST;
	await CaughtPromise(async () => {
		if (gc.smartMoving) await gc.stopSmartMove();
		await gc.smartMove("monsterhunter");
		await gc.getMonsterHuntQuest();
		self.log("Monster hunt quest taken!", LogLevel.EVENT);
	}).catch(e => { throw new Error(e.message) }).finally(async () => {
		await sleep(Task.Constants.Timeouts.STATE_RELEASE);
		self.state = state;
	});
	return timeout + gc.ping;
}

export async function hunt_finish<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	if (gc.rip) return timeout;

	const mhunt = gc.s.monsterhunt;
	if (mhunt === undefined || mhunt.c !== 0) return timeout;

	if (!self.is_state(BotState.ATTACKING)) return timeout;

	const state = self.state;
	self.state = BotState.END_QUEST;
	await CaughtPromise(async () => {
		if (gc.smartMoving) await gc.stopSmartMove();
		await gc.smartMove("monsterhunter");
		await gc.finishMonsterHuntQuest();

		self.log("Monster hunt completed!", LogLevel.EVENT);
		TaskLauncher.restart(hunt_start, self, Task.Constants.Timeouts.HUNT_START);
		timeout = timeout + Task.Constants.Timeouts.HUNT_OFFSET;
		self.targets = Config.get_config<MonsterName[]>("targets") ?? [];
	}).catch(e => { throw new Error(e.message) }).finally(async () => {
		await sleep(Task.Constants.Timeouts.STATE_RELEASE);
		self.state = state;
	});
	return timeout;
}
