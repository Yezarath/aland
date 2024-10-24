import { Tools, Warrior } from "alclient"; // Adjust the import path as necessary
import { Bot, BotState } from "../classes/bot.js";

export async function move<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	// if no targets to hunt, or we're dead, return
	if (!self.is_state(BotState.ATTACKING)) return timeout;
	if (self.targets.length === 0 || gc.rip) return timeout;

	const target = gc.getTargetEntity();
	if (!target) {
		const nearest = gc.getEntity(self.get_attack_filter());
		if (!nearest) {
			if (gc.smartMoving) await gc.stopSmartMove();
			await gc.smartMove(self.targets[0], {
				resolveOnFinalMoveStart: true,
				getWithin: gc.range
			});
		}
	} else {
		const distance = Tools.distance(gc, target);
		if (distance > gc.range) {
			if (gc.canUse("charge") && (distance - gc.range) / gc.speed > 2.5)
				await self.gc<Warrior>().charge();
			await gc.smartMove(target, {
				getWithin: Math.max(0, gc.range - target.speed)
			});
		}
	}
	return timeout;
}
