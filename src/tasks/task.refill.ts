import AL from 'alclient';
import { Bot, BotState } from "../classes/bot.js";
import Task from '../tasks/task.js';
import CaughtPromise from '../utils/caught_promise.js';
import { LogLevel } from "../utils/logger.js";
import { sleep } from '../utils/sleep.js';

export async function refill<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	if (!self.is_state(BotState.ATTACKING) && !self.is_state(BotState.NONE)) return timeout;
	if (gc.rip || gc.c.town) return timeout;

	const hpn = Task.Constants.Basics.HPOT_TYPE;
	const mpn = Task.Constants.Basics.MPOT_TYPE;

	const hpq = gc.countItem(hpn);
	const mpq = gc.countItem(mpn);

	if (hpq > Task.Constants.Basics.MIN_HPOT && mpq > Task.Constants.Basics.MIN_MPOT)
		return timeout;

	const state = self.state;
	await CaughtPromise(async () => {
		self.state = BotState.REFILL;
		if (gc.smartMoving) await gc.stopSmartMove();

		const hpot_tob = Task.Constants.Basics.HPOT_TO_REFILL - hpq;
		const hpot_cost = gc.G.items[hpn].g * hpot_tob;
		const mpot_tob = Task.Constants.Basics.MPOT_TO_REFILL - mpq;
		const mpot_cost = gc.G.items[mpn].g * mpot_tob;

		if (gc.gold >= hpot_cost && hpot_tob > 0) {
			await gc.smartMove(hpn, {
				getWithin: AL.Constants.NPC_INTERACTION_DISTANCE / 2
			});
			await gc.buy(Task.Constants.Basics.HPOT_TYPE, hpot_tob);
			self.log(`Bought x${hpot_tob} ${hpn} for ${hpot_cost}g`, LogLevel.EVENT);
		}
		// Might not be the same refill npc ? don't know yet, might delete later.
		if (gc.gold >= mpot_cost && mpot_tob > 0) {
			await gc.smartMove(mpn, {
				getWithin: AL.Constants.NPC_INTERACTION_DISTANCE / 2
			});
			await gc.buy(Task.Constants.Basics.MPOT_TYPE, mpot_tob);
			self.log(`Bought x${mpot_tob} ${mpn} for ${mpot_cost}g`, LogLevel.EVENT);
		}
		timeout = Task.Constants.Timeouts.NEXT_REFILL;
	}).catch(e => { throw new Error(e.message) }).finally(async () => {
		await sleep(Task.Constants.Timeouts.STATE_RELEASE);
		self.state = state;
	});
	return timeout;
}
