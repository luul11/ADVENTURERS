import { validMonsterArchetype } from './monsterRoster';
import { isHumanAppearance } from './raiderArt';
import { DungeonId } from './dungeonConfig';
import { Unit, clone, learnedSkills }  from './engine';
import { Expedition, createExpedition } from './expedition';
import { EQUIPMENT, PRIMARY_STATS, PrimaryStat, deriveStats, validProgression, validEquipment } from './progression';
import { assertStockCapacity, storageCapacity, STORAGE_LEVELS, transferStock } from './storage';
import { DEFAULT_HERO_IDS, HERO_IDS, HERO_PRESETS, createHero } from './roster';

export function createBase(seed = Date.now() >>> 0): Expedition {
    const state = createExpedition(DEFAULT_HERO_IDS, seed);
    for (const heroId of HERO_IDS.filter(id => !state.party.some(u => u.heroId === id))) {
        const preset = HERO_PRESETS[heroId], i = state.party.length;
        state.party.push({ ...createHero(heroId), id: 'ally-' + (i + 1), heroId, name: preset.name, team: 'ally',
            order: i + 1, portrait: i % 4, x: 0, y: 0, reaction: true, rank: 'normal',
            policy: heroId === 'yunlan' ? 'support' : heroId === 'xiao-xu' ? 'defender' : 'damage', skills: [...preset.skills] });
    }
    delete state.stockLimit; return state;
}
export function packedSupplies(base: Expedition): string[] {
    const available = [...base.stock], result: string[] = [];
    for (const id of base.packedStock || base.stock) {
        const i = available.indexOf(id); if (i < 0) continue;
        try { assertStockCapacity([...result, id], storageCapacity(base.storageLevel)); } catch { continue; }
        available.splice(i, 1); result.push(id);
    }
    return result;
}
export function prepareExpedition(base: Expedition, members: readonly string[], seed = Date.now() >>> 0, dungeonId: DungeonId = base.dungeonId): Expedition {
    if (members.length !== 5 || new Set(members).size !== 5) throw new Error('请选择五名不同的队员');
    const run = createExpedition(DEFAULT_HERO_IDS, seed, dungeonId);
    run.party = members.map((id, i): Unit => {
        const saved = base.party.find(u => u.heroId === id || u.id === id); if (!saved || saved.hp <= 0) throw new Error('队员不存在或已倒下，请先复活');
        return { ...clone(saved), baseId: saved.id, id: 'ally-' + (i + 1), order: i + 1 };
    });
    run.storageLevel = base.storageLevel || 0; run.stockLimit = storageCapacity(run.storageLevel);
    run.stock = packedSupplies(base); run.gold = Math.max(0, Math.min(base.gold, Number.isInteger(base.packedGold) ? base.packedGold! : 80));
    return run;
}
/** 出发即扣除携带物资，刷新或战败不能复制带入物品。 */
export function reserveExpedition(base: Expedition, run: Expedition): Expedition {
    const b = clone(base), pool = [...b.stock];
    for (const id of run.stock) { const i = pool.indexOf(id); if (i < 0) throw new Error('出发物资不足'); pool.splice(i, 1); }
    if (run.gold > b.gold) throw new Error('金币不足');
    b.stock = pool; b.gold -= run.gold; delete b.packedStock; delete b.packedGold; return b;
}
export function returnExpedition(base: Expedition, run: Expedition): Expedition {
    if (!['won', 'lost'].includes(run.stage)) throw new Error('远征尚未结束');
    if (base.settledSeeds?.includes(run.seed)) return clone(base);
    const b = clone(base); b.settledSeeds = [...(b.settledSeeds || []), run.seed].slice(-32);
    for (const unit of run.party) {
        const saved = clone(unit), old = b.party.findIndex(u => unit.heroId ? u.heroId === unit.heroId : u.id === unit.baseId);
        saved.id = old >= 0 ? b.party[old].id : 'base-' + run.seed + '-' + unit.id; delete saved.baseId;
        if (old >= 0) b.party[old] = saved; else if (run.stage === 'won') b.party.push(saved);
    }
    if (run.stage === 'won') { b.stock.push(...run.stock); b.gold += run.gold; }
    b.message = run.stage === 'won' ? '安全归来，携带物资与金币已存入基地。' : '远征失败，携带物资和金币遗失。';
    return b;
}
export function upgradeStorage(base: Expedition): Expedition {
    if (base.stockLimit !== undefined) throw new Error('只能在基地扩容');
    const level = base.storageLevel || 0, plan = STORAGE_LEVELS[level];
    if (level >= STORAGE_LEVELS.length - 1) throw new Error('物资库已达最高等级');
    if (base.gold < plan.cost) throw new Error('金币不足，需要' + plan.cost + '金币');
    const b = clone(base); b.gold -= plan.cost; b.storageLevel = level + 1; return b;
}
export const ESSENCE_STATS = { vital: ['constitution', 'agility'], martial: ['strength', 'technique'], arcane: ['intelligence', 'willpower'] } as const;
export function trainingOffer(unit: Unit, stat: PrimaryStat): { id: string; count: number; gold: number; error?: string } {
    const value = unit.progression.attributes[stat], type = Object.entries(ESSENCE_STATS).find(([, keys]) => (keys as readonly string[]).includes(stat))?.[0];
    const tier = value < 20 ? 0 : value < 50 ? 1 : 2;
    return { id: (tier === 0 ? '' : tier === 1 ? 'refined-' : 'pure-') + type + '-essence', count: tier + 1, gold: [5, 15, 40][tier],
        error: value >= 80 ? '裸属性已达培养上限80' : (unit.progression.essenceGains?.[stat] || 0) >= 10 ? '该属性精华培养已达10次' : undefined };
}
export function trainMember(base: Expedition, unitId: string, stat: PrimaryStat): Expedition {
    if (base.stockLimit !== undefined) throw new Error('只能在基地使用精华培养');
    const unit = base.party.find(u => u.id === unitId); if (!unit || !PRIMARY_STATS.some(s => s.key === stat)) throw new Error('队员或属性无效');
    const offer = trainingOffer(unit, stat); if (offer.error) throw new Error(offer.error);
    if (base.gold < offer.gold) throw new Error('金币不足');
    const moved = transferStock(base.stock, [], offer.id, offer.count), b = clone(base), u = b.party.find(t => t.id === unitId)!;
    b.stock = moved.source; b.gold -= offer.gold;
    const before = { hp: u.hp, mp: u.mp, maxHp: u.maxHp, maxMp: u.maxMp, armor: u.armor };
    u.progression.attributes[stat]++; (u.progression.essenceGains ||= {})[stat] = (u.progression.essenceGains?.[stat] || 0) + 1;
    Object.assign(u, deriveStats(u.progression.attributes, u.equipment, u.artifacts));
    u.hp = before.hp === 0 ? 0 : Math.min(u.maxHp, before.hp + u.maxHp - before.maxHp); u.mp = Math.min(u.maxMp, before.mp + u.maxMp - before.maxMp); u.armor = before.armor;
    b.message = u.name + '的' + PRIMARY_STATS.find(s => s.key === stat)!.name + '+1'; return b;
}
export const BASE_SAVE_KEY = 'adventurers-base-v2';
export function saveBase(base: Expedition): boolean {
    try { localStorage.setItem(BASE_SAVE_KEY, JSON.stringify({ schema: 2, base })); return true; } catch { return false; }
}
export function loadBase(): Expedition {
    try {
        localStorage.removeItem('adventurers-base-v1');
        const saved = JSON.parse(localStorage.getItem(BASE_SAVE_KEY) || 'null'), b = saved?.base as Expedition;
        if (saved?.schema !== 2 || !b || !Array.isArray(b.party) || b.party.length < 5 || b.party.length > 100 || !Number.isInteger(b.gold) || b.gold < 0 || !Array.isArray(b.stock) || b.stock.some(id => !EQUIPMENT[id]) || !Number.isInteger(b.storageLevel || 0) || (b.storageLevel || 0) < 0 || (b.storageLevel || 0) > 3) throw new Error('Invalid base');
        if (!HERO_IDS.every(id => b.party.some(u => u.heroId === id)) || new Set(b.party.map(u => u.id)).size !== b.party.length) throw new Error('Invalid roster');
        for (const u of b.party) {
            if (u.archetype!==undefined&&(!validMonsterArchetype(u.archetype,u.progression.species,u.rank)||u.heroId)) throw new Error('Invalid monster identity');
            if (u.appearance!==undefined&&(!isHumanAppearance(u.appearance)||u.progression.species!=='human'||u.heroId)) throw new Error('Invalid appearance');
            if (!validProgression(u.progression) || !validEquipment(u.equipment, u.artifacts) || !Array.isArray(u.skills) || u.skills.some(id => !learnedSkills(u).includes(id))) throw new Error('Invalid member');
            const stats = deriveStats(u.progression.attributes, u.equipment, u.artifacts);
            if (![u.hp, u.mp, u.armor].every(Number.isInteger) || u.hp < 0 || u.hp > stats.maxHp || u.mp < 0 || u.mp > stats.maxMp || u.armor < 0 || u.armor > stats.maxArmor) throw new Error('Invalid resources');
            Object.assign(u, stats);
        }
        delete b.stockLimit; b.stage = 'route'; return b;
    } catch { return createBase(); }
}
