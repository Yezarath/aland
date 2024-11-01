import { ItemName, Merchant } from "alclient";
import { Bot, BotState, BotType } from "../classes/bot.js";
import CaughtPromise from "../utils/caught_promise.js";
import { chunk } from "../utils/chunk.js";
import Items from "../utils/items.js";
import { LogLevel } from '../utils/logger.js';
import { sleep } from "../utils/sleep.js";

export async function auto_compound<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();
	if (!self.is_state(BotState.NONE) || gc.rip) return timeout;
	if (self.bot_type !== BotType.Merchant) return timeout;
	if (gc.isCompounding()) return timeout;

	const compoundables = Items.locate_items_by_level(self, {
		exclude_locked: true,
		exclude_specials: true,
		min_amount: 3,
		only: "compoundable"
	});
	const state = self.state;
	await CaughtPromise(async () => {
		self.state = BotState.POSITIONING;
		if (gc.smartMoving) await gc.stopSmartMove();
		await gc.smartMove({ map: "main", x: -142, y: -144 });
	}).finally(() => { self.state = state });
	mloop: for (const [iname, ilevels] of Object.entries(compoundables)) {
		for (const [level, slots] of Object.entries(ilevels)) {
			const item = gc.items[slots[0]];
			if (item === null) continue;
			const scroll_name: ItemName = `cscroll${Items.calculate_item_grade(item)}` as ItemName;
			if (scroll_name === "cscroll2") continue;
			const q_to_buy = Items.get_qscroll_to_buy(gc, Math.floor(slots.length / 3), scroll_name);
			if (q_to_buy > 0) {
				await gc.buy(scroll_name, q_to_buy);
				self.log(`Bought x${q_to_buy} ${scroll_name}`, LogLevel.INFO);
			}
			const scroll_slot = gc.locateItem(scroll_name);
			if (scroll_slot === -1) {
				self.log(`Failed to buy ${scroll_name}`, LogLevel.ERROR);
				continue mloop;
			}
			const chunked_slots = chunk<number>(slots, 3)
			for (const chunk of chunked_slots) {
				if (chunk.length < 3) continue;
				if (gc.isOnCooldown("massproduction")) await sleep(gc.getCooldown("massproduction") + gc.ping);
				await self.gc<Merchant>().massProduction();
				await gc.compound(chunk[0], chunk[1], chunk[2], scroll_slot).then((success: boolean) => {
					if (success)
						self.log(`Compounded ${iname} to level ${parseInt(level) + 1}!`, LogLevel.EVENT);
					else
						self.log(`Failed to compound ${iname} to level ${parseInt(level) + 1}`, LogLevel.EVENT_KO);
				});
			}
		}
	}
	return timeout;
}
