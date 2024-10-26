import { MonsterName } from "alclient";
// import Config from "../utils/config.js";
import { LogLevel } from "../utils/logger.js";
import { Bot, BotMode, BotState, BotType } from "./bot.js";

export class BotRanger extends Bot {
	constructor(id: string | undefined) {
		if (id === undefined)
			throw new Error("Ranger ID is not defined");
		super(id, BotType.Ranger);
	}

	public get_targets(): MonsterName[] {
		return ["croc", "phoenix"];
		// return Config.get_config<MonsterName[]>("targets") ?? [];
	}

	async run(): Promise<void> {
		await super.run(() => {
			this.is_leader = true;
			this.targets = this.get_targets();
			this.mode = BotMode.Running;
			this.state = BotState.ATTACKING;
		}).catch(e => this.log(e.message, LogLevel.ERROR));
	}
}
