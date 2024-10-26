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

	const filter_fn = (p: Player | Character): boolean => {
		if (!p.s.mluck) return true;
		if (p.ctype === "merchant") return false;
		if (p.id === "Sneakmato") return false; // Temporary fix for ignoreIDs, remove when PR validated.
		if (p.afk && p.afk === true && p.s.mluck.ms > 3_500_000) return false;
		if (p.s.mluck.ms < 1_200_000 && p.s.mluck.f === gc.id) return true;
		if (p.s.mluck.f !== gc.id && !p.s.mluck.strong) return true;
		return false;
	};

	const apply = async (character: Player | Character): Promise<void> => {
		await gc.mluck(character.id).catch(() => { });
		await sleep(gc.getCooldown("mluck") + gc.ping);
	};

	const gc = self.gc<Merchant>();
	const to_buff = gc.getPlayers({
		isDead: false, withinRange: "mluck", isNPC: false, ignoreIDs: ["Sneakmato"]
	}).filter(filter_fn);
	// .slice(0, 5) // maximum of 5 buffs per rotation, cost 20mp each, 100mp total in 1s.
	for (const player of to_buff) await apply(player);
	if (filter_fn(gc)) await apply(gc);
	return timeout + gc.ping;
}
