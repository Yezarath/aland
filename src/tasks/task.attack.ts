import { Tools } from 'alclient';
import { Bot, BotState } from "../classes/bot.js";

export async function attack<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	if (self.is_state(BotState.NONE)) return timeout;
	// if (!self.is_state(BotState.ATTACKING)) return timeout;
	if (gc.rip || !self.targets.length) return timeout;
	if (gc.c.town) return timeout;

	if (gc.canUse("attack", { ignoreEquipped: true, ignoreLocation: true })) {
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
