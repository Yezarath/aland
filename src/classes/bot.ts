import AL, {
	PingCompensatedCharacter as GameCharacter,
	GetEntityFilters,
	HitData,
	LimitDCReportData,
	MonsterName,
	ServerIdentifier, ServerRegion
} from 'alclient';
import TaskLauncher from '../tasks/launcher.js';
import Task from '../tasks/task.js';
import Config from '../utils/config.js';
import { ItemsManagement } from '../utils/items_management.js';
import Logger, { LogLevel, LogMessage } from "../utils/logger.js";
import { sleep } from '../utils/sleep.js';

export enum BotMode {
	Idle,
	Running
}

export enum BotState {
	NONE,
	ATTACKING,
	REFILL,
	TAKE_QUEST,
	END_QUEST,
	SELLING,
	RETREATING,
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
	//#region Static Fields
	static #bots: Bot[] = [];
	//#endregion
	//#region Private Fields
	readonly #id: string;
	readonly #bot_type: BotType;
	#server_region: ServerRegion | undefined;
	#server_identifier: ServerIdentifier | undefined;
	#gc!: GameCharacter;
	#mode: BotMode;
	#state: BotState;
	#targets: MonsterName[];
	#should_stop: boolean;
	#is_leader: boolean;
	//#endregion

	//#region Public Fields
	iconfig: ItemsManagement;
	is_started: boolean;
	//#endregion

	//#region Getters and Setters
	get id(): string { return this.#id }

	set mode(mode: BotMode) { this.#mode = mode }
	get mode(): BotMode { return this.#mode }
	public is_mode(mode: BotMode): boolean { return (this.mode === mode) }

	set state(state: BotState) { this.#state = state }
	get state(): BotState { return this.#state }
	public is_state(state: BotState): boolean { return (this.state === state) }

	get is_leader(): boolean { return this.#is_leader }
	set is_leader(is_leader: boolean) { this.#is_leader = is_leader }

	get should_stop(): boolean { return this.#should_stop }
	set should_stop(should_stop: boolean) { this.#should_stop = should_stop }

	get targets(): MonsterName[] { return this.#targets }
	set targets(targets: MonsterName[]) { this.#targets = targets }

	get bot_type(): BotType { return this.#bot_type }

	get bots(): Bot[] { return Bot.#bots }

	public gc<T extends GameCharacter>(): T {
		if (this.#gc === undefined) throw new Error(`Character ${this.#id} not started!`);
		return this.#gc as T;
	}
	//#endregion

	constructor(id: string, bot_type: BotType) {
		this.#id = id;
		this.#bot_type = bot_type;
		this.#mode = BotMode.Idle;
		this.#state = BotState.NONE;
		this.#targets = [];
		this.#should_stop = false;
		this.#is_leader = false;
		this.is_started = false;
		this.iconfig = new ItemsManagement(this);
		Bot.#bots.push(this);
	}

	public log(message: LogMessage, log_level?: LogLevel): void {
		Logger.log(this.#id, message, {
			bot_type: this.#bot_type,
			log_level: log_level,
		});
	}

	public async start_character(
		sr: ServerRegion,
		sid: ServerIdentifier
	): Promise<void> {
		if (this.is_started)
			throw new Error(`Character ${this.#id} already started!`);
		this.#gc = await AL.Game.startCharacter(this.#id, sr, sid).catch(e => {
			e.message = e.message.replace("Failed to connect: Failed: ", "");
			this.log(`[START] ~ ${e.message}`, LogLevel.ERROR);
			throw new Error(`Failed to start character '${this.#id}`);
		});
		this.is_started = true;
		this.#server_region = sr;
		this.#server_identifier = sid;
		this.#targets = [];
		this.log('Connected!');
	}

	private async restart(): Promise<void> {
		if (this.#server_region === undefined || this.#server_identifier === undefined)
			throw new Error("Server region or identifier not set!");
		if (!this.is_started)
			throw new Error(`Character ${this.#id} not started!`);

		this.is_started = false;
		this.gc().disconnect();

		if (this.should_stop) return;

		let retry_count = 0;
		this.log("Reconnecting...", LogLevel.WARNING);
		// Maybe Move this in a task, endless reconnecting needed, one every 15s.
		while (retry_count < 30 && !this.is_started && this.gc().socket.disconnected) {
			try {
				await this.start_character(this.#server_region, this.#server_identifier);
			} catch {
				if (retry_count++ >= 30)
					this.log("Failed to reconnect after 30 retry!", LogLevel.ERROR);
				else await sleep(15_000);
			}
		}
	}

	protected async run(child_config: () => void): Promise<void> {
		if (!this.is_started)
			throw new Error(`Character ${this.#id} not started!`);

		while (this.is_started) {
			child_config();

			// Start the tasks
			if (this.is_leader)
				TaskLauncher.start(Task.party, this, Task.Constants.Timeouts.PARTY);
			else this.on_invite(); // Listener for party invite, might find a way to link that to a task.


			if (this.#bot_type !== BotType.Merchant) {
				this.on_stacked();
				TaskLauncher.start(Task.move, this, Task.Constants.Timeouts.MOVE);
				TaskLauncher.start(Task.attack, this, Task.Constants.Timeouts.ATTACK);
				TaskLauncher.start(Task.target, this, Task.Constants.Timeouts.TARGET);
				TaskLauncher.start(Task.hunt_start, this, Task.Constants.Timeouts.HUNT_START);
				TaskLauncher.start(Task.survival, this, Task.Constants.Timeouts.SURVIVAL);
			} else {
				TaskLauncher.start(Task.mstand, this, Task.Constants.Timeouts.MSTAND);
				TaskLauncher.start(Task.mluck, this, Task.Constants.Timeouts.MLUCK);
				TaskLauncher.start(Task.auto_upgrade, this, Task.Constants.Timeouts.AUTO_UPGRADE);
				TaskLauncher.start(Task.auto_compound, this, Task.Constants.Timeouts.AUTO_COMPOUND);
			}

			TaskLauncher.start(Task.items, this, Task.Constants.Timeouts.SELLING);
			TaskLauncher.start(Task.refill, this, Task.Constants.Timeouts.REFILL);
			TaskLauncher.start(Task.potion, this, Task.Constants.Timeouts.POTION);
			TaskLauncher.start(Task.loot, this, Task.Constants.Timeouts.LOOT);
			TaskLauncher.start(Task.respawn, this, Task.Constants.Timeouts.RESPAWN);
			this.on_disconnect();

			// For debug purposes :
			this.gc().socket.on("limitdcreport", (data: LimitDCReportData) => {
				Logger.debug("DEBUG", {
					message: "Limit DC Report =>",
					data: data
				});
			});

			while (this.gc().socket.connected && !this.should_stop) await sleep(150);
			await this.restart();
		}
		this.log("Exiting...", LogLevel.WARNING);
	}

	protected on_disconnect(): void {
		const callback = () => {
			this.gc().disconnect();
			this.should_stop = true;
		};

		process.on("SIGINT", callback);
		process.on("SIGQUIT", callback);
		process.on("SIGTERM", callback);
		process.on("exit", callback);

		this.gc().socket.on("disconnect", (reason) => {
			this.log(`Disconnected for '${reason}'!`, LogLevel.ERROR);

			process.removeListener("SIGINT", callback);
			process.removeListener("SIGQUIT", callback);
			process.removeListener("SIGTERM", callback);
			process.removeListener("exit", callback);
		});
	}

	protected on_invite(): void {
		if (this.is_leader) return;
		const gc = this.gc();
		const callback = async (data: { name: string; }) => {
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
								gc.socket.once("invite", callback);
							} else await sleep(1000);
						});
				}
				this.log(`Joined '${data.name}' party`, LogLevel.EVENT);
			}
		};
		gc.socket.on("invite", callback);
	}

	protected on_stacked(): void {
		const gc = this.gc();
		const callback = async (data: HitData) => {
			if (data.id !== gc.id) return;
			if (!data.stacked) return;
			if (!data.stacked.includes(gc.id)) return;

			this.log({
				message: "Character is stacked, moving away!",
				data: { damage: data.damage, stacked: data.stacked }
			}, LogLevel.WARNING);

			const x = -gc.width + Math.round(gc.width * 2 * Math.random());
			const y = -gc.height + Math.round(gc.height * 2 * Math.random());
			await gc.move(gc.x + x, gc.y + y).catch(() => { });
		}
		gc.socket.on("hit", callback);
	}

	public get_attack_filter(): GetEntityFilters {
		return {
			typeList: this.targets, canDamage: true, canWalkTo: true,
			couldGiveCredit: (this.gc().map === "goobrawl") ? undefined : true,
			returnNearest: true,
			willBurnToDeath: false, willDieToProjectiles: false
		};
	}

	abstract get_targets(): MonsterName[];
}
