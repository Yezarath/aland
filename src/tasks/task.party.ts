
import { Bot } from "../classes/bot.js";
import Config from "../utils/config.js";
import { LogLevel } from "../utils/logger.js";

export async function party<T extends Bot>(self: T, timeout: number): Promise<number> {
	// Not suppoed to happen, but just in case.
	if (!self.is_leader) return timeout;

	// Need a "team compositions" in the config.
	// like "team_compositions": ["merchant", "warrior", "mage", "ranger"]
	const gc = self.gc();
	const ids = [
		Config.get_config<string>("warrior_id"),
		Config.get_config<string>("merchant_id"),
		Config.get_config<string>("mage_id"),
		Config.get_config<string>("ranger_id")
	].filter(id =>
		id !== undefined && id !== self.id && !gc.partyData?.list.includes(id)
	) as string[];

	let successfull_count = 0;

	await Promise.allSettled(
		ids.map(id => gc.sendPartyInvite(id))
	).then(results => results.forEach((result, index) => {
		if (result.status === "fulfilled") {
			successfull_count++;
			self.log(`Invited ${ids[index]} to the party`, LogLevel.WARNING);
		} else self.log(result.reason.message, LogLevel.ERROR);
	})).catch(e => self.log(e.message, LogLevel.ERROR));

	if (successfull_count !== ids.length) return timeout * 3;
	return timeout;
}
