// Integer point-buy baseline. Species and traits shape the starting attributes; equipment shapes final combat stats.
export const PRIMARY_STATS = [
    { key: 'constitution', name: '体质', cap: 100, specialty: '坚韧', benefit: '+3 HP' },
    { key: 'strength', name: '力量', cap: 100, specialty: '猛力', benefit: '+1 攻击' },
    { key: 'intelligence', name: '智力', cap: 100, specialty: '灵慧', benefit: '+1 法强' },
    { key: 'willpower', name: '意志', cap: 100, specialty: '坚心', benefit: '+2 MP' },
    { key: 'technique', name: '技巧', cap: 100, specialty: '精准', benefit: '+2 近战命中、+2 远程命中' },
    { key: 'agility', name: '敏捷', cap: 100, specialty: '灵巧', benefit: '+1 闪避、+1 速度' }
] as const;
export type PrimaryStat = typeof PRIMARY_STATS[number]['key'];
export type PrimaryAttributes = Record<PrimaryStat, number>;
export type SpeciesId = 'human' | 'slime' | 'gremlin' | 'goblin' | 'orc';
export const SPECIES: Record<SpeciesId, { name: string; minLevel: number; maxLevel: number; portrait: number; modifiers: Partial<PrimaryAttributes> }> = {
    human: { name: '人类', minLevel: 1, maxLevel: 10, portrait: 0, modifiers: { intelligence: 2, willpower: 1, technique: 1 } },
    slime: { name: '史莱姆', minLevel: 1, maxLevel: 5, portrait: 1, modifiers: { strength: -3, intelligence: -1, technique: -2, agility: -2 } },
    gremlin: { name: '地精', minLevel: 2, maxLevel: 8, portrait: 2, modifiers: { constitution: -5, strength: -2, intelligence: 4, willpower: 2, technique: 1 } },
    // Initial orc balance keeps the established goblin growth budget; no combat formula changes.
    orc: { name: '兽人', minLevel: 3, maxLevel: 10, portrait: 3, modifiers: { constitution: -2, strength: 1, intelligence: -1, technique: 2, agility: 4 } },
    goblin: { name: '哥布林', minLevel: 3, maxLevel: 10, portrait: 3, modifiers: { constitution: -2, strength: 1, intelligence: -1, technique: 2, agility: 4 } }
};
export const SPECIAL_TEMPLATES = { boss: null, pet: null } as const;
export const MAX_LEVEL = 20;
export const GROWTH_TIERS = [
    { id: 'common', name: '常人', weight: 50, min: 6, max: 8 },
    { id: 'gifted', name: '良才', weight: 30, min: 9, max: 11 },
    { id: 'excellent', name: '卓越', weight: 10, min: 12, max: 14 },
    { id: 'genius', name: '天才', weight: 9, min: 15, max: 16 },
    { id: 'chosen', name: '天选', weight: 1, min: 17, max: 18 }
] as const;
export type TierId = typeof GROWTH_TIERS[number]['id'];
export type TraitTier = 'common' | 'rare' | 'excellent';
export type TraitGroup = 'body' | 'mind' | 'combat' | 'movement' | 'magic' | 'precision' | 'will' | 'spirit';
export interface TraitDefinition { id: string; name: string; tier: TraitTier; group: TraitGroup; modifiers: Partial<PrimaryAttributes>; excludes?: string[] }
const t = (id: string, name: string, tier: TraitTier, group: TraitGroup, modifiers: Partial<PrimaryAttributes>, excludes: string[] = []): TraitDefinition => ({ id, name, tier, group, modifiers, excludes });
export const TRAITS: TraitDefinition[] = [
    t('strong', '强壮', 'common', 'body', { constitution: 1, strength: 2, agility: -1 }, ['weak']),
    t('healthy', '健壮', 'common', 'body', { constitution: 2, willpower: 1, agility: -1 }, ['frail']),
    t('weak', '瘦弱', 'common', 'body', { constitution: -2, strength: -1, intelligence: 1, agility: 1 }, ['strong', 'healthy']),
    t('clever', '聪慧', 'common', 'mind', { strength: -1, intelligence: 2, willpower: 1 }, ['dull']),
    t('nimble', '灵巧', 'common', 'movement', { constitution: -1, technique: 1, agility: 2 }, ['vacant']),
    t('precise', '精准', 'common', 'precision', { technique: 2, agility: -1 }, ['rough']),
    t('rough', '粗鲁', 'common', 'combat', { strength: 2, intelligence: -1, technique: -1 }, ['precise']),
    t('dull', '迟钝', 'common', 'mind', { constitution: 1, intelligence: -2, technique: -1 }, ['clever']),
    t('steadfast', '坚忍', 'common', 'body', { constitution: 2, willpower: 2, technique: -1, agility: -1 }, ['light']),
    t('resolute', '坚定', 'common', 'will', { willpower: 2, agility: -1 }, ['coward']),
    t('alert', '机敏', 'common', 'mind', { technique: 1, agility: 1 }, ['dull']),
    t('frail', '体弱', 'common', 'body', { constitution: -2, willpower: -1, agility: 1 }, ['healthy']),
    t('aggressive', '好斗', 'common', 'combat', { strength: 2, willpower: -1 }, ['coward']),
    t('temperate', '节制', 'common', 'will', { strength: -1, willpower: 2 }, ['aggressive']),
    t('observant', '善察', 'common', 'precision', { intelligence: 1, technique: 2, agility: -1 }, ['rough']),
    t('wild', '野性', 'common', 'combat', { constitution: 1, strength: 1, intelligence: -1, agility: 1 }),
    t('vacant', '呆滞', 'common', 'mind', { constitution: 1, intelligence: -1, technique: -1, agility: 1 }, ['clever', 'alert']),
    t('coward', '胆小', 'common', 'will', { constitution: -1, strength: -1, technique: 1, agility: 1 }, ['aggressive', 'resolute']),
    t('hardy', '耐劳', 'common', 'body', { constitution: 1, willpower: 1 }, ['frail']),
    t('light', '轻盈', 'common', 'movement', { constitution: -1, agility: 2 }, ['steadfast']),
    t('mighty', '巨力', 'rare', 'combat', { constitution: 2, strength: 4, intelligence: -2, agility: -1 }, ['nimble_hands', 'arcane_affinity', 'weak', 'frail']),
    t('iron_bone', '钢骨', 'rare', 'body', { constitution: 4, strength: 1, intelligence: -1, agility: -2 }, ['wind_blood']),
    t('arcane_affinity', '奥术亲和', 'rare', 'magic', { constitution: -1, strength: -2, intelligence: 4, willpower: 2 }, ['spellcraft', 'mighty']),
    t('hunter_instinct', '猎手本能', 'rare', 'movement', { constitution: -2, technique: 3, agility: 3 }, ['wind_blood']),
    t('keen_mind', '敏锐心智', 'rare', 'mind', { strength: -1, intelligence: 3, willpower: 1, technique: 2 }, ['dull']),
    t('veteran', '战场老兵', 'rare', 'combat', { constitution: 1, strength: 3, technique: 2, agility: -1 }, ['coward']),
    t('iron_will', '铁壁意志', 'rare', 'will', { constitution: 2, willpower: 4, technique: -1, agility: -1 }, ['spellcraft']),
    t('swift_blood', '迅捷血脉', 'rare', 'movement', { constitution: -2, technique: 2, agility: 4 }, ['iron_bone']),
    t('natural_tolerance', '天生耐受', 'rare', 'body', { constitution: 3, strength: 1, intelligence: -1, willpower: 2, agility: -1 }, ['frail']),
    t('wilderness', '野外求生', 'rare', 'movement', { constitution: 1, strength: 1, technique: 1, agility: 2 }, ['spellcraft']),
    t('two_hand_talent', '双手天赋', 'rare', 'combat', { constitution: 1, strength: 3, technique: -1 }),
    t('spellcraft', '法术专精', 'rare', 'magic', { constitution: -1, strength: -1, intelligence: 5, willpower: 1, agility: -1 }, ['arcane_affinity', 'iron_will']),
    t('soul_tenacity', '灵魂坚韧', 'rare', 'spirit', { constitution: 1, intelligence: 1, willpower: 3 }),
    t('marksman', '精准射手', 'rare', 'precision', { constitution: -1, technique: 5, agility: -1 }, ['rough']),
    t('first_strike', '先发体质', 'rare', 'movement', { constitution: -1, strength: 1, technique: 1, agility: 3 }, ['iron_bone']),
    t('born_strong', '天生神力', 'excellent', 'combat', { constitution: 3, strength: 6, intelligence: -2, agility: -2 }, ['perfect_caster', 'weak', 'frail']),
    t('arcane_genius', '奥术奇才', 'excellent', 'magic', { constitution: -3, strength: -2, intelligence: 6, willpower: 3 }, ['born_strong']),
    t('wind_blood', '风行血脉', 'excellent', 'movement', { constitution: -3, strength: -1, technique: 4, agility: 5 }, ['iron_bone']),
    t('steel_body', '钢铁之躯', 'excellent', 'body', { constitution: 6, strength: 2, intelligence: -2, agility: -3 }, ['wind_blood']),
    t('war_talent', '战争天赋', 'excellent', 'combat', { constitution: 2, strength: 5, intelligence: -1, technique: 3, agility: -2 }),
    t('perfect_caster', '完美施法者', 'excellent', 'magic', { constitution: -2, strength: -3, intelligence: 7, willpower: 4, agility: -1 }, ['born_strong']),
    t('killing_instinct', '猎杀本能', 'excellent', 'movement', { constitution: -3, strength: 1, technique: 5, agility: 6 }, ['iron_will']),
    t('unyielding', '不屈意志', 'excellent', 'will', { constitution: 3, willpower: 6, technique: -1, agility: -2 }, ['killing_instinct']),
    t('nimble_hands', '灵巧之手', 'excellent', 'precision', { constitution: -2, intelligence: 1, technique: 6, agility: 4 }, ['mighty']),
    t('beast_vigor', '野兽体魄', 'excellent', 'body', { constitution: 5, strength: 3, intelligence: -2, agility: 2 }, ['perfect_caster'])
];
export const TRAITS_BY_ID = Object.fromEntries(TRAITS.map(x => [x.id, x])) as Record<string, TraitDefinition>;
export const TRAIT_TIER_WEIGHTS: Record<TraitTier, number> = { common: 70, rare: 25, excellent: 5 };
export const TRAIT_COUNT_WEIGHTS = { 2: 30, 3: 50, 4: 20 } as const;
export type EquipmentSlot = 'weapon' | 'armor' | 'backpack';
export interface Equipment { id: string; name: string; slot: EquipmentSlot | 'artifact' | 'consumable' | 'essence' | 'valuable'; capacity?: number; quality?: 'common' | 'refined' | 'pure'; sellPrice?: number; description?: string; restore?: { resource: 'hp' | 'mp' | 'armor'; amount: number }; requirements?: Partial<PrimaryAttributes>; armor?: number; attack?: number; spellPower?: number; maxHp?: number; maxMp?: number; meleeHit?: number; rangedHit?: number; evasion?: number; speed?: number }
const req = (requirements: Partial<PrimaryAttributes>) => requirements;
export const EQUIPMENT: Record<string, Equipment> = {
    'vital-essence': { id: 'vital-essence', name: '生机精华', slot: 'essence', quality: 'common', description: '基地培养1–19点裸属性' },
    'refined-vital-essence': { id: 'refined-vital-essence', name: '凝练生机精华', slot: 'essence', quality: 'refined', description: '基地培养20–49点裸属性' },
    'martial-essence': { id: 'martial-essence', name: '武力精华', slot: 'essence', quality: 'common', description: '基地培养1–19点裸属性' },
    'refined-martial-essence': { id: 'refined-martial-essence', name: '凝练武力精华', slot: 'essence', quality: 'refined', description: '基地培养20–49点裸属性' },
    'arcane-essence': { id: 'arcane-essence', name: '灵能精华', slot: 'essence', quality: 'common', description: '基地培养1–19点裸属性' },
    'refined-arcane-essence': { id: 'refined-arcane-essence', name: '凝练灵能精华', slot: 'essence', quality: 'refined', description: '基地培养20–49点裸属性' },
    'pure-vital-essence': { id: 'pure-vital-essence', name: '纯粹生机精华', slot: 'essence', quality: 'pure', description: '基地培养50–79点裸属性' },
    'pure-martial-essence': { id: 'pure-martial-essence', name: '纯粹武力精华', slot: 'essence', quality: 'pure', description: '基地培养50–79点裸属性' },
    'pure-arcane-essence': { id: 'pure-arcane-essence', name: '纯粹灵能精华', slot: 'essence', quality: 'pure', description: '基地培养50–79点裸属性' },
    'worn-remains': { id: 'worn-remains', name: '破损残料', slot: 'valuable', sellPrice: 5, description: '可换取5金币' },
    'salvaged-trinket': { id: 'salvaged-trinket', name: '拾获饰物', slot: 'valuable', sellPrice: 12, description: '可换取12金币' },
    'chief-trophy': { id: 'chief-trophy', name: '首领战利品', slot: 'valuable', quality: 'refined', sellPrice: 45, description: '可换取45金币' },
    'travel-bag': { id: 'travel-bag', name: '旅行行囊', slot: 'backpack', capacity: 3 },
    'scout-bag': { id: 'scout-bag', name: '斥候行囊', slot: 'backpack', capacity: 4 },
    'expedition-bag': { id: 'expedition-bag', name: '远征行囊', slot: 'backpack', capacity: 6 },
    contract: { id: 'contract', name: '缔约契约', slot: 'consumable' },
    potion: { id: 'potion', name: '生命药剂', slot: 'consumable', restore: { resource: 'hp', amount: 30 } },
    ether: { id: 'ether', name: '魔力药剂', slot: 'consumable', restore: { resource: 'mp', amount: 30 } },
    'repair-kit': { id: 'repair-kit', name: '护甲修理包', slot: 'consumable', restore: { resource: 'armor', amount: 20 } },
    'repair-kit-large': { id: 'repair-kit-large', name: '高级护甲修理包', slot: 'consumable', restore: { resource: 'armor', amount: 40 } },
    'revival-stone': { id: 'revival-stone', name: '复苏石', slot: 'consumable' },
    'iron-sword': { id: 'iron-sword', name: '铁剑', slot: 'weapon', attack: 5 },
    'war-mace': { id: 'war-mace', name: '战锤', slot: 'weapon', requirements: req({ strength: 10 }), attack: 6 },
    greatsword: { id: 'greatsword', name: '巨剑', slot: 'weapon', requirements: req({ strength: 15 }), attack: 9, speed: -1 },
    shortbow: { id: 'shortbow', name: '短弓', slot: 'weapon', requirements: req({ technique: 8 }), attack: 3, rangedHit: 8 },
    'apprentice-staff': { id: 'apprentice-staff', name: '学徒法杖', slot: 'weapon', requirements: req({ intelligence: 8 }), spellPower: 6, maxMp: 4 },
    'arcane-staff': { id: 'arcane-staff', name: '奥术法杖', slot: 'weapon', requirements: req({ intelligence: 16 }), spellPower: 10, maxMp: 6 },
    'cloth-armor': { id: 'cloth-armor', name: '布甲', slot: 'armor', armor: 20, maxMp: 4 },
    'novice-armor': { id: 'novice-armor', name: '新人铠甲', slot: 'armor', armor: 20 },
    'leather-armor': { id: 'leather-armor', name: '皮甲', slot: 'armor', armor: 28, evasion: 1 },
    'chain-armor': { id: 'chain-armor', name: '链甲', slot: 'armor', requirements: req({ constitution: 10 }), armor: 36 },
    'heavy-plate': { id: 'heavy-plate', name: '重型板甲', slot: 'armor', requirements: req({ constitution: 15 }), armor: 44, speed: -1 },
    'giant-plate': { id: 'giant-plate', name: '巨人重甲', slot: 'armor', requirements: req({ constitution: 20 }), armor: 52, speed: -2 },
    'mage-robe': { id: 'mage-robe', name: '法师长袍', slot: 'armor', requirements: req({ intelligence: 12 }), armor: 24, spellPower: 3, maxMp: 6 },
    'crystal-armor': { id: 'crystal-armor', name: '水晶护甲', slot: 'armor', requirements: req({ intelligence: 18 }), armor: 32, spellPower: 5, maxMp: 8 },
    'life-charm': { id: 'life-charm', name: '生命护符', slot: 'artifact', requirements: req({ constitution: 8 }), maxHp: 12 },
    'mana-ring': { id: 'mana-ring', name: '魔力戒指', slot: 'artifact', requirements: req({ willpower: 8 }), maxMp: 8 },
    'hunter-mark': { id: 'hunter-mark', name: '猎手徽记', slot: 'artifact', requirements: req({ technique: 12 }), rangedHit: 10 },
    'agility-feather': { id: 'agility-feather', name: '敏捷羽饰', slot: 'artifact', requirements: req({ agility: 12 }), evasion: 2, speed: 1 },
    'arcane-core': { id: 'arcane-core', name: '奥术核心', slot: 'artifact', requirements: req({ intelligence: 15 }), spellPower: 10, maxMp: 8 },
    'giant-heart': { id: 'giant-heart', name: '巨人之心', slot: 'artifact', requirements: req({ constitution: 20 }), maxHp: 20 },
    'null-orb': { id: 'null-orb', name: '破法宝珠', slot: 'artifact', requirements: req({ intelligence: 22 }), spellPower: 14, rangedHit: 5 }
};
export interface EquipmentLoadout { weapon: string | null; armor: string | null; backpack?: string; }
export const bagCapacity = (loadout: EquipmentLoadout): number => EQUIPMENT[loadout.backpack || 'travel-bag']?.capacity || 3;
export interface Progression {
    version: 3; category: 'normal'; species: SpeciesId; level: number;
    seed: number; rng: number; tier: TierId; specialty: PrimaryStat;
    traits: string[]; potential: Record<PrimaryStat, 1 | 2 | 3>;
    attributes: PrimaryAttributes; freePoints: number; essenceGains?: Partial<PrimaryAttributes>;
}
export interface CombatStats {
    maxHp: number; maxArmor: number; maxMp: number; attack: number; spellPower: number;
    meleeHit: number; rangedHit: number; evasion: number; move: number; speed: number;
}
export interface CharacterStats extends CombatStats {
    hp: number; armor: number; mp: number; progression: Progression;
    equipment: EquipmentLoadout; artifacts: string[];
}
export const RESOURCE_LABELS = { hp: '生命', mp: '魔力', armor: '护甲' } as const;
const RESOURCE_MAX = { hp: 'maxHp', mp: 'maxMp', armor: 'maxArmor' } as const;
export function restorationError(u: CharacterStats, itemId: string): string | undefined {
    const restore = EQUIPMENT[itemId]?.restore;
    if (!restore) return '该道具不能恢复资源';
    if (u.hp <= 0) return '队员已倒下，请先使用复苏石';
    if (restore.resource === 'armor' && u.maxArmor === 0) return '没有可修复的护甲，请先装备防具';
    if (u[restore.resource] >= u[RESOURCE_MAX[restore.resource]]) return RESOURCE_LABELS[restore.resource] + '已满，无需使用' + EQUIPMENT[itemId].name;
    return undefined;
}
export function applyRestoration(u: CharacterStats, itemId: string): number {
    const error = restorationError(u, itemId); if (error) throw new Error(error);
    const restore = EQUIPMENT[itemId].restore!, amount = Math.min(restore.amount, u[RESOURCE_MAX[restore.resource]] - u[restore.resource]);
    u[restore.resource] += amount; return amount;
}
export function consumableDescription(item: Equipment): string {
    return item.restore ? '恢复' + item.restore.amount + RESOURCE_LABELS[item.restore.resource] : item.id === 'contract' ? '收服普通敌人' : item.id === 'revival-stone' ? '复活队友：20%生命、满魔力' : '';
}
const attributes = (value: number): PrimaryAttributes => Object.fromEntries(PRIMARY_STATS.map(s => [s.key, value])) as PrimaryAttributes;
const withModifiers = (base: PrimaryAttributes, modifiers: Partial<PrimaryAttributes>): PrimaryAttributes => {
    const next = { ...base };
    for (const stat of PRIMARY_STATS) next[stat.key] += modifiers[stat.key] || 0;
    return next;
};
function next(p: { rng: number }): number { let x = p.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; p.rng = x >>> 0; return p.rng / 4294967296; }
const integer = (p: { rng: number }, min: number, max: number) => min + Math.floor(next(p) * (max - min + 1));
export function totalStars(p: Progression): number { return PRIMARY_STATS.reduce((sum, s) => sum + p.potential[s.key], 0); }
export function talentTitle(p: Progression): string { return `${GROWTH_TIERS.find(t => t.id === p.tier)!.name}·${PRIMARY_STATS.find(s => s.key === p.specialty)!.specialty}`; }
export function traitNames(p: Progression): string[] { return p.traits.map(id => TRAITS_BY_ID[id]?.name || id); }
export function traitCompatible(candidate: TraitDefinition, chosen: TraitDefinition[]): boolean {
    return !chosen.some(x => x.id === candidate.id || x.group === candidate.group || candidate.excludes?.includes(x.id) || x.excludes?.includes(candidate.id));
}
function rollTraitTier(p: { rng: number }): TraitTier {
    const roll = integer(p, 0, 99);
    return roll < TRAIT_TIER_WEIGHTS.common ? 'common' : roll < TRAIT_TIER_WEIGHTS.common + TRAIT_TIER_WEIGHTS.rare ? 'rare' : 'excellent';
}
function rollTraits(p: { rng: number }): string[] {
    const countRoll = integer(p, 0, 99);
    const count = countRoll < TRAIT_COUNT_WEIGHTS[2] ? 2 : countRoll < TRAIT_COUNT_WEIGHTS[2] + TRAIT_COUNT_WEIGHTS[3] ? 3 : 4;
    const chosen: TraitDefinition[] = [];
    while (chosen.length < count) {
        const tier = rollTraitTier(p); const pool = TRAITS.filter(x => x.tier === tier && traitCompatible(x, chosen));
        if (!pool.length) throw new Error('Trait pool exhausted for selected tier');
        chosen.push(pool[integer(p, 0, pool.length - 1)]);
    }
    return chosen.map(x => x.id);
}
export function generateProgression(species: SpeciesId, seed: number): Progression {
    if (!Object.prototype.hasOwnProperty.call(SPECIES, species)) throw new Error('未知普通角色类型');
    const p: Progression = { version: 3, category: 'normal', species, level: 1, seed: seed >>> 0 || 1, rng: seed >>> 0 || 1,
        tier: 'common', specialty: 'constitution', traits: [], potential: attributes(1) as Progression['potential'], attributes: attributes(5), freePoints: 0 };
    p.traits = rollTraits(p);
    p.attributes = withModifiers(p.attributes, SPECIES[species].modifiers);
    for (const traitId of p.traits) p.attributes = withModifiers(p.attributes, TRAITS_BY_ID[traitId].modifiers);
    for (const stat of PRIMARY_STATS) p.attributes[stat.key] = Math.max(1, Math.min(stat.cap, p.attributes[stat.key]));
    const roll = integer(p, 0, 99); let cumulative = 0;
    const tier = GROWTH_TIERS.find(x => { cumulative += x.weight; return roll < cumulative; })!; p.tier = tier.id;
    const count = integer(p, tier.min, tier.max);
    for (let i = PRIMARY_STATS.length; i < count; i++) { const available = PRIMARY_STATS.filter(s => p.potential[s.key] < 3); p.potential[available[integer(p, 0, available.length - 1)].key]++; }
    const best = Math.max(...Object.values(p.potential)); const options = PRIMARY_STATS.filter(s => p.potential[s.key] === best); p.specialty = options[integer(p, 0, options.length - 1)].key;
    return p;
}
export function deriveNakedStats(a: PrimaryAttributes): CombatStats { return { maxHp: 30 + 3 * a.constitution, maxArmor: 0, maxMp: 2 + 2 * a.willpower, attack: 7 + a.strength, spellPower: 7 + a.intelligence, meleeHit: 70 + 2 * a.technique, rangedHit: 70 + 2 * a.technique, evasion: Math.min(35, a.agility), speed: 3 + a.agility, move: 3 }; }
export function canUseEquipment(item: Equipment, a: PrimaryAttributes): boolean { return Object.entries(item.requirements || {}).every(([key, value]) => a[key as PrimaryStat] >= value); }
export function activeEquipment(a: PrimaryAttributes, loadout: EquipmentLoadout, artifacts: string[]): Equipment[] {
    const slots = (['weapon', 'armor'] as const).flatMap(slot => {
        const id = loadout[slot], item = id && EQUIPMENT[id];
        return item && item.slot === slot ? [item] : [];
    });
    const carried = [...new Set(artifacts)].flatMap(id => {
        const item = EQUIPMENT[id];
        return item?.slot === 'artifact' ? [item] : [];
    });
    return [...slots, ...carried].filter(item => canUseEquipment(item, a));
}
export function validEquipment(value: unknown, artifacts: unknown): value is EquipmentLoadout {
    if (!value || typeof value !== 'object' || !Array.isArray(artifacts)) return false;
    const loadout = value as EquipmentLoadout;
    return (['weapon', 'armor'] as const).every(slot => loadout[slot] === null
        || (typeof loadout[slot] === 'string' && Object.prototype.hasOwnProperty.call(EQUIPMENT, loadout[slot]!) && EQUIPMENT[loadout[slot]!].slot === slot))
        && (loadout.backpack === undefined || (typeof loadout.backpack === 'string' && EQUIPMENT[loadout.backpack]?.slot === 'backpack'))
        && artifacts.length <= bagCapacity(loadout)
        && new Set(artifacts).size === artifacts.length
        && artifacts.every(id => typeof id === 'string' && Object.prototype.hasOwnProperty.call(EQUIPMENT, id) && EQUIPMENT[id].slot === 'artifact');
}
export function setCharacterEquipment(u: CharacterStats, equipment: EquipmentLoadout, artifacts: string[]): boolean {
    if (!validEquipment(equipment, artifacts)) return false;
    if ((['weapon', 'armor'] as const).some(slot => {
        const id = equipment[slot];
        return id !== null && !canUseEquipment(EQUIPMENT[id], u.progression.attributes);
    })) return false;
    const resources = { hp: u.hp, armor: u.armor, mp: u.mp };
    u.equipment = { ...equipment, backpack: equipment.backpack || 'travel-bag' };
    u.artifacts = [...artifacts];
    refresh(u);
    u.hp = Math.min(resources.hp, u.maxHp); u.armor = Math.min(resources.armor, u.maxArmor); u.mp = Math.min(resources.mp, u.maxMp);
    return true;
}
export function deriveStats(a: PrimaryAttributes, loadout: EquipmentLoadout = { weapon: null, armor: null }, artifacts: string[] = []): CombatStats {
    const base = deriveNakedStats(a), gear = activeEquipment(a, loadout, artifacts);
    const sum = (key: keyof Equipment) => gear.reduce((value, item) => value + Number(item[key] || 0), 0);
    return { maxHp: base.maxHp + sum('maxHp'), maxArmor: sum('armor'), maxMp: base.maxMp + sum('maxMp'), attack: base.attack + sum('attack'), spellPower: base.spellPower + sum('spellPower'), meleeHit: base.meleeHit + sum('meleeHit'), rangedHit: base.rangedHit + sum('rangedHit'), evasion: Math.min(35, base.evasion + sum('evasion')), speed: base.speed + sum('speed'), move: base.move };
}
function refresh(u: CharacterStats): void { Object.assign(u, deriveStats(u.progression.attributes, u.equipment, u.artifacts)); u.hp = u.maxHp; u.armor = u.maxArmor; u.mp = u.maxMp; }
export function allocationGain(u: CharacterStats, key: PrimaryStat): number { const stat = PRIMARY_STATS.find(s => s.key === key); return stat && u.progression.attributes[key] < stat.cap ? 1 : 0; }
export function allocatePoint(u: CharacterStats, key: PrimaryStat): boolean { if (!PRIMARY_STATS.some(s => s.key === key) || u.progression.freePoints < 1 || !allocationGain(u, key)) return false; u.progression.attributes[key]++; u.progression.freePoints--; refresh(u); return true; }
export function levelUp(u: CharacterStats): PrimaryAttributes | null { const p = u.progression; if (p.level >= MAX_LEVEL) return null; const gains = attributes(0); for (const stat of PRIMARY_STATS) { const gain = p.potential[stat.key] + integer(p, 0, 1); gains[stat.key] = Math.min(gain, stat.cap - p.attributes[stat.key]); p.attributes[stat.key] += gains[stat.key]; } p.level++; p.freePoints++; refresh(u); return gains; }
export function createCharacter(species: SpeciesId, seed: number, level?: number, equipment: EquipmentLoadout = { weapon: null, armor: null }, artifacts: string[] = []): CharacterStats {
    const p = generateProgression(species, seed), definition = SPECIES[species], target = level ?? integer(p, definition.minLevel, definition.maxLevel);
    if (!Number.isInteger(target) || target < 1 || target > MAX_LEVEL) throw new Error('等级范围为1–20');
    if (!validEquipment(equipment, [...new Set(artifacts)])) throw new Error('Invalid equipment');
    const base = deriveStats(p.attributes, equipment, artifacts), u: CharacterStats = { ...base, hp: base.maxHp, armor: base.maxArmor, mp: base.maxMp, progression: p, equipment: { ...equipment, backpack: equipment.backpack || 'travel-bag' }, artifacts: [...new Set(artifacts)] };
    while (p.level < target) levelUp(u);
    while (p.freePoints > 0) { const choices = PRIMARY_STATS.filter(s => allocationGain(u, s.key) > 0); if (!choices.length) break; allocatePoint(u, choices[integer(p, 0, choices.length - 1)].key); }
    return u;
}
export function combatBudget(stats: CombatStats): number { return 4 * stats.maxHp + 2 * stats.maxArmor + 6 * stats.maxMp + 12 * stats.attack + 12 * stats.spellPower + 3 * Math.min(120, stats.meleeHit) + 3 * Math.min(120, stats.rangedHit) + 10 * stats.evasion + 2 * stats.speed + 24 * (stats.move - 3); }
export function estimateCombatPower(stats: CombatStats): number { return Math.max(1, Math.floor((combatBudget(stats) * 10 + 6) / 12)); }
export function estimatedPower(u: CombatStats | CharacterStats): number { return estimateCombatPower(u); }
export function nakedPower(u: CharacterStats): number { return estimateCombatPower(deriveNakedStats(u.progression.attributes)); }
export function equipmentValue(u: CharacterStats): number { return Math.max(0, estimateCombatPower(u) - nakedPower(u)); }
export function itemBudget(item: Equipment): number {
    return 4 * (item.maxHp || 0) + 2 * (item.armor || 0) + 6 * (item.maxMp || 0)
        + 12 * (item.attack || 0) + 12 * (item.spellPower || 0)
        + 3 * (item.meleeHit || 0) + 3 * (item.rangedHit || 0)
        + 10 * (item.evasion || 0) + 2 * (item.speed || 0);
}
export function itemValue(item: Equipment): number { return Math.max(0, Math.floor((itemBudget(item) + 6) / 12)); }
export function validProgression(value: unknown): value is Progression {
    if (!value || typeof value !== 'object') return false; const p = value as Progression;
    if (p.version !== 3 || p.category !== 'normal' || !Object.prototype.hasOwnProperty.call(SPECIES, p.species) || !Number.isInteger(p.level) || p.level < 1 || p.level > MAX_LEVEL || !Number.isInteger(p.seed) || p.seed <= 0 || p.seed > 0xffffffff || !Number.isInteger(p.rng) || p.rng <= 0 || p.rng > 0xffffffff || !Number.isInteger(p.freePoints) || p.freePoints < 0 || p.freePoints > p.level - 1 || !Array.isArray(p.traits) || p.traits.length < 2 || p.traits.length > 4 || new Set(p.traits).size !== p.traits.length || p.traits.some(id => !TRAITS_BY_ID[id]) || !p.potential || !p.attributes || !PRIMARY_STATS.some(s => s.key === p.specialty)) return false;
    if (p.traits.some(id => typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(TRAITS_BY_ID, id))) return false;
    if (p.essenceGains && (typeof p.essenceGains !== 'object' || Object.entries(p.essenceGains).some(([key,n])=>!PRIMARY_STATS.some(s=>s.key===key)||!Number.isInteger(n)||n! < 0||n! > 10))) return false;
    const chosen = p.traits.map(id => TRAITS_BY_ID[id]); if (chosen.some((x, i) => chosen.some((y, j) => i !== j && !traitCompatible(x, [y])))) return false;
    for (const s of PRIMARY_STATS) if (![1, 2, 3].includes(p.potential[s.key]) || !Number.isInteger(p.attributes[s.key]) || p.attributes[s.key] < 1 || p.attributes[s.key] > s.cap) return false;
    const tier = GROWTH_TIERS.find(t => t.id === p.tier), count = totalStars(p); return !!tier && count >= tier.min && count <= tier.max && p.potential[p.specialty] === Math.max(...Object.values(p.potential));
}
