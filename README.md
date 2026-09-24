# aland

A multi-character automation bot for **[Adventure Land](https://adventure.land/)** — an idle MMORPG — written in TypeScript on top of [`alclient`](https://github.com/earthiverse/ALClient).

The bot logs in four characters (a merchant plus three combat classes), keeps them in a party, farms a configurable set of monsters, and handles the logistics of an active account: selling junk, refilling potions, looting chests, upgrading and compounding gear on the merchant, and applying `mluck` to nearby players.

> **Status:** personal/experimental. It is actively played but has rough edges — see [Known limitations](#known-limitations).

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Task system](#task-system)
- [Item management](#item-management)
- [Logging](#logging)
- [Development](#development)
- [Known limitations](#known-limitations)

---

## Features

**Combat**
- Multi-character party: a ranger acts as party leader and invites the other three; members auto-accept invites from known IDs.
- Configurable target list, with automatic retargeting toward the lowest-HP enemy in range and, for the ranger, the furthest valid target.
- Auto-attack on cooldown, `charge` for warriors when the target is far, and smart movement / pathfinding toward the next monster when nothing is in range.
- Reactive survival logic: warps to jail when incoming damage (including `dreturn`) would be lethal.
- Auto-death handling: respawns after death.

**Resource management**
- Refills `hpot0` / `mpot0` from the nearest NPC when stock or gold runs low.
- Drinks potions in combat based on the lower of HP%/MP% (with `regenHP` / `regenMP` fallback).
- Opens chests and credits loot/gold in the log.
- Sells unwanted items and ships gold plus improvable gear to the merchant.

**Merchant**
- Opens/closes the merchant stand automatically (closed while moving).
- Casts `mluck` on nearby players and party members that lack the buff.
- Auto‑upgrades and auto‑compounds gear with the appropriate scrolls, buying more when needed.
- Sends its own inventory/handling defaults to dedicated bank/inventory slots.

**Engine**
- Promise-based task scheduler with per-task timeouts and self-rescheduling, so one failing task doesn't kill the loop.
- Centralized `ItemsManagement` model: every item in the game gets sell / upgrade / compound / storage rules.
- JSON config loaded from `build/config.json`, auto-generated with defaults on first run and type-checked on load.
- Colored console logging with daily log files, JSON pretty-printing, and noisy-error filtering.

---

## Architecture

```
                 main.ts
                    │  loads credentials + game data, prepares pathfinder
                    ▼
   ┌───────────────┬───────────────┬───────────────┐
   │  BotMerchant  │  BotWarrior   │  BotMage      │  BotRanger (leader)
   └───────────────┴───────────────┴───────────────┘
                    │  extends
                    ▼
                  Bot (abstract)  ── mode / state / targets / leader flag
                    │              ── socket listeners (invite, hit→unstack, disconnect)
                    │              ── ItemsManagement instance per bot
                    ▼
             TaskLauncher.start(task, bot, timeout)   ← per-task timer
                    │
                    ▼
        task.*.ts  (attack, move, target, loot, potion, refill, …)
```

Each `Bot` runs its own infinite loop: it launches a fixed set of recurring tasks, waits while the socket is connected, and reconnects (up to 30 attempts, 15 s apart) when the connection drops.

**Timers instead of a central tick loop.** Every task is a function `(bot, timeout) => Promise<number>` returning the delay before its next run. `TaskLauncher` stores that timer on `gc.timeouts`, so tasks reschedule themselves and can be restarted individually. If a bot is idle, disconnected, or not `ready`, the task is simply postponed.

---

## Project layout

```
src/
├── main.ts                     # entry point: login, load game data, start bots
├── classes/
│   ├── bot.ts                  # abstract Bot (state machine, listeners, lifecycle)
│   ├── merchant.ts             # BotMerchant   (stand, mluck, upgrade/compound)
│   ├── warrior.ts              # BotWarrior    (combat)
│   ├── mage.ts                 # BotMage       (combat)
│   └── ranger.ts               # BotRanger     (combat + party leader)
├── tasks/
│   ├── task.ts                 # task registry / barrel export
│   ├── constants.ts            # timeouts + basic item constants
│   ├── launcher.ts             # start / stop / restart of recurring tasks
│   ├── task.attack.ts          # basic attacks on the current target
│   ├── task.target.ts          # target selection
│   ├── task.move.ts            # approach target / farm area
│   ├── task.survival.ts        # lethal-damage detection, retreat to jail
│   ├── task.respawn.ts         # respawn after death
│   ├── task.potion.ts          # HP/MP potion usage
│   ├── task.refill.ts          # buy potions from NPC
│   ├── task.loot.ts            # open chests
│   ├── task.items.ts           # sell junk, ship gold/gear to merchant
│   ├── task.mstand.ts          # merchant stand open/close
│   ├── task.mluck.ts           # buff nearby players
│   ├── task.auto_upgrade.ts    # merchant: upgrade gear
│   ├── task.auto_compound.ts   # merchant: compound gear
│   ├── task.auto_exchange.ts   # merchant: exchange (not implemented)
│   ├── task.party.ts           # leader invites the other characters
│   └── task.hunt.ts            # monster-hunt quests (currently disabled)
└── utils/
    ├── config.ts               # singleton JSON config
    ├── items.ts                # item lookup/grade/scroll helpers
    ├── items_management.ts     # per-item policy model
    ├── logger.ts               # colored logs + daily files
    ├── very_smart_move.ts      # smartMove wrapper with retry
    ├── caught_promise.ts       # promise error normalization
    ├── chunk.ts                # array → chunks
    └── sleep.ts                # promise sleep
```

### Classes

| Class | Type | Role |
|---|---|---|
| `BotMerchant` | `merchant` | Runs the stand, buffs with `mluck`, owns upgrading/compounding and item logistics. Does not fight. |
| `BotWarrior` | `warrior` | Melee combat, uses `charge` to close gaps. |
| `BotMage` | `mage` | Combat. |
| `BotRanger` | `ranger` | Combat, prefers the furthest target; **party leader**. |

`Bot` exposes `mode` (`Idle` / `Running`), `state` (`ATTACKING`, `REFILL`, `TAKE_QUEST`, `SELLING`, `RETREATING`, `POSITIONING`, …), `targets`, and `is_leader`.

---

## Getting started

### Requirements

- **Node.js** 18+ (developed on Node 26) and npm
- An Adventure Land account with the characters you intend to run
- TypeScript is installed locally as a dev dependency

### Install

```bash
git clone git@github.com:Yezarath/aland.git
cd aland
npm install
```

### Credentials

The bot logs in from a local `credentials.json` in the project root. This file is **gitignored — never commit it**. It holds a single account:

```json
{
  "email": "you@example.com",
  "password": "your-password",
  "userAuth": "<auth token>",
  "userID": "<user id>"
}
```

`userAuth` and `userID` are produced by `alclient`'s login flow; a minimal `email` + `password` file is enough to start (`AL.Game.loginJSONFile` will fill in the rest).

### Run

```bash
npm start
```

`npm start` performs three steps:

1. `npm run build` — compiles `src/` → `build/` with `tsc`
2. `npm run credentials` — copies `credentials.json` into `build/`
3. `node --no-deprecation build/main.js` — starts the bots

Stop the bot with `Ctrl+C`; the process traps `SIGINT`/`SIGTERM` and disconnects cleanly.

### First run

There is no `config.json` in the repository. On first start the bot creates `build/config.json` from the built-in defaults, logs `Config file not found, creating a new one`, and runs with those values. Edit that file and restart to change behavior.

---

## Configuration

`build/config.json` — created automatically, validated on load, unknown keys and type mismatches are rejected with a warning and replaced by defaults.

| Key | Type | Default | Description |
|---|---|---|---|
| `server_region` | `"EU" \| "US"` | `"EU"` | Region to connect to. |
| `server_identifier` | `"I" \| "II" \| "III"` | `"I"` | Server within the region. |
| `mage_id` | string | `"WizSaint"` | Mage character name. |
| `ranger_id` | string | `"BowSaint"` | Ranger character name (party leader). |
| `warrior_id` | string | `"WarSaint"` | Warrior character name. |
| `merchant_id` | string | `"MonSaint"` | Merchant character name. |
| `saving_logs` | boolean | `true` | Append logs to `build/log_MM_DD_YYYY.log`. |
| `printing_loots` | boolean | `true` | Print loot lines. |
| `printing_gold` | boolean | `false` | Print gold lines. |
| `targets` | `MonsterName[]` | `["bat","mrpumpkin","mrgreen","phoenix"]` | Monsters to farm. |
| `allowed_hunt_ids` | `MonsterName[]` | see below | Monster-hunt quest IDs the bot will accept. |

Default `allowed_hunt_ids`: `osnake`, `snake`, `bee`, `goo`, `armadillo`, `minimush`, `rat`, `crab`, `squig`, `arcticbee`, `nerfedbat`, `croc`, `bat`, `tortoise`, `squigtoad`, `iceroamer`, `bgoo`.

> Note: the character-name defaults are placeholders from the original account. Change all four `*_id` values to your own characters before running.

### Tuning constants

Timeouts and potion thresholds live in [`src/tasks/constants.ts`](src/tasks/constants.ts) and require a rebuild:

- `MIN_HPOT` / `MIN_MPOT` (`75`) — refill below this count
- `HPOT_TO_REFILL` / `MPOT_TO_REFILL` (`2000`) — target stock
- `ATTACK` (`10 ms`), `MOVE` (`130 ms`), `SURVIVAL` (`10 ms`) — fast combat loops
- `LOOT` (`500 ms`), `POTION` (`350 ms`), `TARGET` (`30 ms`)
- `REFILL` (`60 s`), `SELLING` (`10 s`), `PARTY` (`10 s`), `RESPAWN` (`3 s`)

---

## Task system

A task has the signature:

```ts
export async function task<T extends Bot>(self: T, timeout: number): Promise<number>
```

It returns the number of milliseconds to wait before running again. Tasks are registered on `Task` (the barrel in `src/tasks/task.ts`) and scheduled by the launcher:

```ts
TaskLauncher.start(Task.attack, self, Task.Constants.Timeouts.ATTACK);
```

| Task | Runs on | Purpose |
|---|---|---|
| `party` | leader (ranger) | Invite the other three characters; retries on failure. |
| `move` | combat bots | Move to the target or to the farm area; uses `charge` when far. |
| `attack` | combat bots | `basicAttack` when the target is in range and off cooldown. |
| `target` | combat bots | Pick the lowest-HP target in range (furthest for ranger). |
| `survival` | combat bots | Retreat to jail when incoming damage would be lethal. |
| `loot` | all | Open chests, log items and gold. |
| `items` | all | Sell junk; send improvable items and surplus gold to the merchant. |
| `refill` | all | Buy potions when running low. |
| `potion` | all | Drink HP/MP potions during combat. |
| `respawn` | all | Respawn after death. |
| `mstand` | merchant | Open the stand when stationary, close it when moving. |
| `mluck` | merchant | Buff nearby players that lack `mluck`. |
| `auto_upgrade` | merchant | Upgrade gear with `scroll*` and `massproduction`. |
| `auto_compound` | merchant | Compound gear in sets of 3 with `cscroll*`. |
| `auto_exchange` | merchant | Placeholder — returns immediately. |
| `hunt_start` / `hunt_finish` | combat bots | Monster-hunt quests. **Currently not launched.** |

Tasks that change the bot's `state` (selling, refilling, questing) restore the previous state in a `finally` block after a short release delay, so combat tasks skip while the bot is busy.

---

## Item management

`ItemsManagement` (one instance per bot) assigns a policy to **every** item in the game:

```ts
type ItemOptions = {
  should_sell: boolean;      // sell to NPC      ┐
  should_msell: boolean;     // sell in stand    │ mutually exclusive
  should_upgrade: boolean;   // auto-upgrade     │
  should_compound: boolean;  // auto-compound    ┘
  ignore_titled: boolean;
  ignore_level: boolean;
  msell_at?: number;         // stand listing price
  improve_to?: number;       // max level to upgrade/compound to
};

type ItemStorage = {
  storage_place: "inventory" | "bank" | "none";
  storage_slot: number | undefined;
};
```

- Defaults are derived from the game data: items with `upgrade` become upgradable, items with `compound` become compoundable, everything else is neither.
- `load_defaults()` in [`src/utils/items_management.ts`](src/utils/items_management.ts) is the human-readable policy table: junk to auto-sell, T1/T2 armor and weapons to upgrade (levels 5–8), jewelry/orbs/capes to compound (levels 2–4).
- `BotMerchant` overrides a few defaults to reserve fixed stand slots.

Helpers in [`src/utils/items.ts`](src/utils/items.ts):

- `locate_items_by_level` — group inventory items by name and level, with filters for sell/upgrade/compound and `min_amount` (used to require 3 copies before compounding).
- `calculate_item_grade` — map an item level to a scroll tier (`scroll0`…`scroll3`).
- `get_qscroll_to_buy` — buy just enough scrolls, keeping one spare.

**Gold and gear flow:** combat bots sell junk to the nearest NPC, then fly to the merchant, send surplus gold (keeping a 50 000 buffer) and all improvable items. The merchant upgrades/compounds them. This is explicitly a temporary design — the code comments note it should eventually go through the bank.

---

## Logging

`src/utils/logger.ts` provides leveled, color-coded output:

| Level | Color | Use |
|---|---|---|
| `INFO` | blue | default |
| `WARNING` | yellow | recoverable problems |
| `ERROR` | red | failures (noisy known errors are filtered) |
| `DEBUG` | grey | protocol dumps, e.g. `limitdcreport` |
| `EVENT` | salmon | milestones (party joined, quest taken, item upgraded) |
| `EVENT_KO` | orange | failed milestones, survival triggers |
| `LOOT` | green | items looted (gated by `printing_loots`) |
| `GOLD` | yellow | gold looted (gated by `printing_gold`) |

- Timestamps are formatted for **Europe/Paris**.
- With `saving_logs: true`, output is appended to `build/log_MM_DD_YYYY.log`.
- `override_console()` silences `console.*` calls that don't originate from the logger, so third-party library noise stays out of the terminal. Raw output can be resumed by tracing through `aland_tracker`.
- `is_ignored_error()` suppresses expected chatter (interrupted `smartMove`, `acceptPartyInvite timeout`, out-of-range attacks, …).

---

## Development

```bash
npm run build          # compile once
npx tsc --noEmit       # type-check only
npx eslint src         # lint
```

- **Language:** TypeScript, `strict`, ESM (`"type": "module"`), `target`/`module` `ESNext`, output to `build/`.
- **Imports must use the `.js` extension** (NodeNext-style ESM), e.g. `import Config from './config.js'`. A few existing files omit it and rely on the bundler leniency of the current setup — keep extensions when adding files.
- **Data files:** `G_*.json` are gitignored game-data snapshots. At runtime the bot fetches its own data via `AL.Game.getGData()`, so these are only useful for tooling/debugging.
- **`snippet.js`** is gitignored scratch code — in-game console snippets for manual upgrading/transferring.
- The `task.ts` ↔ `launcher.ts` ↔ `task.*.ts` modules form an intentional but circular import graph (the launcher needs `task.name`, tasks need `Task.Constants`). It works with ESM function hoisting; splitting constants out of the registry would remove the cycle.

---

## Known limitations

Tracked in the `TODO` block at the bottom of [`src/main.ts`](src/main.ts):

1. **Death/disconnect handling is partial.** A socket drop disconnects the character and the reconnect loop retries up to 30 times; if the whole run rejects, the process exits rather than restarting the character.
2. **Monster-hunt questing is disabled** — `Task.hunt_start` is commented out of the bot loop, and the fading-timeout comment in `task.hunt.ts` marks it as unfinished.
3. **`auto_exchange` is a stub** (`TODO` in the file).
4. **No banking yet.** Gold and improvable items are pushed to the merchant instead of a bank.
5. **Party composition is hardcoded** to the four configured IDs rather than described in config.
6. **Survival checks cover direct and `dreturn` damage only** — burn, poison, and conditional damage are not modelled yet.
7. **Class naming history:** `Bot` subclasses previously aliased the `alclient` types (`GameWarrior`, `GameMage`, …); the `TODO` notes to drop the aliases.
