import { CharacterStats, createCharacter, EquipmentLoadout } from './progression';

interface HeroPreset {
    name: string; gender: 'male' | 'female'; role: string;
    art: string; seed: number; equipment: EquipmentLoadout;
    artifacts: readonly string[]; skills: readonly string[];
}

export const HERO_PRESETS = {
    'song-ge': { name: '仗义宋哥', gender: 'male', role: '重装护卫', art: 'cn_guardian', seed: 469836862,
        equipment: { weapon: 'war-mace', armor: 'novice-armor' }, artifacts: ['life-charm'],
        skills: ['heavy-strike', 'piercing-thrust', 'aimed-shot'] },
    alan: { name: '游侠阿兰', gender: 'male', role: '抵近射手', art: 'ranger', seed: 4281815158,
        equipment: { weapon: 'shortbow', armor: 'leather-armor' }, artifacts: ['hunter-mark', 'agility-feather'],
        skills: ['aimed-shot', 'piercing-ray', 'piercing-thrust'] },
    zhang: { name: '冒险者小张', gender: 'male', role: '近战突击', art: 'vanguard', seed: 1082381257,
        equipment: { weapon: 'iron-sword', armor: 'chain-armor' }, artifacts: ['life-charm', 'agility-feather'],
        skills: ['heavy-strike', 'piercing-thrust', 'aimed-shot'] },
    ayang: { name: '参谋阿阳', gender: 'male', role: '术法支援', art: 'cn_blade', seed: 2008458740,
        equipment: { weapon: 'iron-sword', armor: 'mage-robe' }, artifacts: ['mana-ring', 'arcane-core'],
        skills: ['piercing-ray', 'arcane-bolt', 'flame-cross'] },
    mu: { name: '铁卫肯子', gender: 'male', role: '前排守线', art: 'guardian', seed: 2052405731,
        equipment: { weapon: 'war-mace', armor: 'novice-armor' }, artifacts: ['life-charm'],
        skills: ['heavy-strike', 'piercing-thrust', 'aimed-shot'] },
    lia: { name: '星术师莉娅', gender: 'female', role: '奥术爆发', art: 'mage', seed: 1054690963,
        equipment: { weapon: 'arcane-staff', armor: 'crystal-armor' }, artifacts: ['arcane-core', 'mana-ring'],
        skills: ['arcane-bolt', 'flame-cross', 'piercing-ray'] },
    qinghe: { name: '弓手青禾', gender: 'female', role: '轻装游击', art: 'cn_archer', seed: 1994639252,
        equipment: { weapon: 'shortbow', armor: 'leather-armor' }, artifacts: ['hunter-mark', 'agility-feather'],
        skills: ['aimed-shot', 'piercing-thrust', 'piercing-ray'] },
    'dong-ge': { name: '东哥', gender: 'male', role: '抵近射手', art: 'dong_ranger', seed: 4281815158,
        equipment: { weapon: 'shortbow', armor: 'leather-armor' }, artifacts: ['hunter-mark', 'agility-feather'],
        skills: ['aimed-shot', 'piercing-ray', 'piercing-thrust'] },
    'xiao-xu': { name: '盾战士小徐', gender: 'male', role: '持盾护卫', art: 'xu_guardian', seed: 2052405731,
        equipment: { weapon: 'iron-sword', armor: 'chain-armor' }, artifacts: ['life-charm'],
        skills: ['heavy-strike', 'piercing-thrust', 'aimed-shot'] },
    yunlan: { name: '玄术师云岚', gender: 'female', role: '玄术支援', art: 'cn_mage', seed: 3975662818,
        equipment: { weapon: 'apprentice-staff', armor: 'mage-robe' }, artifacts: ['arcane-core', 'mana-ring'],
        skills: ['healing', 'arcane-bolt', 'piercing-ray'] }
} as const satisfies Record<string, HeroPreset>;

export type HeroId = keyof typeof HERO_PRESETS;
export type HeroArtId = typeof HERO_PRESETS[HeroId]['art'];
export const HERO_IDS = Object.keys(HERO_PRESETS) as HeroId[];
export const DEFAULT_HERO_IDS: readonly HeroId[] = ['song-ge', 'alan', 'zhang', 'ayang', 'mu'];
export function isHeroId(value: unknown): value is HeroId {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(HERO_PRESETS, value);
}
export function createHero(id: HeroId): CharacterStats {
    const preset = HERO_PRESETS[id];
    return createCharacter('human', preset.seed, 3, preset.equipment, [...preset.artifacts]);
}
