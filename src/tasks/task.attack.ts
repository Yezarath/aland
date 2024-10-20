import { Tools } from 'alclient';
import { Bot } from "../classes/bot.js";

export async function attack<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	if (gc.rip || !self.targets.length) return timeout;
	if (gc.c.town) return timeout;
	// if (Game.characters !== undefined) self.log({
	// 	message: "Game.characters is not undefined",
	// 	data: Game.characters,
	// }, LogLevel.DEBUG);

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
