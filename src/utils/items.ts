import AL, { ItemData, ItemName, PingCompensatedCharacter } from "alclient";
import { Bot } from "../classes/bot.js";

type LocateItemsByLevelOptions = {
	exclude_specials?: boolean;
	exclude_locked?: boolean;
	only?: "compoundable" | "upgradable";
	min_amount?: number;
};

export type ItemByLevels = Record<ItemName, Record<number, number[]>>;

export function locate_items_by_level(
	self: Bot,
	options: LocateItemsByLevelOptions = {}
): Record<ItemName, Record<number, number[]>> {
	const inv = self.gc().items.map((i, index) => {
		if (i === null) return undefined;
		if (options.exclude_specials && i.p !== undefined) return undefined;
		if (options.exclude_locked && i.l !== undefined) return undefined;
		if (i.level === undefined) return undefined;
		const citem = self.iconfig.get_item(i.name as ItemName);
		if (citem === undefined) return undefined;
		if (options.only === "compoundable" && citem.options.should_compound === false) return undefined;
		if (options.only === "upgradable" && citem.options.should_upgrade === false) return undefined;
		if (citem.options.improve_to && i.level >= citem.options.improve_to) return undefined;
		return { slot: index, data: i };
	}).filter((i) => i !== undefined) as { slot: number, data: ItemData }[];

	// Merge items with the same level and store each of their slot number.
	const merged: ItemByLevels = {} as ItemByLevels;
	for (const i of inv) {
		const name = i.data.name as ItemName;
		const level = i.data.level as number;
		if (merged[name] === undefined) merged[name] = {};
		if (merged[name][level] === undefined) merged[name][level] = [];
		merged[name][level].push(i.slot);
	}

	// Filter out items that do not meet the minimum amount requirement.
	if (options.min_amount !== undefined) {
		for (const name in merged as ItemByLevels) {
			for (const level in merged[name as ItemName])
				if (merged[name as ItemName][level].length < options.min_amount)
					delete merged[name as ItemName][level];
			if (Object.keys(merged[name as ItemName]).length === 0) delete merged[name as ItemName];
		}
	}
	return merged;
}

export function calculate_item_grade(item: ItemData): number {
	const grades = AL.Game.G.items[item.name as ItemName].grades;
	for (let i = (grades ?? [9, 10, 11, 12]).length - 1; i >= 0; i--)
		if (item.level! >= (grades ?? [9, 10, 11, 12])[i]) return i + 1;
	return 0;
}

export function get_qscroll_to_buy(gc: PingCompensatedCharacter, slots: number, scroll_name: ItemName): number {
	let q_to_buy = slots;
	const scroll_slot = gc.locateItem(scroll_name);
	if (scroll_slot !== -1) {
		const scroll_q = gc.items[scroll_slot]?.q ?? 0;
		if (scroll_q < q_to_buy)
			q_to_buy = q_to_buy - scroll_q;
	}
	return q_to_buy;
}

export default { locate_items_by_level, calculate_item_grade, get_qscroll_to_buy };
