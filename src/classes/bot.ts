import AL, {
	PingCompensatedCharacter as GameCharacter,
	MonsterName,
	ServerIdentifier, ServerRegion
} from 'alclient';
import TaskLauncher from '../tasks/launcher.js';
import Task from '../tasks/task.js';
import Config from '../utils/config.js';
import Logger, { LogLevel } from "../utils/logger.js";
import { sleep } from '../utils/sleep.js';

export enum BotMode {
	Idle,
	Attack
}

export enum BotType {
	System,
	Merchant,
	Warrior,
	Mage,
	Ranger,
	Priest,
	Paladin,
	Rogue
}

export abstract class Bot {
	#id: string;
	#server_region: ServerRegion | undefined;
	#server_identifier: ServerIdentifier | undefined;
	#bot_type: BotType;
	#gc!: GameCharacter;

	is_started = false;
	#mode = BotMode.Idle;
	#targets: MonsterName[];
	#is_leader: boolean = false;

	constructor(
		id: string,
		bot_type: BotType
	) {
		this.#is_leader = false;
		this.#id = id;
		this.#bot_type = bot_type;
		this.#mode = BotMode.Idle;
		this.#targets = [];
	}

	public gc(): GameCharacter {
		if (this.#gc === undefined)
			throw new Error(`Character ${this.#id} not started!`);
		return this.#gc;
	}

	public async start_character(
		sr: ServerRegion,
		sid: ServerIdentifier
	): Promise<void> {
		if (this.is_started)
			throw new Error(`Character ${this.#id} already started!`);
		try {
			this.#gc = await AL.Game.startCharacter(this.#id, sr, sid);
			this.#server_region = sr;
			this.#server_identifier = sid;
			this.#targets = [];
			this.log('Connected!');
		} catch (e) {
			const mod_msg = e.message.replace("Failed to connect: ", "");
			this.log(mod_msg, LogLevel.ERROR);
			throw new Error(`Failed to start character ${this.#id}!`);
		}
		this.is_started = true;
		this.gc().socket.on("disconnect", () => {
			this.log("Disconnected!", LogLevel.WARNING);
		});
	}

	public log(message: string, log_level?: LogLevel): void {
		Logger.log(this.#id, message, {
			bot_type: this.#bot_type,
			log_level: log_level,
		});
	}

	get id(): string {
		return this.#id;
	}

	public is_mode(mode: BotMode): boolean {
		return (this.mode === mode);
	}

	set mode(mode: BotMode) {
		this.#mode = mode;
	}

	get mode(): BotMode {
		return this.#mode;
	}

	get is_leader(): boolean {
		return this.#is_leader;
	}

	set is_leader(is_pleader: boolean) {
		this.#is_leader = is_pleader;
	}

	get targets(): MonsterName[] {
		return this.#targets;
	}

	set targets(targets: MonsterName[]) {
		this.#targets = targets;
	}

	private async restart(): Promise<void> {
		this.gc().disconnect();

		if (this.#server_region === undefined || this.#server_identifier === undefined)
			throw new Error("Server region or identifier not set!");

		await this.start_character(
			this.#server_region, this.#server_identifier
		);
	}

	protected async run(bot_config: () => void): Promise<void> {
		if (!this.is_started)
			throw new Error(`Character ${this.#id} not started!`);
		let stop: boolean = false;

		const dc = () => { this.gc().disconnect(); stop = true };

		process.on("SIGINT", dc);
		process.on("SIGQUIT", dc);
		process.on("SIGTERM", dc);
		process.on("exit", dc);

		const gc = this.gc();
		do {
			bot_config();
			if (this.#bot_type !== BotType.Merchant) {
				TaskLauncher.start(Task.move, this, Task.Constants.Timeouts.MOVE);
				TaskLauncher.start(Task.attack, this, Task.Constants.Timeouts.ATTACK);
				TaskLauncher.start(Task.target, this, Task.Constants.Timeouts.TARGET);
			}
			TaskLauncher.start(Task.potion, this, Task.Constants.Timeouts.POTION);
			TaskLauncher.start(Task.loot, this, Task.Constants.Timeouts.LOOT);
			TaskLauncher.start(Task.mhunt_start, this, Task.Constants.Timeouts.MHUNT_START);
			if (this.is_leader)
				TaskLauncher.start(Task.party, this, Task.Constants.Timeouts.PARTY);
			else
				this.on_invite();

			// Move to a task ? Maybe not
			while (gc.socket.connected) {
				if (gc.rip) {
					this.log("Died !", LogLevel.WARNING);
					// I often get a respwan timeout (1000ms) there
					await sleep(12_000);
					await gc.respawn().then(() => {
						this.log("Respawned !", LogLevel.WARNING);
					}).catch(e => {
						this.log(e.message, LogLevel.ERROR);
					});
				}
				await sleep(150);
			}

			// process.removeListener("SIGINT", dc);
			// process.removeListener("SIGQUIT", dc);
			// process.removeListener("SIGTERM", dc);
			// process.removeListener("exit", dc);

			this.is_started = false;
			let retry_count = 0;
			while (!this.is_started && !stop && retry_count < 5) {
				this.log("Reconnecting...", LogLevel.WARNING);
				await this.restart().catch(() => {
					if (retry_count++ >= 5)
						this.log("Failed to reconnect after 5 retry!",
							LogLevel.ERROR
						);
				});
			}
		} while (this.is_started);
		this.log("Exiting...", LogLevel.WARNING);
	}

	protected on_invite(): void {
		if (this.is_leader) return;
		const gc = this.gc();
		const on_invite_run = async (data: { name: string; }) => {
			const ids = [
				Config.get_config<string>("merchant_id"),
				Config.get_config<string>("warrior_id"),
				Config.get_config<string>("mage_id"),
				Config.get_config<string>("ranger_id")
			];
			if (ids.includes(data.name)) {
				let retry_count = 0;
				if (gc.party !== undefined && gc.partyData?.list.includes(data.name))
					return;
				if (gc.party !== undefined) await gc.leaveParty().catch(e => {
					this.log(e.message, LogLevel.ERROR);
				});
				while (!gc.party && retry_count < 5) {
					await gc.acceptPartyInvite(data.name)
						.then((data) => gc.partyData = data)
						.catch(async e => {
							this.log(e.message, LogLevel.ERROR);
							if (retry_count++ >= 5) {
								this.log("Failed to join party after 5 retry!",
									LogLevel.ERROR
								);
								gc.socket.once("invite", on_invite_run);
							} else await sleep(1000);
						});
				}
				this.log(`Joined '${data.name}' party`, LogLevel.WARNING);
			}
		};
		gc.socket.once("invite", on_invite_run);
	}
}
