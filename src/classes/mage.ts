import { Mage as GameMage, MonsterName } from "alclient";
import { config as Config } from "../utils/config.js";
import * as Logger from "../utils/logger.js";
import { Bot, BotMode } from "./bot.js";

export class Mage extends Bot {
	constructor(id: string) {
		super(id, Logger.ClassType.MAGE);
	}

	protected gc(): GameMage {
		return super.gc() as GameMage;
	}

	async run(): Promise<void> {
		try {
			await super.run(() => {
				this.targets = Config.get_config<MonsterName[]>("targets");
				// this.targets = ["minimush"];
				this.mode = BotMode.Attack;
				this.set_attack_loop(10);
			});
		} catch (e) {
			this.log(e.message, Logger.LogLevel.ERROR);
		}
	}
}
