import { Merchant as GameMerchant } from "alclient";
import { Bot } from "../classes/bot.js";

/**
 * This task is used by the merchant.
 * It should disable the stand if the merchant is moving.
 * It should enable the stand if the merchant is not moving.
 */
export async function mstand<T extends Bot>(self: T, timeout: number): Promise<number> {
	if (self.gc().ctype !== "merchant") throw new Error("Invalid character type");

	const gc = self.gc() as GameMerchant;
	if (gc.rip) return timeout;

	if (gc.moving) {
		if (gc.stand) await gc.closeMerchantStand()
	} else {
		if (!gc.stand) await gc.openMerchantStand()
	}
	return timeout;
}
