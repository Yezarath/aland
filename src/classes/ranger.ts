import { Ranger as GameRanger, MonsterName } from "alclient";
import { config as Config } from "../utils/config.js";
import * as Logger from "../utils/logger.js";
import { Bot, BotMode } from "./bot.js";

export class Ranger extends Bot {
	constructor(id: string) {
		super(id, Logger.ClassType.RANGER);
	}

	protected gc(): GameRanger {
		return super.gc() as GameRanger;
	}

	async run(): Promise<void> {
		try {
			// setInterval(function run(self) {
			// }, 60000, this);
			await super.run(() => {
				this.is_pleader = true;
				this.targets = Config.get_config<MonsterName[]>("targets");
				this.mode = BotMode.Attack;
				this.set_attack_loop(10);
			});
		} catch (e) {
			this.log(e.message, Logger.LogLevel.ERROR);
		}
	}
}
