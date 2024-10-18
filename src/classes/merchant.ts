import { Merchant as GameMerchant } from "alclient";
import * as Logger from "../utils/logger.js";
import { Bot } from "./bot.js";

export class Merchant extends Bot {
	constructor(id: string) {
		super(id, Logger.ClassType.MERCHANT);
	}

	protected gc(): GameMerchant {
		return super.gc() as GameMerchant;
	}

	async run(): Promise<void> {
		try {
			await super.run(() => {
				// this.is_pleader = true;
				// this.gc().timeouts.set("disconnect20s", setTimeout((self) => {
				// 	self.log("30s, disconnecting!", Logger.LogLevel.INFO);
				// 	self.gc().disconnect();
				// }, 30000, this));
			});
		} catch (e) {
			this.log(e.message, Logger.LogLevel.ERROR);
		}
	}
}
