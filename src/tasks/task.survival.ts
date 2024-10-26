import { Bot, BotState } from "../classes/bot.js";
import CaughtPromise from "../utils/caught_promise.js";
import { LogLevel } from "../utils/logger.js";
import { sleep } from "../utils/sleep.js";
import Task from './task.js';


async function exec_survival<T extends Bot>(self: T, reason: string): Promise<void> {
	const gc = self.gc();
	self.state = BotState.RETREATING;
	return CaughtPromise(async () => {
		await gc.warpToJail().catch(() => { });
		// Time to sleep = (max_hp / potion_value) * potion_cooldown + ping;
		const hpot = gc.G.items[Task.Constants.Basics.HPOT_TYPE] ?? { gives: [["hp", 50]], cooldown: 4000 };
		const potion_value = hpot.gives?.find(([Attr,]) => {
			return Attr === "hp";
		})?.[1] ?? 50;
		const time_to_sleep = Math.ceil(gc.max_hp / potion_value) * (hpot.cooldown ?? 1) + gc.ping;
		self.log({
			message: `Survival Initiated! Reason = ${reason}`, data: {
				potion_value,
				time_to_sleep
			}
		}, LogLevel.EVENT_KO);
		await sleep(time_to_sleep);
	});
}

export async function survival<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	if (gc.rip) return timeout;
	if (gc.c.town) return timeout;

	const state = self.state;
	const targets = gc.getEntities({
		targetingMe: true,
		hasTarget: true
	});
	for (const target of targets) {
		const damage = target.calculateDamageRange(gc);
		// Target damage will kill us
		if (damage[0] * 1.5 >= gc.hp || damage[1] * 1.5 >= gc.hp) {
			await exec_survival(self, "Target damage will kill us").finally(() => { self.state = state });
			break
		}
		const monster = gc.G.monsters[target.type];
		// @INFO: dreturn work only if the character have less than 75 range, and the damage is physical
		if (monster.dreturn && gc.damage_type === "physical" && gc.target === target.id && gc.range < 75) {
			const damage = gc.calculateDamageRange(target, "attack");
			[damage[0], damage[1]] = [damage[0] * monster.dreturn / 100, damage[1] * monster.dreturn / 100];
			if (damage[0] >= gc.hp || damage[1] >= gc.hp) {
				self.log({ message: "Dreturn", data: { damage } });
				await exec_survival(self, "DReturn of target will kill us").finally(() => { self.state = state });
				break
			}
		}
		// Burn damage
		// Poison damage
	}

	return timeout;
}
