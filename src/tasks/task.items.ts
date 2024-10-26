import AL, { ItemData, ItemName } from 'alclient';
import { Bot, BotState } from '../classes/bot.js';
import Task from '../tasks/task.js';
import CaughtPromise from '../utils/caught_promise.js';
import { LogLevel } from '../utils/logger.js';
import { sleep } from '../utils/sleep.js';
import { verySmartMove } from '../utils/very_smart_move.js';

// task auto sell items ?? or doing something else ?? will see later
// might do the share stackable idems with other bots in there
export async function items<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	if (gc.rip) return timeout;
	if (!self.is_state(BotState.ATTACKING) && !self.is_state(BotState.NONE)) return timeout;

	// Check stackable items in inventory.
	// If they are shareable, try to move them to the other bots.
	// const others = self.bots.filter(bot => bot !== self);
	// const stackable = gc.items.filter((i: ItemData | null) => {
	// 	if (i === null) return false;
	// 	return AL.Game.G.items[i.name as ItemName].s !== undefined;
	// });

	// self.log({
	// 	message: "Checking stackable items",
	// 	data: stackable
	// });


	// Auto Sell Items
	// AGAIN, maybe another task for this
	if (!self.is_state(BotState.ATTACKING) && !self.is_state(BotState.NONE)) return timeout;
	if (gc.isFull() || self.is_state(BotState.NONE)) {
		const can_sell = self.iconfig.get_items({ should_sell: true });
		const to_sell = gc.items.map((i: ItemData | null, index: number) => {
			if (i) {
				const opt = self.iconfig.get_item(i.name as ItemName).options;
				// Check if the item is titled, if it is and we should not ignored titled items, skip it.
				if (i.p !== undefined && !opt.ignore_titled) return undefined;
				// Check if the item has a level, if it does and we should not ignore level items, skip it.
				if (i.level !== undefined && i.level > 0 && !opt.ignore_level) return undefined;
				if (can_sell.includes(i.name as ItemName)) return { slot: index, data: i };
			}
			return undefined;
		}).filter((i) => i !== undefined);
		if (to_sell.length === 0) return timeout;

		const state = self.state;
		await CaughtPromise(async () => {
			self.state = BotState.SELLING;
			await verySmartMove(self, Task.Constants.Basics.HPOT_TYPE, {
				getWithin: AL.Constants.NPC_INTERACTION_DISTANCE / 2
			});
			for (const i of to_sell) {
				await gc.sell(i.slot, i.data.q ?? 1);
				const gitem = AL.Game.G.items[i.data.name as ItemName];
				const value = gitem.g * (i.data.q ?? 1) * AL.Game.G.multipliers.buy_to_sell;
				self.log(`Sold x${i.data.q ?? 1} ${gitem.name} for ${value} gold`, LogLevel.EVENT);
			}
		}).catch(e => { throw new Error(e.message) }).finally(async () => {
			await sleep(Task.Constants.Timeouts.STATE_RELEASE);
			self.state = state;
		});
	}
	return timeout;
}
