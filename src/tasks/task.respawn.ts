import { Bot } from "../classes/bot.js";
import { LogLevel } from "../utils/logger.js";
import { sleep } from "../utils/sleep.js";

export async function respawn<T extends Bot>(self: T, timeout: number): Promise<number> {
	if (self.gc().rip) {
		self.log("Died !", LogLevel.WARNING);
		await sleep(12_000);
		await self.gc().respawn().then(() => {
			self.log("Respawned !", LogLevel.WARNING);
		}).catch(e => self.log(e.message, LogLevel.ERROR));
		return timeout * 10;
	}
	return timeout;
}
