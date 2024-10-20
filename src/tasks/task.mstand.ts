import { Bot } from "../classes/bot.js";

export async function mstand<T extends Bot>(self: T, timeout: number): Promise<number> {
	return timeout;
}
