import AL, {
	ChestLootData,
	PingCompensatedCharacter as GameCharacter,
	GetEntityFilters,
	MonsterName,
	ServerIdentifier, ServerRegion
} from 'alclient';
import { config as Config } from '../utils/config.js';
import * as Logger from "../utils/logger.js";
import { sleep } from '../utils/sleep.js';


export enum BotMode {
	Idle,
	Attack
}

export abstract class Bot {
	#id: string;
	#server_region: ServerRegion;
	#server_identifier: ServerIdentifier;
	#class_type: Logger.ClassType;
	#gc: GameCharacter;

	is_started = false;
	#mode = BotMode.Idle;
	#targets: MonsterName[];
	#is_pleader: boolean = false;

	constructor(
		id: string,
		class_type: Logger.ClassType
	) {
		this.#is_pleader = false;
		this.#id = id;
		this.#class_type = class_type;
		this.#mode = BotMode.Idle;
	}

	protected gc(): GameCharacter {
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
			this.log(mod_msg, Logger.LogLevel.ERROR);
			throw new Error(`Failed to start character ${this.#id}!`);
		}
		this.is_started = true;
		this.gc().socket.on("disconnect", () => {
			this.log("Disconnected!", Logger.LogLevel.WARNING);
		});
	}

	protected log(message: string, log_level?: Logger.LogLevel): void {
		Logger.log(this.#id, message, {
			class_type: this.#class_type,
			log_level: log_level,
		});
	}

	get id(): string {
		return this.#id;
	}

	protected is_mode(mode: BotMode): boolean {
		return (this.mode === mode);
	}

	set mode(mode: BotMode) {
		this.#mode = mode;
	}

	get mode(): BotMode {
		return this.#mode;
	}

	get is_pleader(): boolean {
		return this.#is_pleader;
	}

	set is_pleader(is_pleader: boolean) {
		this.#is_pleader = is_pleader;
	}

	get targets(): MonsterName[] {
		return this.#targets;
	}

	set targets(targets: MonsterName[]) {
		this.#targets = targets;
	}

	private async restart(): Promise<void> {
		this.gc().disconnect();

		await this.start_character(
			this.#server_region, this.#server_identifier
		);
	}

	protected async run(bot_config: () => void): Promise<void> {
		if (!this.is_started)
			throw new Error(`Character ${this.#id} not started!`);
		let stop: boolean = false;
		do {
			const gc = this.gc();
			const dc = () => { gc.disconnect(); stop = true };

			process.on("SIGINT", dc);
			process.on("SIGQUIT", dc);
			process.on("SIGTERM", dc);
			process.on("exit", dc);

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
						this.log(e.message, Logger.LogLevel.ERROR);
					});
					while (!gc.party && retry_count < 5) {
						await gc.acceptPartyInvite(data.name)
							.then((data) => gc.partyData = data)
							.catch(async e => {
								this.log(e.message, Logger.LogLevel.ERROR);
								if (retry_count++ >= 5) {
									this.log("Failed to join party after 5 retry!",
										Logger.LogLevel.ERROR
									);
								} else await sleep(1000);
							});
					}
					this.log(`Joined '${data.name}' party`, Logger.LogLevel.WARNING);
				}
			}

			gc.socket.on("invite", on_invite_run);

			gc.timeouts.set("moveL", setInterval(this.movement_loop, 350, this));
			gc.timeouts.set("potionL", setInterval(this.potion_loop, 500, this));
			gc.timeouts.set("lootL", setInterval(this.loot_loop, 250, this));
			gc.timeouts.set("partyL", setInterval(this.party_loop, 10000, this));
			gc.timeouts.set("check_huntL", setTimeout(this.check_hunt_loop, 1000, this));
			gc.timeouts.set("end_huntL", setInterval(this.finish_hunt_loop, 1000, this));

			bot_config();

			while (gc.socket.connected) {
				if (gc.rip) {
					this.log("Died !", Logger.LogLevel.WARNING);
					// I often get a respwan timeout (1000ms) there
					await sleep(12_000);
					await gc.respawn().then(() => {
						this.log("Respawned !", Logger.LogLevel.WARNING);
					}).catch(e => {
						this.log(e.message, Logger.LogLevel.ERROR);
					});
				}
				await sleep(150);
			}

			process.removeListener("SIGINT", dc);
			process.removeListener("SIGQUIT", dc);
			process.removeListener("SIGTERM", dc);
			process.removeListener("exit", dc);

			this.is_started = false;
			let retry_count = 0;
			while (!this.is_started && !stop && retry_count < 5) {
				this.log("Reconnecting...", Logger.LogLevel.WARNING);
				await this.restart().catch(() => {
					if (retry_count++ >= 5)
						this.log("Failed to reconnect after 5 retry!",
							Logger.LogLevel.ERROR
						);
				});
			}
		} while (this.is_started);
		this.log("Exiting...", Logger.LogLevel.WARNING);
	}

	protected async potion_loop(self: Bot): Promise<void> {

		const shared_cooldown = (gc: GameCharacter) => {
			let is_on_cooldown = gc.isOnCooldown("use_hp");
			is_on_cooldown ||= gc.isOnCooldown("use_mp");
			is_on_cooldown ||= gc.isOnCooldown("regen_hp");
			is_on_cooldown ||= gc.isOnCooldown("regen_mp");
			return is_on_cooldown;
		}

		try {
			const gc = self.gc();
			if (gc.rip || !self.is_started || gc.socket.disconnected) return;
			if (shared_cooldown(gc)) return;
			const health_ratio = gc.hp / gc.max_hp;
			const mana_ratio = gc.mp / gc.max_mp;
			if (health_ratio < mana_ratio) {
				const hpot = gc.locateItem("hpot0");
				const diff = gc.max_hp - gc.hp;
				if (hpot !== undefined && diff >= 200) await gc.usePotion(hpot);
				else if (diff >= 50) await gc.regenHP();
			} else {
				const mpot = gc.locateItem("mpot0");
				const diff = gc.max_mp - gc.mp;
				if (mpot !== undefined && diff >= 300) await gc.usePotion(mpot);
				else if (diff >= 100) await gc.regenMP();
			}
		} catch (e) {
			self.log(e.message, Logger.LogLevel.ERROR);
		}
	}

	protected async movement_loop(self: Bot): Promise<void> {
		try {
			const gc = self.gc();
			if (gc.socket.disconnected || gc.rip || gc.smartMoving
				|| self.is_mode(BotMode.Idle) || !self.#targets.length) return;
			const old_entity = gc.getTargetEntity();
			if (old_entity && self.#targets.includes(old_entity.type))
				if (AL.Tools.distance(gc, old_entity) <= gc.range) return;
			const filter: GetEntityFilters = {
				typeList: self.#targets, canDamage: true, canWalkTo: true,
				couldGiveCredit: true, returnNearest: true,
				willBurnToDeath: false, willDieToProjectiles: false
			};
			if (old_entity?.isAttackingPartyMember(gc)) return;
			const entity = gc.getEntity({
				...filter, targetingPartyMember: true,
				withinRange: gc.range
			}) ?? gc.getEntity(filter);
			if (!entity) {
				await gc.smartMove(self.#targets[0]);
				return;
			}
			const distance = AL.Tools.distance(gc, entity);
			if (distance > gc.range) {
				await gc.smartMove(entity, {
					getWithin: gc.range - entity.speed,
				});
			}
			gc.target = entity.id;
		} catch (e) {
			self.log(e.message, Logger.LogLevel.ERROR);
		}
	}

	protected set_attack_loop(ms: number): void {
		this.gc().timeouts.set("attack_loop", setTimeout(
			this.attack_loop, ms, this
		));
	}

	protected async attack_loop(self: Bot): Promise<void> {
		let next_delay = 10;
		try {
			const gc = self.gc();

			gc.timeouts.delete("attack_loop");
			if (self.is_mode(BotMode.Idle)
				|| gc.socket.disconnected || gc.rip || !self.targets.length) {
				self.set_attack_loop(next_delay);
				return;
			}
			if (!gc.isOnCooldown("attack")) {
				const entity = gc.getTargetEntity();
				if (entity && self.#targets.includes(entity.type)) {
					if (AL.Tools.distance(gc, entity) <= gc.range) {
						await gc.basicAttack(entity.id);
						next_delay = 1000 / gc.frequency;
					}
				}
			}
		} catch (e) {
			const msg: string = e.message;
			// TODO: move this inside the logger.
			if (!(/target '\d+' not found/.test(msg))) {
				self.log(msg, Logger.LogLevel.ERROR);
				next_delay = 1000;
			} else self.gc().target = undefined;
		}
		self.set_attack_loop(next_delay);
	}

	protected async loot_loop(self: Bot): Promise<void> {
		try {
			const gc = self.gc();
			if (gc.chests.size === 0) return;

			const free_slots = gc.items.filter(i => i === null).length;
			for (const [, chest] of gc.chests) {
				if (free_slots - chest.items < 0) continue;
				const content = await gc.openChest(chest.id) as ChestLootData;
				if (content.gold !== undefined)
					self.log(`Got ${content.gold} golds`, Logger.LogLevel.GOLD);
				content.items = content.items?.filter(i => i.looter === gc.id);
				for (const item of content.items ?? []) {
					const item_name = self.gc().G.items[item.name].name;
					self.log(
						`Got ${item_name} x${item.q ?? 1}`,
						Logger.LogLevel.LOOT
					);
				}
			}
		} catch (e) {
			self.log(e.message, Logger.LogLevel.ERROR);
		}
	}

	protected async party_loop(self: Bot): Promise<void> {
		const ids = [
			Config.get_config<string>("merchant_id"),
			Config.get_config<string>("warrior_id"),
			Config.get_config<string>("mage_id"),
			Config.get_config<string>("ranger_id")
		];

		const gc = self.gc();
		if (!self.is_pleader) return;
		for (const id of ids) {
			try {
				if (id === self.id || (gc.partyData?.list.includes(id))) continue;
				self.log(`Inviting ${id} to the party`, Logger.LogLevel.WARNING);
				await gc.sendPartyInvite(id);
			} catch (e) {
				self.log(e.message, Logger.LogLevel.ERROR);
			}
		}
	}

	protected async check_hunt_loop(self: Bot): Promise<void> {
		self.gc().timeouts.delete("check_huntL");

		const set_timeout = (ms: number) => {
			self.gc().timeouts.set("check_huntL", setTimeout(
				self.check_hunt_loop, ms, self
			));
		};
		const gc = self.gc();
		if (self.is_mode(BotMode.Idle) || gc.rip || gc.socket.disconnected)
			return set_timeout(30_000);

		const permitted_ids: MonsterName[] = Config.get_config<MonsterName[]>("allowed_hunt_ids");
		if (gc.s.monsterhunt && permitted_ids.includes(gc.s.monsterhunt.id) && !permitted_ids.includes(self.targets[0]))
			self.targets = [gc.s.monsterhunt.id];
		if (gc.s.monsterhunt) return set_timeout(gc.s.monsterhunt.ms);

		const last_mode = self.mode;
		try {
			self.log("On the way to start a quest", Logger.LogLevel.INFO);
			self.mode = BotMode.Idle;
			if (gc.smartMoving) await gc.stopSmartMove();
			// TODO: smartMove often error.
			await gc.smartMove("monsterhunter");
			await gc.getMonsterHuntQuest();
			self.log(`Quest target is '${gc.s.monsterhunt?.id}'`, Logger.LogLevel.INFO);
			if (permitted_ids.includes(gc.s.monsterhunt?.id)) {
				self.targets = [gc.s.monsterhunt.id];
				self.log("ID allowed, Monster hunt started!", Logger.LogLevel.WARNING);
			} else self.log("ID not allowed, Monster hunt ignored!", Logger.LogLevel.INFO);
		} catch (e) {
			self.log(e.message, Logger.LogLevel.ERROR);
		}
		self.mode = last_mode;
		set_timeout(gc.s?.monsterhunt.ms ?? 10_000);
	}

	protected async finish_hunt_loop(self: Bot): Promise<void> {

		const gc = self.gc();
		if (self.is_mode(BotMode.Idle) || gc.socket.disconnected || gc.rip) return;

		const monster_hunt = gc.s.monsterhunt;
		if (monster_hunt === undefined) return;
		if (monster_hunt.c === 0) {
			self.log("Monster hunt completed!", Logger.LogLevel.INFO);
			const last_mode = self.mode;
			try {
				self.mode = BotMode.Idle;
				if (gc.smartMoving) await gc.stopSmartMove();
				self.log("On the way to finish the quest", Logger.LogLevel.INFO);
				await gc.smartMove("monsterhunter");
				await gc.finishMonsterHuntQuest();
				Config.unset_config(`last_hunt_${self.id}`);
				Config.save_config();
				clearTimeout(gc.timeouts.get("check_huntL"));
				self.targets = Config.get_config<MonsterName[]>("targets");
				gc.timeouts.set("check_huntL", setTimeout(self.check_hunt_loop, 1000, self));
			} catch (e) {
				self.log(e.message, Logger.LogLevel.ERROR);
			}
			self.mode = last_mode;
		}
	}
}
