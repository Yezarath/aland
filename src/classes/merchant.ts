import { Merchant as GameMerchant } from "alclient";
import { LogLevel } from "../utils/logger.js";
import { Bot, BotMode, BotType } from "./bot.js";

export class Merchant extends Bot {
	constructor(id: string | undefined) {
		if (id === undefined)
			throw new Error("Merchant ID is not defined");
		super(id, BotType.Merchant);
	}

	public gc(): GameMerchant {
		return super.gc() as GameMerchant;
	}

	async run(): Promise<void> {
		await super.run(() => {
			this.mode = BotMode.Sulking;
		}).catch(e => this.log(e.message, LogLevel.ERROR));
	}
}
