import { MonsterName, ServerIdentifier, ServerRegion } from 'alclient';
import fs from 'fs';
import path from 'path';
import * as Logger from './logger.js';

type ConfigType =
	string | number | boolean | ServerRegion | ServerIdentifier | MonsterName[];

class __Config {
	static #instance: __Config;
	static #values: Record<string, ConfigType> = {};

	constructor() {
		if (__Config.#instance)
			throw new Error("Cannot create a new instance of Config");
		this.set_config<ServerRegion>("server_region", "EU");
		this.set_config<ServerIdentifier>("server_identifier", "I");
		this.set_config<string>("mage_id", "WizSaint");
		this.set_config<string>("ranger_id", "BowSaint");
		this.set_config<string>("warrior_id", "WarSaint");
		this.set_config<string>("merchant_id", "MonSaint");
		this.set_config<boolean>("saving_logs", true);
		this.set_config<boolean>("printing_loots", true);
		this.set_config<boolean>("printing_gold", false);
		this.set_config<MonsterName[]>("targets", [
			"bat",
			// "squigtoad", "squig",
			// "minimush",
			"mrpumpkin", "mrgreen", "phoenix",

		]);
		this.set_config<MonsterName[]>("allowed_hunt_ids", [
			"osnake", "snake", "bee", "goo", "armadillo", "minimush", "rat", "crab", "squig",
			"arcticbee", "nerfedbat", "croc", "bat", "tortoise", "squigtoad",

			"iceroamer", // Possible but dangerous if leveled

			"bgoo" // seems not in the quests
		]);
	}

	static init() {
		if (!__Config.#instance)
			__Config.#instance = new __Config();
		return __Config.#instance;
	}

	load_config() {
		const config_path = path.resolve(
			path.dirname(new URL(import.meta.url).pathname),
			'../config.json'
		);
		if (!fs.existsSync(config_path)) {
			Logger.warn("Config", "Config file not found, creating a new one");
			fs.writeFileSync(config_path,
				JSON.stringify(__Config.#values, null, 2)
			);
		} else {
			const fc = fs.readFileSync(config_path, 'utf-8');
			try {
				const cfg = JSON.parse(fc);
				if (typeof cfg !== 'object' || cfg === null) {
					throw new Error("Invalid config file");
				}
				for (const key in cfg) {
					if (!(key in __Config.#values)) {
						Logger.warn("Config", `Unknown key in config: '${key}'`);
						delete cfg[key];
						continue;
					}
					if (typeof cfg[key] !== typeof __Config.#values[key]) {
						cfg[key] = __Config.#values[key];
						Logger.error("Config", `Invalid type for key: '${key}'`);
						Logger.warn("Config",
							`Using default value: '${key}'='${cfg[key]}'`
						);
					}
				}
				__Config.#values = cfg;
			} catch (error: unknown) {
				throw new Error("Error loading config file: " + error);
			}
		}
		Logger.log("Config", "Config loaded!");
	}

	set_config<T extends ConfigType>(key: string, value: T): void {
		__Config.#values[key] = value;
	}

	unset_config(key: string): void {
		if (key in __Config.#values) delete __Config.#values[key];
		else Logger.error("Config", `Attempted to unset non-existent key: '${key}'`);
	}

	save_config() {
		const config_path = path.resolve(
			path.dirname(new URL(import.meta.url).pathname),
			'../config.json'
		);
		fs.writeFileSync(config_path, JSON.stringify(__Config.#values, null, 2));
		Logger.log("Config", "Config saved!");
	}

	get_config<T extends ConfigType>(key: string): T | undefined {
		if (key in __Config.#values) return __Config.#values[key] as T;
		return undefined;
	}
}

export const Config = __Config.init();

export default Config;
