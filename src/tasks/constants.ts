import { ItemName } from "alclient";

export const Constants = {
	Timeouts: {
		MOVE: 130,
		ATTACK: 10,
		TARGET: 30,
		LOOT: 250,
		POTION: 350,
		HUNT_START: 1000,
		HUNT_OFFSET: 50000,
		HUNT_FINISH: 1000,
		MLUCK: 300,
		MSTAND: 1000,
		PARTY: 10000,
		RESPAWN: 3000,
		REFILL: 60_000,
		SELLING: 10_000,
		STATE_RELEASE: 30,
		get NEXT_REFILL() { return this.REFILL * 30 },
	} as const,
	Basics: {
		MIN_HPOT: 75,
		MIN_MPOT: 75,
		HPOT_TO_REFILL: 2000,
		MPOT_TO_REFILL: 2000,
		MPOT_TYPE: "mpot0" as ItemName,
		HPOT_TYPE: "hpot0" as ItemName
	}
} as const;


export default Constants;
