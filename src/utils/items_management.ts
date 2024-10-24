import AL, { GItem, ItemName } from "alclient";
import { Bot } from "../classes/bot.js";

// Can be changed
/**
 * -- those are mutually exclusive --
 * @property {boolean} should_sell if true, the item will be sold automatically to npc
 * @property {boolean} should_msell if true, the item will be sold in the merchant stand
 * @property {boolean} should_upgrade if true, the item will be upgraded automatically
 * -- /those are mutually exclusive --
 * @property {boolean} ignore_titled if true, the title will be ignored when npc selling/upgrading
 * @property {boolean} ignore_level if true, the level will be ignored when npc selling
 * @property {number} msell_at if should_msell is true, the amount to sell at
 * @property {number} upgrade_to if should_upgrade is true, the maximum level to upgrade to
 */

// Can be changed

const mutually_exclusive_item_options = ["should_sell", "should_msell", "should_upgrade"] as const;
type MutuallyExclusiveItemOptions = typeof mutually_exclusive_item_options[number];
type MandatoryItemOptions = MutuallyExclusiveItemOptions | "ignore_titled" | "ignore_level";
type OptionalItemOptions = "msell_at" | "upgrade_to";

export type ItemOptions = {
	[P in MandatoryItemOptions]: boolean
} & {
	[P in OptionalItemOptions]?: number
}

export type ItemOptionsFilter = {
	[P in MandatoryItemOptions]?: boolean
}

export type ItemOptionsUpdate = {
	[P in MandatoryItemOptions]?: boolean
} & {
	[P in OptionalItemOptions]?: number
}

// Can be changed
export type ItemStorage = {
	storage_place: "inventory" | "bank" | "none",
	storage_slot: number | undefined
}

export type ItemStorageFilter = {
	[K in keyof ItemStorage]?: ItemStorage[K]
}

export type ItemStorageUpdate = {
	[K in keyof ItemStorage]?: ItemStorage[K]
}

export type ItemInfo = {
	data: GItem,
	options: ItemOptions,
	storage: ItemStorage
};

export class ItemsManagement {
	#items: Record<ItemName, ItemInfo> = {} as Record<ItemName, ItemInfo>;

	static readonly DEF_OPTIONS: ItemOptions = {
		should_sell: false, should_msell: false, should_upgrade: false,
		ignore_titled: false, ignore_level: false
	} as const;
	static readonly DEF_STORAGE: ItemStorage = {
		storage_place: "inventory", storage_slot: undefined
	} as const;

	constructor(bot: Bot) {
		if (!(bot instanceof Bot)) throw new Error("Invalid bot instance!");
		if (!AL.Game.G) throw new Error("Game data not loaded!");

		Object.entries(AL.Game.G.items).forEach(([iname, idata]: [string, GItem]) => {
			this.#items[iname as ItemName] = {
				data: idata,
				storage: { ...ItemsManagement.DEF_STORAGE },
				options: { ...ItemsManagement.DEF_OPTIONS }
			};
		});
		this.load_defaults();
	}

	// Might move this inside a json and then load it ? will see
	private load_defaults() {
		// Set the items to be sold automatically. Do not keep it in the inventory.
		this.update_item("hpbelt", { should_sell: true, ignore_titled: true }, { storage_place: "none" });
		this.update_item("hpamulet", { should_sell: true, ignore_titled: true }, { storage_place: "none" });
		this.update_item("whiteegg", { should_sell: true, ignore_titled: true }, { storage_place: "none" });
		this.update_item("vitearring", { should_sell: true, ignore_titled: true }, { storage_place: "none" });
		this.update_item("vitring", { should_sell: true, ignore_titled: true }, { storage_place: "none" });
		this.update_item("phelmet", { should_sell: true }, { storage_place: "none" });
		this.update_item("gslime", { should_sell: true }, { storage_place: "none" });

		// Maybe temp, need to compund those, they are nice.
		this.update_item("ringsj", { should_sell: true }, { storage_place: "none" });

		// Set the items to be placed at specific slots in the inventory. Not yet implemented.
		this.update_item("hpot0", {}, { storage_slot: 41 });
		this.update_item("mpot0", {}, { storage_slot: 40 });
		this.update_item("tracker", {}, { storage_slot: 39 });
	}

	public set_item(iname: ItemName, options: ItemOptions, storage: ItemStorage) {
		if (!this.#items[iname]) throw new Error(`Item '${iname}' not found!`);
		this.#items[iname].options = { ...options };
		this.#items[iname].storage = { ...storage };
	}

	public get_item(iname: ItemName): ItemInfo {
		if (!this.#items[iname]) throw new Error(`Item '${iname}' not found!`);
		return this.#items[iname];
	}

	public get_items(opt: ItemOptionsFilter): ItemName[] {
		return Object.entries(this.#items).filter(([, i]) => {
			return !(Object.keys(opt) as (keyof ItemOptionsFilter)[]).some(o =>
				(opt[o] !== undefined && i.options[o] !== opt[o])
			);
		}).map(([iname]) => iname as ItemName);
	}

	public update_item(iname: ItemName, options?: ItemOptionsUpdate, storage?: ItemStorageUpdate) {
		if (!this.#items[iname]) throw new Error(`Item '${iname}' not found!`);
		if (options) {
			if (mutually_exclusive_item_options.filter(option => options[option]).length > 1)
				throw new Error("More than one mutually exclusive option is set!");
			// Unset mutually exclusive options
			this.#items[iname].options = { ...this.#items[iname].options, ...options };
			mutually_exclusive_item_options.forEach(option => {
				if (options[option]) mutually_exclusive_item_options.forEach(other => {
					if (other !== option) this.#items[iname].options[other] = false;
				});
			});
		}
		if (storage) this.#items[iname].storage = { ...this.#items[iname].storage, ...storage };
	}

}
