import { LogLevel } from "../utils/logger.js";
import { Bot, BotMode, BotType } from "./bot.js";

export class BotMerchant extends Bot {
	constructor(id: string | undefined) {
		if (id === undefined)
			throw new Error("Merchant ID is not defined");
		super(id, BotType.Merchant);
	}

	async run(): Promise<void> {
		await super.run(() => {
			this.mode = BotMode.Sulking;
		}).catch(e => this.log(e.message, LogLevel.ERROR));
	}
}
