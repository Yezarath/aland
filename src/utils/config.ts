import { MonsterName, ServerIdentifier, ServerRegion } from 'alclient';
import fs from 'fs';
import path from 'path';
import * as Logger from './logger.js';

type CfgValueType =
	string | number | boolean | ServerRegion | ServerIdentifier | MonsterName[];

class Config {
	static #instance: Config;
	static #config: Record<string, CfgValueType> = {};

	constructor() {
		if (Config.#instance) {
			throw new Error("Cannot create a new instance of Config");
		}
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
			"osnake", "snake"
		]);
		this.set_config<MonsterName[]>("allowed_hunt_ids", [
			"osnake", "snake", "bee", "goo", "armadillo", "minimush"
		])
	}

	static init() {
		if (!Config.#instance) {
			Config.#instance = new Config();
		}
		return Config.#instance;
	}

	load_config() {
		const config_path = path.resolve(
			path.dirname(new URL(import.meta.url).pathname),
			'../config.json'
		);
		if (!fs.existsSync(config_path)) {
			Logger.warn("Config", "Config file not found, creating a new one");
			fs.writeFileSync(config_path,
				JSON.stringify(Config.#config, null, 2)
			);
		} else {
			const fc = fs.readFileSync(config_path, 'utf-8');
			try {
				const cfg = JSON.parse(fc);
				if (typeof cfg !== 'object' || cfg === null) {
					throw new Error("Invalid config file");
				}
				for (const key in cfg) {
					if (!(key in Config.#config)) {
						Logger.warn("Config", `Unknown key in config: '${key}'`);
						delete cfg[key];
						continue;
					}
					if (typeof cfg[key] !== typeof Config.#config[key]) {
						cfg[key] = Config.#config[key];
						Logger.error("Config", `Invalid type for key: '${key}'`);
						Logger.warn("Config",
							`Using default value: '${key}'='${cfg[key]}'`
						);
					}
				}
				Config.#config = cfg;
			} catch (error) {
				throw new Error("Error loading config file: " + error.message);
			}
		}
		Logger.log("Config", "Config loaded!");
	}

	set_config<T extends CfgValueType>(key: string, value: T): void {
		Config.#config[key] = value;
	}

	unset_config(key: string): void {
		if (key in Config.#config) {
			delete Config.#config[key];
		} else {
			Logger.error("Config", `Attempted to unset non-existent key: '${key}'`);
		}
	}

	save_config() {
		const config_path = path.resolve(
			path.dirname(new URL(import.meta.url).pathname),
			'../config.json'
		);
		fs.writeFileSync(config_path,
			JSON.stringify(Config.#config, null, 2)
		);
		Logger.log("Config", "Config saved!");
	}

	get_config<T extends CfgValueType>(key: string): T | undefined {
		if (!(key in Config.#config)) {
			return undefined;
		}
		return Config.#config[key] as T;
	}
}

export const config = Config.init();
