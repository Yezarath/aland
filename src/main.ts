import AL, { ServerIdentifier, ServerRegion } from "alclient";
import { BotMage } from "./classes/mage.js";
import { BotMerchant } from "./classes/merchant.js";
import { BotRanger } from "./classes/ranger.js";
import { BotWarrior } from "./classes/warrior.js";
import CaughtPromise from "./utils/caught_promise.js";
import Config from "./utils/config.js";
import * as Logger from "./utils/logger.js";

async function run() {
	Logger.override_console();
	Config.load_config();
	await CaughtPromise(async () => {
		await Promise.all([
			AL.Game.loginJSONFile("credentials.json", false),
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
			new BotMerchant(Config.get_config<string>("merchant_id")),
			new BotWarrior(Config.get_config<string>("warrior_id")),
			new BotMage(Config.get_config<string>("mage_id")),
			new BotRanger(Config.get_config<string>("ranger_id"))
		];
		// Start all characters
		await Promise.allSettled(characters.map(async character => {
			return character.start_character(
				Config.get_config<ServerRegion>("server_region") ?? "EU",
				Config.get_config<ServerIdentifier>("server_identifier") ?? "I"
			);
		})).then(results => results.forEach((result, index) => {
			if (result.status === "rejected") {
				Logger.error("System", result.reason.message);
				delete characters[index];
			}
		})).finally(() => {
			if (characters.length === 0) new Error("No characters were started!");
		});
		// Run all characters
		await Promise.allSettled(characters.map(async character => {
			return character.run();
		}));
		Logger.log("System", "Script finished normally!");
	}).catch(e => Logger.error("System", e.message));
}
run().then(() => { process.exit(0) });


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
