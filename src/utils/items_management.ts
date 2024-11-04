import AL, { GItem, ItemName } from "alclient";
import { Bot } from "../classes/bot.js";

// Can be changed
/**
 * -- those are mutually exclusive --
 * @property {boolean} should_sell if true, the item will be sold automatically to npc
 * @property {boolean} should_msell if true, the item will be sold in the merchant stand
 * @property {boolean} should_upgrade if true, the item will be upgraded automatically
 * @property {boolean} should_compound if true, the item will be compounded automatically
 * -- /those are mutually exclusive --
 * @property {boolean} ignore_titled if true, the title will be ignored when npc selling/upgrading/compounding
 * @property {boolean} ignore_level if true, the level will be ignored when npc selling
 * @property {number} msell_at if should_msell is true, the amount to sell at
 * @property {number} improve_to if should_upgrade/compound is true, the maximum level to improve to
 */

// Can be changed

const mutually_exclusive_item_options = [
	"should_sell", "should_msell", "should_upgrade", "should_compound"
] as const;
type MutuallyExclusiveItemOptions = typeof mutually_exclusive_item_options[number];
type MandatoryItemOptions = MutuallyExclusiveItemOptions | "ignore_titled" | "ignore_level";
type OptionalItemOptions = "msell_at" | "improve_to";

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

	static readonly #DEF_OPTIONS: ItemOptions = {
		should_sell: false, should_msell: false, should_upgrade: false, should_compound: false,
		ignore_titled: false, ignore_level: false
	} as const;
	static readonly #DEF_STORAGE: ItemStorage = {
		storage_place: "inventory", storage_slot: undefined
	} as const;

	static readonly #DEF_UPGRADE_TO = 5;
	static readonly #DEF_COMPOUND_TO = 2;

	constructor(bot: Bot) {
		if (!(bot instanceof Bot)) throw new Error("Invalid bot instance!");
		if (!AL.Game.G) throw new Error("Game data not loaded!");

		Object.entries(AL.Game.G.items).forEach(([iname, idata]: [string, GItem]) => {
			const supgr = idata.upgrade !== undefined ? true : false;
			const scomp = idata.compound !== undefined ? true : false;
			const imp_to = (!supgr && !scomp) ? undefined : {
				should_upgrade: supgr,
				should_compound: scomp,
				improve_to: supgr ? ItemsManagement.#DEF_UPGRADE_TO : ItemsManagement.#DEF_COMPOUND_TO
			}
			this.#items[iname as ItemName] = {
				data: idata,
				storage: { ...ItemsManagement.#DEF_STORAGE },
				options: { ...ItemsManagement.#DEF_OPTIONS, ...imp_to }
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
		this.update_item("gslime", { should_sell: true }, { storage_place: "none" });

		this.update_item("throwingstars", { should_sell: true }, { storage_place: "none" });
		this.update_item("pmaceofthedead", { should_sell: true }, { storage_place: "none" });
		this.update_item("bowofthedead", { should_sell: true }, { storage_place: "none" });
		this.update_item("staffofthedead", { should_sell: true }, { storage_place: "none" });
		this.update_item("phelmet", { should_sell: true }, { storage_place: "none" });
		this.update_item("skullamulet", { should_sell: true }, { storage_place: "none" });
		this.update_item("gphelmet", { should_sell: true }, { storage_place: "none" });
		this.update_item("lantern", { should_sell: true }, { storage_place: "none" });
		this.update_item("smoke", { should_sell: true }, { storage_place: "none" });

		// Set the items to be placed at specific slots in the inventory. Not yet implemented.
		this.update_item("hpot0", {}, { storage_slot: 41 });
		this.update_item("mpot0", {}, { storage_slot: 40 });
		this.update_item("tracker", {}, { storage_slot: 39 });


		// Auto Upgrade items =
		// -- Armors -- T1
		this.update_item("helmet", { improve_to: 8 });
		this.update_item("shoes", { improve_to: 8 });
		this.update_item("pants", { improve_to: 8 });
		this.update_item("gloves", { improve_to: 8 });
		this.update_item("coat", { improve_to: 8 });

		// -- Armors -- T1*
		// this.update_item("wattire", { improve_to: 8 });
		// this.update_item("wgloves", { improve_to: 8 });
		// this.update_item("wbreeches", { improve_to: 8 });
		// this.update_item("wshoes", { improve_to: 8 });
		// this.update_item("wcap", { improve_to: 8 });
		this.update_item("wattire", { should_sell: true }, { storage_place: "none" });
		this.update_item("wgloves", { should_sell: true }, { storage_place: "none" });
		this.update_item("wbreeches", { should_sell: true }, { storage_place: "none" });
		this.update_item("wshoes", { should_sell: true }, { storage_place: "none" });
		this.update_item("wcap", { should_sell: true }, { storage_place: "none" });

		// -- Wearpons --
		this.update_item("bow", { improve_to: 8 });
		this.update_item("hbow", { improve_to: 7 });
		this.update_item("mushroomstaff", { improve_to: 8 });
		this.update_item("stinger", { improve_to: 6 });
		this.update_item("broom", { improve_to: 6 });
		this.update_item("rod", { improve_to: 5 });

		this.update_item("fireblade", { improve_to: 7 });
		this.update_item("firebow", { improve_to: 7 });
		this.update_item("firestaff", { improve_to: 7 });

		// -- Offhands --
		this.update_item("quiver", { improve_to: 8 });
		this.update_item("wbook0", { improve_to: 4 });


		// Auto Compound items =
		// -- Amulet --
		this.update_item("intamulet", { improve_to: 4 });
		this.update_item("stramulet", { improve_to: 3 });
		this.update_item("dexamulet", { improve_to: 3 });

		// -- Belt --
		this.update_item("intbelt", { improve_to: 2 });
		this.update_item("strbelt", { improve_to: 3 });
		this.update_item("dexbelt", { improve_to: 3 });

		// -- Earrings --
		this.update_item("strearring", { improve_to: 2 });
		this.update_item("dexearring", { improve_to: 2 });
		this.update_item("intearring", { improve_to: 2 });

		// -- Rings --
		this.update_item("ringsj", { /*improve_to: 4,*/ should_sell: true });
		this.update_item("strring", { improve_to: 4 });
		this.update_item("dexring", { improve_to: 3 });
		this.update_item("intring", { improve_to: 3 });

		// -- Capes --

		// -- Orbs --
		this.update_item("orbg", { improve_to: 3 });
		this.update_item("jacko", { improve_to: 3 });
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
