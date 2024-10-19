import { Mage as GameMage, MonsterName } from "alclient";
import Config from "../utils/config.js";
import { LogLevel } from "../utils/logger.js";
import { Bot, BotMode, BotType } from "./bot.js";

export class Mage extends Bot {
	constructor(id: string | undefined) {
		if (id === undefined)
			throw new Error("Mage ID is not defined");
		super(id, BotType.Mage);
	}

	public gc(): GameMage {
		return super.gc() as GameMage;
	}

	async run(): Promise<void> {
		try {
			await super.run(() => {
				this.targets = Config.get_config<MonsterName[]>("targets") ?? [];
				this.mode = BotMode.Attack;
				// this.set_attack_loop(10);
			});
		} catch (e) {
			this.log(e.message, LogLevel.ERROR);
		}
	}
}
