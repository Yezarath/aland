import AL, { ServerIdentifier, ServerRegion } from "alclient";
import { Mage } from "./classes/mage.js";
import { Merchant } from "./classes/merchant.js";
import { Ranger } from "./classes/ranger.js";
import { Warrior } from "./classes/warrior.js";
import { config as Config } from "./utils/config.js";
import * as Logger from "./utils/logger.js";

async function run() {
	Logger.override_console();
	try {
		Config.load_config();
		await Promise.all([
			AL.Game.loginJSONFile("credentials.json"),
			AL.Game.getGData(true, true)
		]);
		Logger.log("System", "Credentials loaded!");
		Logger.log("System", "Game data loaded!");
		await AL.Pathfinder.prepare(AL.Game.G, {
			remove_abtesting: true, remove_test: true, cheat: true,
			remove_bank_b: true, remove_bank_u: true
		});
		Logger.log("System", "Pathfinder ready!");

		const characters = [
			new Merchant(Config.get_config<string>("merchant_id")),
			new Warrior(Config.get_config<string>("warrior_id")),
			new Mage(Config.get_config<string>("mage_id")),
			new Ranger(Config.get_config<string>("ranger_id"))
		];
		// Start all characters
		await Promise.all(characters.map(async character => {
			return character.start_character(
				Config.get_config<ServerRegion>("server_region"),
				Config.get_config<ServerIdentifier>("server_identifier")
			);
		}));
		// Run all characters
		await Promise.allSettled(characters.map(async character => {
			return character.run();
		}));
		Logger.log("System", "Script finished!");
	} catch (e) {
		Logger.error("System", e.message);
	}
}

run().then(() => {
	process.exit(0);
}).catch(() => { });


/**
 * TODO:
 * 1. if a character dies, it should be able to respawn and continue.
 * -- Currently if it dies, run terminate and they all disconnect.
 * 2. if a character disconnects, it should be able to reconnect and continue.
 * -- Currently if it disconnects, run terminate and they all disconnect.
 * 3. Character should create a team.
 * -- The leader should be able to invite other characters to the team.
 * -- the ones that are not leader should be able to accept the invite.
 * 4. The leader should be able to set the target for all characters.
 * 5. The leader should be able to set the mode for all characters.
 * X. Don't forget to await on all Promises!
 */

/**
 * TODO:
 * Rename classes to BotWarrior, BotMage, BotRanger, BotMerchant.
 * Remove aliases for GameWarrior, GameMage, GameRanger, GameMerchant.
 */
