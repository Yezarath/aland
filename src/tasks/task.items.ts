import AL, { ItemData, ItemName } from 'alclient';
import { Bot, BotState, BotType } from '../classes/bot.js';
import Task from '../tasks/task.js';
import CaughtPromise from '../utils/caught_promise.js';
import Items from "../utils/items.js";
import { LogLevel } from '../utils/logger.js';
import { sleep } from '../utils/sleep.js';
import { verySmartMove } from '../utils/very_smart_move.js';

// task auto sell items ?? or doing something else ?? will see later
// might do the share stackable idems with other bots in there
export async function items<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	if (gc.rip) return timeout;
	if (!self.is_state(BotState.ATTACKING) && !self.is_state(BotState.NONE)) return timeout;

	// Auto Sell Items
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
		const improvable = Object.entries(Items.locate_items_by_level(self, {
			exclude_locked: true,
			exclude_specials: true,
			min_amount: 1,
		}));
		if (to_sell.length === 0 && improvable.length === 0) return timeout;

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
			if (self.bot_type !== BotType.Merchant && improvable.length > 0) {
				const merchant = self.bots.find(bot => bot.bot_type === BotType.Merchant);
				if (!merchant) return;

				await gc.smartMove({ map: merchant.gc().map, x: merchant.gc().x, y: merchant.gc().y });
				// This part should be changed to deposit in the gold bank.
				const g_to_send = Math.max(1, gc.gold - 50000);
				if (g_to_send > 0) await gc.sendGold(merchant.id, g_to_send).then(() => {
					self.log(`Sent '${g_to_send} gold' to '${merchant.id}'`, LogLevel.EVENT);
				}).catch(() => { });
				// this part should be changed to deposit in the bank.
				// stackable first then non stackable
				for (const [, item] of improvable) {
					for (const [, slots] of Object.entries(item)) {
						for (const slot of slots) {
							const i = gc.items[slot];
							if (!i) continue;
							const gi = AL.Game.G.items[i.name as ItemName];
							await gc.sendItem(merchant?.id, slot, i.q ?? 1).then(async () => {
								self.log(`Sent x${i.q ?? 1} '${gi?.name ?? i.name}' to '${merchant?.id}'`, LogLevel.EVENT);
								await sleep(50);
							}).catch(() => { });
						}
					}
				}
			}
		}).catch(e => { throw new Error(e.message) }).finally(async () => {
			await sleep(Task.Constants.Timeouts.STATE_RELEASE);
			self.state = state;
		});
	}
	return timeout;
}
