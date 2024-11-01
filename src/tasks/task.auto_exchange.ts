import { Bot, BotState, BotType } from "../classes/bot.js";

export async function auto_exchange<T extends Bot>(self: T, timeout: number): Promise<number> {
	const gc = self.gc();
	if (!self.is_state(BotState.NONE) || gc.rip) return timeout;
	if (self.bot_type !== BotType.Merchant) return timeout;
	if (gc.isExchanging()) return timeout;

	// TODO

	return timeout;
}
