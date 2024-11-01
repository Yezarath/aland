import { MonsterName } from "alclient";
import Config from "../utils/config.js";
import { LogLevel } from "../utils/logger.js";
import { Bot, BotMode, BotState, BotType } from "./bot.js";

export class BotMage extends Bot {
	constructor(id: string | undefined) {
		if (id === undefined)
			throw new Error("Mage ID is not defined");
		super(id, BotType.Mage);
	}

	public get_targets(): MonsterName[] {
		// return ["porcupine", "phoenix"];
		// return ["bat", "phoenix"];
		return Config.get_config<MonsterName[]>("targets") ?? [];
	}

	async run(): Promise<void> {
		await super.run(() => {
			this.targets = this.get_targets();
			this.mode = BotMode.Running;
			this.state = BotState.ATTACKING;
		}).catch(e => this.log(e.message, LogLevel.ERROR));
	}
}
