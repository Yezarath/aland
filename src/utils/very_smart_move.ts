
import {
	BankPackName,
	IPosition,
	ItemName,
	MapName,
	MonsterName,
	NPCName,
	SmartMoveOptions
} from 'alclient';
import { Bot } from '../classes/bot.js';

type SmTypes = IPosition | ItemName | MapName | MonsterName | NPCName | BankPackName;

export async function verySmartMove(self: Bot, dest: SmTypes, options?: SmartMoveOptions): Promise<void> {
	if (self.gc().smartMoving) await self.gc().stopSmartMove();
	await self.gc().smartMove(dest, {
		...options
	}).catch(async (e) => {
		if (!/We are having some trouble smartMoving/.test(e.message))
			throw new Error(e.message);
		// await self.gc().warpToJail().catch(() => { });
		await self.gc().smartMove(dest, {
			...options,
			avoidTownWarps: true
		});
	});
}
