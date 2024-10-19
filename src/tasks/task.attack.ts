import { Tools } from 'alclient';
import { Bot } from "../classes/bot.js";

export async function attack<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	if (gc.rip || !self.targets.length) return timeout;

	if (!gc.isOnCooldown("attack")) {
		const entity = gc.getTargetEntity();

		if (entity && self.targets.includes(entity.type)) {
			if (Tools.distance(gc, entity) <= gc.range) {
				await gc.basicAttack(entity.id);
				timeout = gc.getCooldown("attack") + gc.ping;
			}
		}
	}
	return timeout
}
