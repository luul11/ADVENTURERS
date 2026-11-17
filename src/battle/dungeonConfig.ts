import { encounters as humanRows } from './data/human-encounters.json';
import { encounters as encounterRows } from './data/encounters.json';
import { dungeons as dungeonRows } from './data/dungeons.json';
import { events as eventRows } from './data/events.json';
import { HumanAppearance, isHumanAppearance } from './raiderArt';
import { MonsterArchetype, validMonsterArchetype } from './monsterRoster';
import { EQUIPMENT, SPECIES, SpeciesId } from './progression';

export type DungeonId = 'suburban-road' | 'goblin-den' | 'bandit-camp';
export type NodeKind = 'battle' | 'rest' | 'elite' | 'shop' | 'boss' | 'extract' | 'event' | 'human';
export type CombatKind = 'battle' | 'elite' | 'boss';
export type EnemyRole = 'melee' | 'ranged' | 'caster';
export interface EnemyGroup { appearance?: HumanAppearance; name?: string; archetype?: MonsterArchetype; species: SpeciesId; count: number; level: number; rank: 'normal' | 'elite' | 'boss'; role: EnemyRole }
export interface EncounterDefinition { id: string; name: string; kind: CombatKind; strength: number; weight: number; groups: EnemyGroup[]; reward: { gold: number; items: string[] } }
export interface DungeonDefinition {
    id: DungeonId; humanChance: number; name: string; tag: string; description: string; layers: NodeKind[][];
    phases: { from: number; to: number; strength: Record<CombatKind, number[]> }[];
    encounterPool: string[]; eventPool: string[]; rest: { hp: number; mp: number; armor: number }; restDescription: string;
    extractionGold: number; completionGold: number;
}
export type EventEffect =
    | { type: 'gold'; amount: number } | { type: 'items'; ids: string[] }
    | { type: 'recover'; hp: number; mp: number; armor: number }
    | { type: 'hurt'; hp: number } | { type: 'revive'; hp: number; mp: number }
    | { type: 'scout'; enemyHp: number } | { type: 'recruit'; species: SpeciesId; level: number; role: EnemyRole };
export interface EventChoice {
    id: string; label: string; description: string; effects: EventEffect[]; cost?: { gold?: number; items?: string[] };
    requires?: 'fallen' | 'injured' | 'damagedArmor' | 'space'; nextStage?: string;
    outcomes?: { weight: number; text: string; effects: EventEffect[]; encounter?: string }[];
}
export interface EventDefinition { id: string; title: string; description: string; start: string; stages: Record<string, { description?: string; choices: EventChoice[] }> }
export interface HumanEncounterDefinition { id: string; name: string; count: number; weight: number }
export const HUMAN_ENCOUNTERS=humanRows as HumanEncounterDefinition[];
export const getHumanEncounter=(id:string):HumanEncounterDefinition=>{const c=HUMAN_ENCOUNTERS.find(c=>c.id===id);if(!c)throw new Error('人类遭遇配置不存在');return c;};
export const ENCOUNTERS = encounterRows as EncounterDefinition[];
export const DUNGEONS = dungeonRows as DungeonDefinition[];
export const EVENTS = eventRows as unknown as EventDefinition[];
export const getDungeon = (id: DungeonId): DungeonDefinition => { const d = DUNGEONS.find(d => d.id === id); if (!d) throw new Error('副本配置不存在'); return d; };
export const getEncounter = (id: string): EncounterDefinition => { const c = ENCOUNTERS.find(c => c.id === id); if (!c) throw new Error('遭遇配置不存在：' + id); return c; };
export const getEvent = (id: string): EventDefinition => { const e = EVENTS.find(e => e.id === id); if (!e) throw new Error('事件配置不存在：' + id); return e; };
export function seededHash(seed: number): number { let x = seed | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; }
export function weightedPick<T>(items: readonly T[], weight: (item: T) => number, seed: number): T {
    if (!items.length) throw new Error('配置池为空');
    let roll = seededHash(seed) / 4294967296 * items.reduce((n, item) => n + weight(item), 0);
    for (const item of items) { roll -= weight(item); if (roll < 0) return item; }
    return items[items.length - 1];
}
export function encounterForNode(dungeon: DungeonDefinition, kind: CombatKind, depth: number, seed: number, exclude: readonly string[] = []): EncounterDefinition {
    const phase = dungeon.phases.find(p => depth >= p.from && depth <= p.to);
    if (!phase) throw new Error('该层未配置强度阶段');
    const pool = dungeon.encounterPool.map(getEncounter).filter(c => c.kind === kind && phase.strength[kind].includes(c.strength));
    const unused=pool.filter(c=>!exclude.includes(c.id));
    return weightedPick(unused.length?unused:pool, c => c.weight, seed);
}
function validateEffects(effects: EventEffect[]) {
    if (!Array.isArray(effects)) throw new Error('事件效果必须是数组');
    const fraction = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
    for (const e of effects) {
        if (e.type === 'items') { if (!e.ids.length || e.ids.some(id => !Object.prototype.hasOwnProperty.call(EQUIPMENT, id))) throw new Error('事件物品无效'); }
        else if (e.type === 'gold') { if (!Number.isInteger(e.amount) || e.amount < 0) throw new Error('金币效果无效'); }
        else if (e.type === 'recover' || e.type === 'revive') { if (!fraction(e.hp) || !fraction(e.mp) || (e.type === 'recover' && !fraction(e.armor))) throw new Error('恢复比例无效'); }
        else if (e.type === 'hurt') { if (!fraction(e.hp)) throw new Error('损伤比例无效'); }
        else if (e.type === 'scout') { if (!fraction(e.enemyHp) || e.enemyHp === 0) throw new Error('侦察效果无效'); }
        else if (e.type === 'recruit') { if (!Object.prototype.hasOwnProperty.call(SPECIES, e.species) || !Number.isInteger(e.level) || e.level < 1 || e.level > 20 || !['melee', 'ranged', 'caster'].includes(e.role)) throw new Error('招募配置无效'); }
        else throw new Error('未知事件效果');
    }
}
export function validateDungeonData(): void {
    for (const rows of [ENCOUNTERS, DUNGEONS, EVENTS,HUMAN_ENCOUNTERS]) if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('配置ID重复');
    for(const h of HUMAN_ENCOUNTERS)if(!Number.isInteger(h.count)||h.count<1||h.count>5||!Number.isInteger(h.weight)||h.weight<1)throw new Error('人类遭遇须配置1至5人');
    for (const e of ENCOUNTERS) {
        if (!['battle', 'elite', 'boss'].includes(e.kind) || !Number.isInteger(e.strength) || e.strength < 1 || !Number.isInteger(e.weight) || e.weight < 1) throw new Error('遭遇强度或权重无效');
        const count = e.groups.reduce((n, g) => n + g.count, 0);
        if (count < 1 || count > 10) throw new Error('遭遇人数须在1至10人');
        for (const g of e.groups) if (!Object.prototype.hasOwnProperty.call(SPECIES, g.species) || !Number.isInteger(g.count) || g.count < 1 || !Number.isInteger(g.level) || g.level < 1 || g.level > 20 || !['normal', 'elite', 'boss'].includes(g.rank) || !['melee', 'ranged', 'caster'].includes(g.role)) throw new Error('怪物组配置无效');
        for (const g of e.groups) {
            if(g.appearance!==undefined&&(g.species!=='human'||!isHumanAppearance(g.appearance)))throw new Error('人类外观与种族不匹配');
            if(g.name!==undefined&&(typeof g.name!=='string'||!g.name.trim()||g.name.length>20))throw new Error('敌人名称无效');
            if(g.rank==='boss'&&g.species==='human'&&!g.appearance)throw new Error('人类首领必须配置外观');
        }
        for (const g of e.groups) if(g.archetype!==undefined&&!validMonsterArchetype(g.archetype,g.species,g.rank))throw new Error('怪物身份、种族或首领级别不匹配');
        if (e.kind === 'battle' && e.groups.some(g => g.rank !== 'normal')) throw new Error('普通遭遇只能配置普通敌人');
        if (e.kind === 'elite' && (!e.groups.some(g => g.rank === 'elite') || !e.groups.some(g => g.rank === 'normal') || e.groups.some(g => g.rank === 'boss'))) throw new Error('精英遭遇须混编精英与普通敌人');
        if (e.kind === 'boss' && e.groups.reduce((n,g)=>n+(g.rank==='boss'?g.count:0),0) !== 1) throw new Error('Boss遭遇须包含一名首领');
        if (e.kind === 'boss' && !e.groups.some(g=>g.rank==='normal')) throw new Error('Boss遭遇须包含普通随从');
        if (e.groups.some(g=>g.rank==='boss'&&!['goblin','orc','human'].includes(g.species))) throw new Error('当前Boss素材仅支持哥布林、兽人与人类');
        if (!Number.isInteger(e.reward.gold) || e.reward.gold < 0 || e.reward.items.some(id => !Object.prototype.hasOwnProperty.call(EQUIPMENT, id))) throw new Error('遭遇奖励无效');
    }
    for (const e of EVENTS) {
        if (!Object.prototype.hasOwnProperty.call(e.stages, e.start)) throw new Error('事件入口缺失');
        const visited = new Set<string>(), active = new Set<string>();
        const visit = (id: string) => {
            if (active.has(id)) throw new Error('事件阶段不允许循环'); if (visited.has(id)) return;
            const stage = e.stages[id]; if (!stage || !stage.choices.length || new Set(stage.choices.map(c => c.id)).size !== stage.choices.length) throw new Error('事件选项无效');
            active.add(id);
            for (const c of stage.choices) {
                validateEffects(c.effects);
                if (c.cost?.gold !== undefined && (!Number.isInteger(c.cost.gold) || c.cost.gold < 0)) throw new Error('事件价格无效');
                if (c.cost?.items?.some(id => !Object.prototype.hasOwnProperty.call(EQUIPMENT, id))) throw new Error('事件代价物品无效');
                if (c.requires && !['fallen','injured','damagedArmor','space'].includes(c.requires)) throw new Error('事件条件无效');
                if (c.nextStage) { if (c.outcomes?.length) throw new Error('阶段跳转和概率结果不可混用'); visit(c.nextStage); }
                if (c.outcomes && !c.outcomes.length) throw new Error('概率结果不能为空');
                if (c.outcomes) for (const o of c.outcomes) { if (!Number.isInteger(o.weight) || o.weight < 1) throw new Error('事件概率无效'); validateEffects(o.effects); if (o.encounter) getEncounter(o.encounter); }
            }
            active.delete(id); visited.add(id);
        }; visit(e.start);
    }
    for (const d of DUNGEONS) {
        if (!['suburban-road','goblin-den','bandit-camp'].includes(d.id) || new Set(d.encounterPool).size!==d.encounterPool.length || new Set(d.eventPool).size!==d.eventPool.length) throw new Error('副本ID或配置池重复');
        if(!Number.isFinite(d.humanChance)||d.humanChance<0||d.humanChance>.2)throw new Error('人类遭遇概率无效');
        if (!d.layers.length || d.layers.some(l => !l.length || l.length > 3 || l.some(k=>!['battle','rest','elite','shop','boss','extract','event','human'].includes(k)))) throw new Error('副本路线层配置无效');
        if (d.layers[d.layers.length-1].length !== 1 || d.layers[d.layers.length-1][0] !== 'boss') throw new Error('末层必须为Boss');
        d.encounterPool.forEach(getEncounter); d.eventPool.forEach(getEvent);
        if (!d.eventPool.length || [d.rest.hp,d.rest.mp,d.rest.armor].some(n=>!Number.isFinite(n)||n<0||n>1) || !Number.isInteger(d.extractionGold) || !Number.isInteger(d.completionGold)) throw new Error('副本补给配置无效');
        d.layers.forEach((layer, depth) => layer.forEach(kind => { if (['battle','elite','boss'].includes(kind)) encounterForNode(d, kind as CombatKind, depth, 1); }));
    }
}
validateDungeonData();
