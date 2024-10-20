import { ChestLootData, ItemName } from "alclient";
import { Bot } from "../classes/bot.js";
import { LogLevel } from "../utils/logger.js";

export async function loot<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();
	if (gc.chests.size === 0) return timeout;

	for (const [, chest] of gc.chests) {
		// if we don't have enough slots, skip the chest
		if (gc.esize - chest.items < 0) continue;

		// open the chest
		const content = await gc.openChest(chest.id) as ChestLootData;

		// log golds
		if (content.gold !== undefined)
			self.log(`Got ${content.gold} golds`, LogLevel.GOLD);

		// filter out items that are not looted by us
		content.items = content.items?.filter(i => i.looter === gc.id);
		// log them
		for (const item of content.items ?? []) {
			const item_name = self.gc().G.items[item.name as ItemName].name;
			self.log(`Got ${item_name} x${item.q ?? 1}`, LogLevel.LOOT);
		}
	}
	return timeout;
}
