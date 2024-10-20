import { Tools } from "alclient";
import { Bot } from "../classes/bot.js";


export async function target<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	// if no targets to hunt, or we're dead, return
	if (self.targets.length === 0 || gc.rip) return timeout;

	// if the old_target is still in range, return
	const target = gc.getTargetEntity();
	if (target && self.targets.includes(target.type))
		if (!target.willDieToProjectiles(gc, gc.projectiles, gc.players, gc.entities))
			if (Tools.distance(gc, target) <= gc.range)
				return timeout;
	// if the target is attacking a party member, return
	if (target?.isAttackingPartyMember(gc)) return timeout;

	const filter = self.get_attack_filter();
	// Get a new target
	const new_target = gc.getEntity({
		...filter, targetingPartyMember: true,
		withinRange: gc.range * 1.5
	}) ?? gc.getEntity(filter);

	// if no entity found, return
	if (new_target) gc.target = new_target.id;
	return timeout;
}
