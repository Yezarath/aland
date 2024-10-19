import { Bot } from "../classes/bot";

export async function potion<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();

	// if we're dead, return
	if (gc.rip) return timeout;

	// if we're on cooldown, return
	const cooldown = gc.getCooldown("use_hp");
	if (cooldown !== 0) return cooldown + gc.ping;

	const health_ratio = gc.hp / gc.max_hp;
	const mana_ratio = gc.mp / gc.max_mp;
	if (health_ratio < mana_ratio) {
		const hpot = gc.locateItem("hpot0");
		const diff = gc.max_hp - gc.hp;
		if (hpot !== undefined && diff >= 200) await gc.usePotion(hpot);
		else if (diff >= 50) await gc.regenHP();
		if (gc.isOnCooldown("use_hp"))
			timeout = gc.getCooldown("use_hp") + gc.ping;
	} else {
		const mpot = gc.locateItem("mpot0");
		const diff = gc.max_mp - gc.mp;
		if (mpot !== undefined && diff >= 300) await gc.usePotion(mpot);
		else if (diff >= 100) await gc.regenMP();
		if (gc.isOnCooldown("use_mp"))
			timeout = gc.getCooldown("use_mp") + gc.ping;
	}
	return timeout;
}
