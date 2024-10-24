import { Character, Merchant, Player } from "alclient";
import { Bot } from "../classes/bot.js";
import { sleep } from "../utils/sleep.js";

/**
 * This task is responsible for using the mluck skill on the players
 * 	around that don't already have the buff.
 */
export async function mluck<T extends Bot>(self: T, timeout: number): Promise<number> {
	if (self.gc().rip) return timeout;
	if (self.gc().c.town) return timeout;
	if (!self.gc().canUse("mluck", {
		ignoreCooldown: true, ignoreEquipped: true, ignoreMP: true
	})) return timeout;

	const filter_fn = (character: Player | Character): boolean => {
		if (!character.s.mluck) return true;
		if (character.s.mluck.ms < 1_200_000 && character.s.mluck.f === gc.id) return true;
		if (character.s.mluck.f !== gc.id && !character.s.mluck.strong) return true;
		return false;
	};

	const apply = async (character: Player | Character): Promise<void> => {
		await gc.mluck(character.id).catch(() => { });
		await sleep(gc.getCooldown("mluck") + gc.ping);
	};

	const gc = self.gc<Merchant>();
	const to_buff = gc.getPlayers({ isDead: false, withinRange: "mluck", isNPC: false })
		.filter(filter_fn);
	// .slice(0, 5) // maximum of 5 buffs per rotation, cost 20mp each, 100mp total in 1s.
	for (const player of to_buff) await apply(player);
	if (filter_fn(gc)) await apply(gc);
	return timeout + gc.ping;
}
