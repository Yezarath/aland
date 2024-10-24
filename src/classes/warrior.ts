import { MonsterName } from "alclient";
import Config from "../utils/config.js";
import { LogLevel } from "../utils/logger.js";
import { Bot, BotMode, BotState, BotType } from "./bot.js";

export class BotWarrior extends Bot {
	constructor(id: string | undefined) {
		if (id === undefined)
			throw new Error("Warrior ID is not defined");
		super(id, BotType.Warrior);
	}

	async run(): Promise<void> {
		await super.run(() => {
			this.targets = Config.get_config<MonsterName[]>("targets") ?? [];
			this.mode = BotMode.Running;
			this.state = BotState.ATTACKING;
		}).catch(e => this.log(e.message, LogLevel.ERROR));
	}
}
