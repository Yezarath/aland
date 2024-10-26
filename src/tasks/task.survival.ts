import { Bot, BotState } from "../classes/bot.js";
import CaughtPromise from "../utils/caught_promise.js";
import { LogLevel } from "../utils/logger.js";
import { sleep } from "../utils/sleep.js";
import Task from "./task.js";


async function exec_survival<T extends Bot>(self: T, reason: string): Promise<void> {
	const gc = self.gc();
	self.state = BotState.RETREATING;
	return CaughtPromise(async () => {
		await gc.warpToJail().catch(() => { });
		// Time to sleep = (max_hp / potion_value) * potion_cooldown + ping;
		const hpot = Task.Constants.Basics.HPOT_TYPE;
		const potion_value = gc.G.items[hpot].heal ?? 42;
		const time_to_sleep = Math.ceil(gc.max_hp / potion_value) * gc.getCooldown("use_hp") + gc.ping;
		self.log({
			message: "Survival Initiated!", data: {
				reason,
				potion_value,
				time_to_sleep
			}
		}, LogLevel.DEBUG);
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
		if (damage[0] >= gc.hp || damage[1] >= gc.hp) {
			await exec_survival(self, "Target damage will kill us").finally(() => { self.state = state });
			return timeout + gc.ping;
		}
		// Damage return will kill us
		const monster = gc.G.monsters[target.type];
		if (monster.dreturn && gc.damage_type === "physical" && gc.target === target.id) {
			const damage = gc.calculateDamageRange(target, "attack");
			[damage[0], damage[1]] = [damage[0] * monster.dreturn / 100, damage[1] * monster.dreturn / 100];
			if (damage[0] >= gc.hp || damage[1] >= gc.hp) {
				await exec_survival(self, "DReturn of target will kill us").finally(() => { self.state = state });
				return timeout + gc.ping;
			}
		}
		// Burn damage
		// Poison damage
	}

	return timeout + self.gc().ping;
}
