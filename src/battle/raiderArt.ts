/** 人类外观独立于战斗数值，收服与保存后保留。 */
export const WOMEN_APPEARANCES = ["bandit_woman_blue","bandit_woman_shield","bandit_woman_corsair","bandit_woman_violet","bandit_woman_scout","bandit_woman_redhead","bandit_woman_cutlass","bandit_woman_huntress"] as const;
export const HUMAN_APPEARANCES = ['guard_spearman','guard_veteran','bandit_archer','bandit_raider',...WOMEN_APPEARANCES] as const;
export type HumanAppearance = typeof HUMAN_APPEARANCES[number];
export const HUMAN_APPEARANCE_NAMES: Record<HumanAppearance,string> = { guard_spearman:'流亡枪兵',guard_veteran:'佣兵重卫',bandit_archer:'盗匪弓手',bandit_raider:'女掠夺者',bandit_woman_blue:"青巾女匪",bandit_woman_shield:"女匪剑卫",bandit_woman_corsair:"游荡女盗",bandit_woman_violet:"紫衣女匪",bandit_woman_scout:"短发女匪",bandit_woman_redhead:"赤发盾卫",bandit_woman_cutlass:"弯刀女匪",bandit_woman_huntress:"山寨女弓手" };
export const HUMAN_MELEE_APPEARANCES: readonly HumanAppearance[] = ['guard_spearman','guard_veteran','bandit_raider','bandit_woman_shield','bandit_woman_corsair','bandit_woman_redhead','bandit_woman_cutlass'];
export const HUMAN_RANGED_APPEARANCES: readonly HumanAppearance[] = ['bandit_archer','bandit_woman_blue','bandit_woman_violet','bandit_woman_scout','bandit_woman_huntress'];
export function isHumanAppearance(value: unknown): value is HumanAppearance { return typeof value==='string'&&(HUMAN_APPEARANCES as readonly string[]).includes(value); }
