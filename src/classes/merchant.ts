import { ItemName } from "alclient";
import { LogLevel } from "../utils/logger.js";
import { Bot, BotMode, BotState, BotType } from "./bot.js";

export class BotMerchant extends Bot {
	constructor(id: string | undefined) {
		if (id === undefined)
			throw new Error("Merchant ID is not defined");
		super(id, BotType.Merchant);
		this.set_personal_iconfig();
	}

	private set_personal_iconfig() {
		let tracker_slot = this.iconfig.get_item("tracker").storage.storage_slot ?? 39;

		const locked_items: ItemName[] = ["stand0", "scroll0", "cscroll0", "scroll1", "cscroll1"];
		for (const item of locked_items) {
			if (tracker_slot - 1 > 0)
				this.iconfig.update_item(item, {}, { storage_slot: tracker_slot-- });
		}
	}

	async run(): Promise<void> {
		await super.run(() => {
			this.mode = BotMode.Running;
			this.state = BotState.NONE;
		}).catch(e => this.log(e.message, LogLevel.ERROR));
	}
}
