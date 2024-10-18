
import * as fs from 'fs';
import * as path from 'path';
import { config as Config } from './config.js';

export enum LogLevel {
	INFO = 'INFO',
	WARNING = 'WARNING',
	ERROR = 'ERROR',
	LOOT = 'LOOT',
	GOLD = 'GOLD',
}

export enum ClassType {
	MERCHANT = 'MERCHANT',
	WARRIOR = 'WARRIOR',
	PRIEST = 'PRIEST',
	RANGER = 'RANGER',
	MAGE = 'MAGE',
	ROGUE = 'ROGUE',
	PALADIN = 'PALADIN',
	SYSTEM = 'SYSTEM',
}

function get_log_color(log_level: LogLevel): string {
	if (log_level === LogLevel.INFO) return '\x1b[34m';
	if (log_level === LogLevel.WARNING) return '\x1b[33m';
	if (log_level === LogLevel.ERROR) return '\x1b[31m';
	if (log_level === LogLevel.LOOT) return '\x1b[38;5;46m'; // Green
	if (log_level === LogLevel.GOLD) return '\x1b[38;5;226m'; // Light yellow
}

function get_class_color(class_type: ClassType): string {
	if (class_type === ClassType.MERCHANT) return '\x1b[1m\x1b[33m';
	if (class_type === ClassType.WARRIOR) return '\x1b[1m\x1b[31m';
	if (class_type === ClassType.PRIEST) return '\x1b[1m\x1b[37m';
	if (class_type === ClassType.RANGER) return '\x1b[1m\x1b[32m';
	if (class_type === ClassType.MAGE) return '\x1b[2m\x1b[34m';
	if (class_type === ClassType.ROGUE) return '\x1b[1m\x1b[33m';
	if (class_type === ClassType.PALADIN) return '\x1b[1m\x1b[35m';
	if (class_type === ClassType.SYSTEM) return '\x1b[1m\x1b[90m';
}

export function log(name: string, message: string, options?: {
	class_type?: ClassType;
	log_level?: LogLevel;
}): void {
	if (!options) options = {};
	if (!options.class_type) options.class_type = ClassType.SYSTEM;
	if (!options.log_level) options.log_level = LogLevel.INFO;

	if (options.log_level === LogLevel.LOOT
		&& !Config.get_config<boolean>("printing_loots")) return;
	if (options.log_level === LogLevel.GOLD
		&& !Config.get_config<boolean>("printing_gold")) return;

	const log_color = get_log_color(options.log_level);
	const class_color = get_class_color(options.class_type);

	const date = new Date();
	const formatted_date = Intl.DateTimeFormat(undefined, {
		year: "numeric", month: "numeric", day: "numeric",
		hour: "numeric", minute: "numeric", second: "numeric",
		hour12: false, timeZone: "Europe/Paris",
	}).format(date);
	const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
	const padding = 9 - name.length;
	const bef_white_spaces = ' '.repeat((padding) / 2);
	const aft_white_spaces = ' '.repeat((padding) / 2 + (padding) % 2);

	const to_print =
		`${log_color}[${formatted_date}.${milliseconds}] ` +
		`| ${bef_white_spaces}` +
		`[${class_color}${name}\x1b[0m${log_color}]` +
		`${aft_white_spaces}~ ${message}\x1b[0m`;
	if (Config.get_config<boolean>("saving_logs") === true) {
		const date = formatted_date.substring(0, 10).replace(/\//g, "_");
		const file = path.resolve(
			path.dirname(new URL(import.meta.url).pathname),
			`../log_${date}.log`
		);
		fs.appendFileSync(file, to_print + "\n");
	}
	const aland_tracker = () => console.log(to_print);
	aland_tracker();
}

export function error(name: string, message: string, options?: {
	class_type?: ClassType;
}): void {
	log(name, message, {
		class_type: options?.class_type,
		log_level: LogLevel.ERROR
	});
}

export function warn(name: string, message: string, options?: {
	class_type?: ClassType;
}): void {
	log(name, message, {
		class_type: options?.class_type,
		log_level: LogLevel.WARNING
	});
}

let console_overriden = false;
const __console = {
	log: console.log,
	error: console.error,
	debug: console.debug,
	warn: console.warn,
	info: console.info
};

export function override_console() {
	if (console_overriden) return;
	const is_caller_allowed = () => {
		const stack = new Error().stack;
		if (stack) {
			const stack_lines = stack.split("\n");
			return stack_lines.some(line => line.match(/aland_tracker \(/));
		}
		return false;
	}

	console.log = (...args: unknown[]): void => {
		if (is_caller_allowed()) __console.log.apply(console, args);
	};

	console.error = (...args: unknown[]): void => {
		if (is_caller_allowed()) __console.error.apply(console, args);
	};

	console.debug = (...args: unknown[]): void => {
		if (is_caller_allowed()) __console.debug.apply(console, args);
	};

	console.warn = (...args: unknown[]): void => {
		if (is_caller_allowed()) __console.warn.apply(console, args);
	};

	console.info = (...args: unknown[]): void => {
		if (is_caller_allowed()) __console.info.apply(console, args);
	};
	console_overriden = true;
}
