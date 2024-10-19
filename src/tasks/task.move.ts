import { Tools } from "alclient"; // Adjust the import path as necessary
import { Bot } from "../classes/bot.js";

export async function move<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	// if no targets to hunt, or we're dead, return
	if (self.targets.length === 0 || gc.rip) return timeout;

	const target = gc.getTargetEntity();
	// if no entity found, smart move towards one.
	if (!target) {
		// meh, maybe use the callback to stop smart moving
		if (gc.smartMoving) await gc.stopSmartMove();
		await gc.smartMove(self.targets[0]);
		return timeout;
	}
	const distance = Tools.distance(gc, target);
	if (distance > gc.range) {
		await gc.smartMove(target, { getWithin: gc.range - target.speed });
		timeout = ((distance / gc.speed) * 1000) + gc.ping;
	}
	return timeout;
}
