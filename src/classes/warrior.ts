import { Warrior as GameWarrior, MonsterName } from "alclient";
import { config as Config } from "../utils/config.js";
import * as Logger from "../utils/logger.js";
import { Bot, BotMode } from "./bot.js";

export class Warrior extends Bot {
	constructor(id: string) {
		super(id, Logger.ClassType.WARRIOR);
	}

	protected gc(): GameWarrior {
		return super.gc() as GameWarrior;
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
