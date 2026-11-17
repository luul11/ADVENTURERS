import { MonsterArchetype, validMonsterArchetype } from './monsterRoster';
import { HumanAppearance, isHumanAppearance } from './raiderArt';
import { CharacterStats, createCharacter, deriveStats, validProgression } from './progression';
import { EquipmentLoadout, EQUIPMENT, restorationError, applyRestoration, RESOURCE_LABELS, canUseEquipment, setCharacterEquipment, validEquipment } from './progression';
import { assertStockCapacity } from './storage';
import { DEFAULT_HERO_IDS, HERO_PRESETS, HeroId, createHero, isHeroId } from './roster';
export type Policy = 'assassin' | 'damage' | 'defender' | 'support';
export const POLICIES: Record<Policy, string> = { assassin: '刺杀者', damage: '伤害者', defender: '捍卫者', support: '辅助者' };
export type Team = 'ally' | 'enemy';
export type Mode = 'manual' | 'auto';
export interface Point { x: number; y: number }
export interface Skill {
    id: string; name: string; icon: string; description: string;
    min: number; max: number; mp: number;
    hit: 'melee' | 'ranged' | 'none'; bonus: number;
    attack: number; spell: number; flat: number;
    effect: 'damage' | 'heal'; piercing?: boolean; cross?: boolean; area?: { shape: 'cross' | 'diamond'; radius: number };
}
export interface Unit extends Point, CharacterStats {
    id: string; baseId?: string; name: string; team: Team; order: number; portrait: number;
    hp: number; maxHp: number; armor: number; maxArmor: number;
    mp: number; maxMp: number; attack: number; spellPower: number;
    meleeHit: number; rangedHit: number; evasion: number; move: number; speed: number;
    skills: string[]; learnedSkills?: string[]; appearance?: HumanAppearance; archetype?: MonsterArchetype; reaction: boolean; heroId?: HeroId; policy?: Policy; rank?: 'normal' | 'elite' | 'boss'; cargo?: string[]; carriedGold?: number;
}
export interface Battle {
    version: 1; phase: 'ready' | 'battle' | 'over'; round: number;
    units: Unit[]; queue: string[]; activeId: string;
    moved: boolean; acted: boolean; disengaged: boolean;
    seed: number; rng: number; draws: number; revision: number;
    result: 'victory' | 'defeat' | 'retreat' | null;
    logs: string[]; captured?: Unit[]; stock: string[]; stockLimit?: number;
}
export type Command =
    | { type: 'move'; to: Point }
    | { type: 'skill'; skillId: string; targetId?: string; to?: Point }
    | { type: 'item'; itemId: string; targetId: string }
    | { type: 'disengage' | 'end' | 'retreat' };
export interface BattleEvent {
    type: 'move' | 'hit' | 'miss' | 'heal' | 'buff' | 'reaction' | 'turn' | 'result' | 'area' | 'revive';
    unitId: string; targetId?: string; from?: Point; to?: Point;
    hp?: number; armor?: number; text: string; skillId?: string; projectileTargetId?: string; resource?: 'hp' | 'mp' | 'armor'; amount?: number;
}
export interface Resolution { state: Battle; events: BattleEvent[]; error?: string }
export const COLS = 5;
export const ROWS = 6;
export const BLOCKS: Point[] = [{ x: 2, y: 2 }, { x: 2, y: 3 }];
export const SKILLS: Skill[] = [
    { id: 'melee', name: '近战攻击', icon: 'sword', description: '近身攻击，攻击 + 2。', min: 1, max: 1, mp: 0, hit: 'melee', bonus: 0, attack: 1, spell: 0, flat: 2, effect: 'damage' },
    { id: 'ranged', name: '远程攻击', icon: 'bow', description: '攻击 + 2。2格命中额外+10，3格无额外加成；不能攻击贴身目标。', min: 2, max: 3, mp: 0, hit: 'ranged', bonus: 0, attack: 1, spell: 0, flat: 2, effect: 'damage' },
    { id: 'heavy-strike', name: '重击', icon: 'sword', description: '1.6攻击 + 3。', min: 1, max: 1, mp: 3, hit: 'melee', bonus: 0, attack: 1.6, spell: 0, flat: 3, effect: 'damage' },
    { id: 'aimed-shot', name: '瞄准射击', icon: 'bow', description: '1.3攻击 + 3，命中修正+10；2格再额外+10。', min: 2, max: 3, mp: 4, hit: 'ranged', bonus: 10, attack: 1.3, spell: 0, flat: 3, effect: 'damage' },
    { id: 'arcane-bolt', name: '奥术弹', icon: 'spark', description: '1.4法强 + 3，普通伤害。', min: 1, max: 3, mp: 3, hit: 'ranged', bonus: 0, attack: 0, spell: 1.4, flat: 3, effect: 'damage' },
    { id: 'flame-cross', name: '十字焰', icon: 'flame', description: '1.1法强 + 3。中心与四邻敌人分别判命中，不伤友军。', min: 1, max: 3, mp: 5, hit: 'ranged', bonus: -10, attack: 0, spell: 1.1, flat: 3, effect: 'damage', cross: true, area: { shape: 'cross', radius: 1 } },
    { id: 'piercing-thrust', name: '穿透突刺', icon: 'sword', description: '攻击 + 2，完全绕过护甲。', min: 1, max: 1, mp: 4, hit: 'melee', bonus: 0, attack: 1, spell: 0, flat: 2, effect: 'damage', piercing: true },
    { id: 'piercing-ray', name: '穿透射线', icon: 'spark', description: '0.9法强 + 2，命中修正−10，完全绕甲。', min: 2, max: 3, mp: 5, hit: 'ranged', bonus: -10, attack: 0, spell: .9, flat: 2, effect: 'damage', piercing: true },
    { id: 'healing', name: '治疗', icon: 'heart', description: '0.4法强 + 2，向下取整。恢复生命，包含自己。', min: 0, max: 3, mp: 5, hit: 'none', bonus: 0, attack: 0, spell: .4, flat: 2, effect: 'heal' },
];
export const EQUIPPABLE = SKILLS.slice(2);
/** 可学习任何技能，不等于已经掌握全部技能。旧角色以当前技能初始化掌握列表。 */
export function learnedSkills(unit: Unit): string[] { return [...new Set(unit.learnedSkills || unit.skills)].filter(id => EQUIPPABLE.some(s => s.id === id)); }
export function learnSkill(unit: Unit, skillId: string): boolean {
    if (!EQUIPPABLE.some(s => s.id === skillId) || learnedSkills(unit).includes(skillId)) return false;
    unit.learnedSkills = [...learnedSkills(unit), skillId]; return true;
}
export function configureSkills(state: Battle, unitId: string, skills: string[]): Battle {
    const u = state.units.find(t => t.id === unitId);
    if (state.phase !== 'ready' || !u || u.team !== 'ally' || skills.length > 3 || new Set(skills).size !== skills.length || skills.some(id => !learnedSkills(u).includes(id))) return state;
    const b = clone(state), target = b.units.find(t => t.id === unitId)!; target.learnedSkills = learnedSkills(u); target.skills = [...skills]; b.revision++; return b;
}
export const skillById = (id: string) => SKILLS.find(s => s.id === id);
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const inside = (p: Point) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < COLS && p.y >= 0 && p.y < ROWS;
export const blocked = (p: Point) => BLOCKS.some(b => same(b, p));
export const activeUnit = (b: Battle) => b.units.find(u => u.id === b.activeId);
export const unitAt = (b: Battle, p: Point) => b.units.find(u => u.hp > 0 && same(u, p));
const ordered = (units: Unit[]) => [...units].sort((a, b) => b.speed - a.speed || a.order - b.order);
const neighbours = (p: Point): Point[] => [{ x: p.x, y: p.y - 1 }, { x: p.x + 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x - 1, y: p.y }];
const key = (p: Point) => `${p.x},${p.y}`;
const log = (b: Battle, text: string) => { b.logs = [...b.logs.slice(-99), `第${b.round}轮 · ${text}`]; };
const unitLabel = (u: Unit) => `【${u.name}】Lv.${u.progression.level}`;
const remainingResources = (u: Unit) => `剩余 HP ${u.hp}/${u.maxHp}，护甲 ${u.armor}/${u.maxArmor}`;
export const MAX_TEAM = 10;
export function deployUnits(units: Unit[]): void {
    for (const team of ['ally', 'enemy'] as Team[]) {
        const living = units.filter(u => u.team === team && u.hp > 0).sort((a, b) => b.hp - a.hp || a.order - b.order);
        if (living.length > MAX_TEAM) throw new Error('每方最多上场10人');
        living.forEach((u, i) => { u.x = [2, 1, 3, 0, 4][i % 5]; u.y = team === 'ally' ? 4 + Math.floor(i / 5) : 1 - Math.floor(i / 5); });
    }
}
export function createEnemies(seed: number, count: number, level = 3, rank: Unit['rank'] = 'normal'): Unit[] {
    if (!Number.isInteger(count) || count < 1 || count > MAX_TEAM) throw new Error('敌方人数必须为1至10');
    const species = ['slime', 'gremlin', 'goblin'] as const;
    return Array.from({ length: count }, (_, i) => {
        const kind = rank === 'boss' && i === 0 ? 'goblin' : species[i % species.length];
        const stats = createCharacter(kind, (seed + Math.imul(i + 1, 2654435761)) >>> 0, level,
            { weapon: i % 3 === 1 ? 'apprentice-staff' : 'iron-sword', armor: 'novice-armor' });
        if (!canUseEquipment(EQUIPMENT[stats.equipment.weapon!], stats.progression.attributes)) setCharacterEquipment(stats, { ...stats.equipment, weapon: 'iron-sword' }, []);
        return { ...stats, id: 'enemy-' + (i + 1), name: rank === 'boss' && i === 0 ? '哥布林首领' : (rank === 'elite' || rank === 'boss' ? '精英' : '') + ({ slime: '史莱姆', gremlin: '地精', goblin: '哥布林' }[kind]),
            team: 'enemy', order: i * 2 + 2, portrait: i % 4, x: 0, y: 0, reaction: true,
            rank: rank === 'boss' && i > 0 ? 'elite' : rank, policy: i % 3 === 1 ? 'damage' : 'assassin',
            skills: i % 3 === 1 ? ['arcane-bolt', 'flame-cross', 'healing'] : ['heavy-strike', 'piercing-thrust', 'aimed-shot'] };
    });
}
export function createEncounter(seed: number, party: readonly Unit[], enemies: readonly Unit[], stock: readonly string[] = []): Battle {
    const units = [...clone(party), ...clone(enemies)],teamStock=[...stock];
    for(const u of units.filter(u=>u.team==='ally')){const personal=u.artifacts.filter(id=>EQUIPMENT[id]?.slot==='artifact');teamStock.push(...u.artifacts.filter(id=>EQUIPMENT[id]?.slot!=='artifact'),...(u.cargo||[]));u.artifacts=personal;u.cargo=[];}
    if (!units.some(u => u.team === 'ally'&&u.hp>0)) throw new Error('没有可出战队员');
    units.forEach((u, i) => { u.learnedSkills = learnedSkills(u); u.order = i + 1; u.reaction = true; }); deployUnits(units);
    return { version: 1, phase: 'ready', round: 0, units, stock: teamStock, captured: [], queue: [], activeId: '', moved: false, acted: false, disengaged: false,
        seed: seed >>> 0 || 1, rng: seed >>> 0 || 1, draws: 0, revision: 0, result: null, logs: ['部署完成，当前HP较高的队员优先站前排。'] };
}
export function createBattle(seed = 20261016, heroIds: readonly HeroId[] = DEFAULT_HERO_IDS): Battle {
    if (!Array.isArray(heroIds) || heroIds.length !== 5 || new Set(heroIds).size !== 5 || !heroIds.every(isHeroId)) throw new Error('请选择五名不同的队员');
    const party: Unit[] = heroIds.map((heroId, i) => ({ ...createHero(heroId), heroId, id: 'ally-' + (i + 1), name: HERO_PRESETS[heroId].name,
        team: 'ally', order: i + 1, portrait: i % 4, x: 0, y: 0, reaction: true, rank: 'normal',
        policy: heroId === 'song-ge' || heroId === 'mu' || heroId === 'xiao-xu' ? 'defender' : heroId === 'yunlan' ? 'support' : 'damage', skills: [...HERO_PRESETS[heroId].skills] }));
    return createEncounter(seed, party, createEnemies(seed, 5));
}
function nextRound(b: Battle) {
    b.round++; b.units.forEach(u => { u.reaction = u.hp > 0; });
    b.queue = ordered(b.units.filter(u => u.hp > 0)).map(u => u.id);
    log(b, '新一轮开始，所有存活单位恢复反应机会。');
}
function nextTurn(b: Battle) {
    b.queue = b.queue.filter(id => b.units.some(u => u.id === id && u.hp > 0));
    if (!b.queue.length) nextRound(b);
    b.activeId = b.queue.shift()!; b.moved = false; b.acted = false; b.disengaged = false;
}
export function startBattle(state: Battle): Battle {
    if (state.phase !== 'ready') return state;
    const b = clone(state); b.phase = 'battle'; b.logs = []; nextTurn(b); b.revision++; return b;
}
export function nextRandom(b: Battle): number {
    let x = b.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    b.rng = x >>> 0; b.draws++; return b.rng / 4294967296;
}
// Derived from current resources; never mutate base evasion or accumulate across turns.
export function evasionPenalty(unit: Unit): number {
    return (unit.maxHp > 0 && unit.hp * 2 < unit.maxHp ? 10 : 0)
        + (unit.maxMp > 0 && unit.mp * 2 < unit.maxMp ? 10 : 0);
}
export function effectiveEvasion(unit: Unit): number {
    return unit.evasion - evasionPenalty(unit);
}
export const CLOSE_SHOT_HIT_BONUS = 10;
export function shootingHitBonus(source: Point, target: Point, skill: Skill): number {
    if (skill.effect !== 'damage' || skill.hit !== 'ranged' || skill.attack <= 0 || skill.spell !== 0) return 0;
    const d = distance(source, target);
    if (d < skill.min || d > skill.max) return 0;
    return (skill.max - d) * CLOSE_SHOT_HIT_BONUS;
}
export function hitChance(source: Unit, target: Unit, skill: Skill): number {
    return skill.hit === 'none' ? 1 : Math.max(.20, Math.min(.95,
        ((skill.hit === 'melee' ? source.meleeHit : source.rangedHit) - effectiveEvasion(target) + skill.bonus + shootingHitBonus(source, target, skill)) / 100));
}
export const power = (u: Unit, s: Skill) => Math.max(1, Math.floor((u.attack * Math.round(s.attack * 10000) + u.spellPower * Math.round(s.spell * 10000) + s.flat * 10000 + (s.effect === 'heal' ? 0 : 5000)) / 10000));
export function losses(target: Unit, amount: number, piercing = false) {
    const armor = piercing ? 0 : Math.min(target.armor, Math.floor(4 * amount / 5));
    return { armor, hp: Math.min(target.hp, amount - armor) };
}
// Supercover: a ray touching an obstacle corner is also blocked.
export function visible(a: Point, b: Point): boolean {
    if (blocked(b)) return false;
    let x = a.x, y = a.y;
    const dx = b.x - a.x, dy = b.y - a.y, nx = Math.abs(dx), ny = Math.abs(dy), sx = Math.sign(dx), sy = Math.sign(dy);
    let ix = 0, iy = 0;
    while (ix < nx || iy < ny) {
        const decision = (1 + 2 * ix) * ny - (1 + 2 * iy) * nx;
        if (decision === 0) {
            if (blocked({ x: x + sx, y }) || blocked({ x, y: y + sy })) return false;
            x += sx; y += sy; ix++; iy++;
        } else if (decision < 0) { x += sx; ix++; } else { y += sy; iy++; }
        if (blocked({ x, y })) return false;
    }
    return true;
}
export function reactionSources(b: Battle, mover: Unit, from: Point, to: Point, spent = new Set<string>()): Unit[] {
    if (b.disengaged && mover.id === b.activeId) return [];
    return ordered(b.units.filter(u => u.hp > 0 && u.team !== mover.team && u.reaction && !spent.has(u.id)
        && distance(u, from) === 1 && distance(u, to) > 1));
}
export function pathRisk(b: Battle, mover: Unit, path: Point[]): Unit[] {
    const seen = new Set<string>(); const risks: Unit[] = []; let from: Point = mover;
    for (const to of path) {
        for (const u of reactionSources(b, mover, from, to, seen)) { seen.add(u.id); risks.push(u); }
        from = to;
    }
    return risks;
}
export function paths(b: Battle, mover: Unit, limit = mover.move): Map<string, Point[]> {
    const found = new Map<string, Point[]>(); found.set(key(mover), []);
    const frontier: Point[] = [{ x: mover.x, y: mover.y }];
    while (frontier.length) {
        const from = frontier.shift()!; const path = found.get(key(from))!;
        if (path.length >= limit) continue;
        for (const to of neighbours(from)) {
            if (!inside(to) || blocked(to) || (unitAt(b, to) && !same(to, mover))) continue;
            const candidate = [...path, to], existing = found.get(key(to));
            if (!existing || (candidate.length === existing.length && pathRisk(b, mover, candidate).length < pathRisk(b, mover, existing).length)) {
                found.set(key(to), candidate); frontier.push(to);
            }
        }
    }
    return found;
}
export function validTarget(_b: Battle, source: Unit, target: Unit, skill: Skill): boolean {
    if (source.hp <= 0 || target.hp <= 0 || source.mp < skill.mp) return false;
    if ((skill.effect === 'damage') === (source.team === target.team)) return false;
    const d = distance(source, target);
    return d >= skill.min && d <= skill.max && visible(source, target)
        && (skill.effect !== 'heal' || target.hp < target.maxHp);
}
export const targets = (b: Battle, source: Unit, skill: Skill) => b.units.filter(t => validTarget(b, source, t, skill));
export function areaCells(center: Point, skill: Skill): Point[] {
    const area = skill.area || (skill.cross ? { shape: 'cross' as const, radius: 1 } : undefined);
    if (!area) return [{ x: center.x, y: center.y }];
    const cells: Point[] = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const p = { x, y };
        if (distance(p, center) <= area.radius && (area.shape !== 'cross' || x === center.x || y === center.y)) cells.push(p);
    }
    return cells;
}
export function areaTarget(source: Unit, p: Point): Unit {
    return { ...source, x: p.x, y: p.y, id: 'cell-' + p.x + '-' + p.y, hp: 1, team: source.team === 'ally' ? 'enemy' : 'ally' };
}
export function skillAims(b: Battle, source: Unit, skill: Skill): Unit[] {
    if (!skill.area && !skill.cross) return targets(b, source, skill);
    const aims: Unit[] = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const target = areaTarget(source, { x, y });
        if (!blocked(target) && validTarget(b, source, target, skill) && affected(b, target, skill).length) aims.push(target);
    }
    return aims;
}
export const affected = (b: Battle, target: Unit, skill: Skill) => b.units.filter(u => u.hp > 0
    && (skill.area || skill.cross ? u.team === target.team && areaCells(target, skill).some(p => same(p, u)) : u.id === target.id)).sort((a, c) => a.order - c.order);
export function captureChance(target: Unit): number {
    return Math.min(.95, Math.max(.1, .1 + .85 * ((target.maxHp - target.hp) / Math.max(1, target.maxHp - 1))));
}
export function itemTargets(b: Battle, _source: Unit, itemId: string): Unit[] {
    if (!b.stock.includes(itemId)) return [];
    return b.units.filter(t => itemId === 'contract' ? t.hp > 0 && t.team === 'enemy' && !t.heroId && (!t.rank || t.rank === 'normal') :
        itemId === 'revival-stone' ? t.team === 'ally' && t.hp === 0 : t.team === 'ally' && !!EQUIPMENT[itemId]?.restore && !restorationError(t, itemId));
}
function revivePosition(b: Battle): Point {
    const cells: Point[] = [];
    for (let y = ROWS - 1; y >= 0; y--) for (const x of [2,1,3,0,4]) { const p={x,y}; if (!blocked(p) && !unitAt(b,p)) cells.push(p); }
    if (!cells.length) throw new Error('没有可供复活的空格'); return cells[0];
}
export function availableSkills(u: Unit): Skill[] {
    return ['melee', 'ranged', ...u.skills].map(skillById).filter((s): s is Skill => !!s);
}
function finishIfNeeded(b: Battle): boolean {
    if (!b.units.some(u => u.team === 'enemy' && u.hp > 0)) b.result = 'victory';
    else if (!b.units.some(u => u.team === 'ally' && u.hp > 0)) b.result = 'defeat';
    if (b.result) { b.phase = 'over'; return true; } return false;
}
function applyHit(b: Battle, source: Unit, target: Unit, skill: Skill, events: BattleEvent[], reaction = false) {
    const prefix = reaction ? '借机攻击' : skill.name;
    if (nextRandom(b) >= hitChance(source, target, skill)) {
        const text = `${unitLabel(source)} ${prefix} → ${unitLabel(target)}：闪避｜${remainingResources(target)}`;
        log(b, text); events.push({ type: 'miss', unitId: source.id, targetId: target.id, skillId: skill.id, text: '闪避' }); return false;
    }
    const l = losses(target, power(source, skill), skill.piercing);
    target.hp -= l.hp; target.armor -= l.armor;
    const text = `${unitLabel(source)} ${prefix} → ${unitLabel(target)}：护甲−${l.armor} / HP−${l.hp}｜${remainingResources(target)}${target.hp === 0 ? ' · 击倒' : ''}`;
    log(b, text); events.push({ type: reaction ? 'reaction' : 'hit', unitId: source.id, targetId: target.id, hp: l.hp, armor: l.armor, skillId: skill.id,
        text: `HP −${l.hp}${l.armor ? `  甲 −${l.armor}` : ''}${reaction ? ' · 截停' : ''}` }); return true;
}
export function resolve(state: Battle, command: Command): Resolution {
    const fail = (error: string): Resolution => ({ state, events: [], error });
    if (state.phase !== 'battle') return fail('当前不能执行战斗指令');
    const original = activeUnit(state); if (!original || original.hp <= 0) return fail('行动者不存在');
    const b = clone(state), u = activeUnit(b)!, events: BattleEvent[] = [];
    switch (command.type) {
        case 'move': {
            if (b.moved) return fail('移动机会已使用');
            const path = paths(b, u).get(key(command.to));
            if (!path?.length) return fail('无法到达该格');
            b.moved = true;
            for (const to of path) {
                const from = { x: u.x, y: u.y }; let interrupted = false;
                for (const enemy of reactionSources(b, u, from, to)) {
                    enemy.reaction = false;
                    interrupted = applyHit(b, enemy, u, SKILLS[0], events, true) || interrupted;
                    if (u.hp <= 0) break;
                }
                if (u.hp <= 0 || interrupted) break;
                u.x = to.x; u.y = to.y;
                events.push({ type: 'move', unitId: u.id, from, to: { ...to }, text: '移动' });
            }
            log(b, `${unitLabel(u)} 移动至 ${String.fromCharCode(65 + u.x)}${u.y + 1}`); break;
        }
        case 'skill': {
            if (b.acted) return fail('主动行动机会已使用');
            const skill = availableSkills(u).find(s => s.id === command.skillId);
            const target = command.to && skill && (skill.area || skill.cross) && inside(command.to) && !blocked(command.to) ? areaTarget(u, command.to) : b.units.find(t => t.id === command.targetId);
            if (!skill || !target || !validTarget(b, u, target, skill) || ((skill.area || skill.cross) && !affected(b, target, skill).length)) return fail('目标、射程、视线或MP不满足要求');
            b.acted = true; u.mp -= skill.mp;
            if (skill.area || skill.cross) events.push({ type: 'area', unitId: u.id, to: { x: target.x, y: target.y }, skillId: skill.id, text: skill.name });
            const firstEvent = events.length;
            for (const t of affected(b, target, skill)) {
                if (skill.effect === 'damage') applyHit(b, u, t, skill, events);
                else {
                    const amount = Math.min(power(u, skill), t.maxHp - t.hp);
                    t.hp += amount;
                    log(b, `${unitLabel(u)} ${skill.name} → ${unitLabel(t)}：HP+${amount}｜${remainingResources(t)}`);
                    events.push({ type: 'heal', unitId: u.id, targetId: t.id, skillId: skill.id, hp: amount, armor: 0, text: `HP +${amount}` });
                }
            }
            if (skill.hit === 'ranged' && events[firstEvent]) events[firstEvent].projectileTargetId = target.id;
            break;
        }
        case 'disengage':
            if (b.acted || b.moved) return fail('脱离需要未使用的主动行动和移动');
            b.acted = true; b.disengaged = true; log(b, `${unitLabel(u)} 使用脱离，本次移动免除借机攻击`);
            events.push({ type: 'buff', unitId: u.id, targetId: u.id, text: '脱离' }); break;
        case 'item': {
            if (EQUIPMENT[command.itemId]?.slot !== 'consumable' || !b.stock.includes(command.itemId)) return fail('团队物资库中没有该道具');
            const requested=b.units.find(t=>t.id===command.targetId);
            if (requested?.team==='ally' && EQUIPMENT[command.itemId].restore) { const error=restorationError(requested,command.itemId); if(error)return fail(error); }
            if(command.itemId==='revival-stone' && requested?.team==='ally' && requested.hp>0)return fail('该队友未倒下，无需复活');
            const target=itemTargets(b,u,command.itemId).find(t=>t.id===command.targetId);
            if(!target)return fail('道具目标无效；精英和Boss不能收服');
            b.stock.splice(b.stock.indexOf(command.itemId),1);
            const sourceId=b.units.find(t=>t.team==='ally'&&t.hp>0)?.id||u.id;
            if(command.itemId==='contract') {
                const success=nextRandom(b)<captureChance(target);
                log(b,'团队对'+target.name+'使用契约：'+(success?'缔约成功，下场可出战':'缔约失败'));
                if(success){(b.captured ||= []).push(clone(target));b.units=b.units.filter(t=>t.id!==target.id);b.queue=b.queue.filter(id=>id!==target.id);}
                events.push({type:'buff',unitId:sourceId,targetId:target.id,text:success?'缔约成功':'缔约失败'});
            }else if(command.itemId==='revival-stone') {
                const to=revivePosition(b);target.hp=Math.max(1,Math.ceil(target.maxHp*.2));target.mp=target.maxMp;target.armor=0;target.x=to.x;target.y=to.y;target.reaction=false;
                log(b,target.name+'已复活：20%生命、满魔力，下轮加入行动');
                events.push({type:'revive',unitId:sourceId,targetId:target.id,to,hp:target.hp,text:'复活'});
            }else{
                const resource=EQUIPMENT[command.itemId].restore!.resource,amount=applyRestoration(target,command.itemId);
                log(b,target.name+' '+RESOURCE_LABELS[resource]+' +'+amount);
                events.push({type:resource==='hp'?'heal':'buff',unitId:sourceId,targetId:target.id,resource,amount,hp:resource==='hp'?amount:0,text:RESOURCE_LABELS[resource]+' +'+amount});
            }
            break;
        }
        case 'end': break;
        case 'retreat': return fail('战斗中不能撤退，请在路线撤离节点通关');
    }
    b.revision++;
    if (b.phase !== 'over' && !finishIfNeeded(b) && ((command.type==='item'&&!b.units.some(t=>t.id===b.activeId&&t.hp>0)) || (command.type !== 'item' && (command.type === 'end' || u.hp <= 0 || (b.moved && b.acted))))) {
        nextTurn(b); events.push({ type: 'turn', unitId: b.activeId, text: '下一位行动' });
    }
    if (b.phase === 'over') events.push({ type: 'result', unitId: u.id, text: b.result! });
    return { state: b, events };
}
function skillScore(b: Battle, source: Unit, target: Unit, skill: Skill): number {
    return affected(b, target, skill).reduce((sum, t) => {
        const amount = power(source, skill);
        if (skill.effect === 'heal') return sum + Math.min(amount, t.maxHp - t.hp) * 2;
                const l = losses(t, amount, skill.piercing);
        return sum + hitChance(source, t, skill) * (l.hp * 3 + l.armor + (l.hp >= t.hp ? 100 : 0));
    }, 0) - skill.mp * .5;
}
export function chooseAI(b: Battle): Command {
    const u = activeUnit(b); if (!u || b.phase !== 'battle') return { type: 'end' };
    if (u.team === 'ally' && !b.acted && u.hp / u.maxHp < .35 && itemTargets(b, u, 'potion').some(t => t.id === u.id)) return { type: 'item', itemId: 'potion', targetId: u.id };
    if (u.team === 'ally' && !b.acted && u.mp < 3 && itemTargets(b, u, 'ether').some(t => t.id === u.id)) return { type: 'item', itemId: 'ether', targetId: u.id };
    const reachable = !b.moved ? paths(b, u) : new Map([[key(u), [] as Point[]]]);
    let best: { score: number; skill: Skill; target: Unit; path: Point[] } | undefined;
    if (!b.acted) for (const path of reachable.values()) {
        const position = path.length ? path[path.length - 1] : u;
        const movedUnit = { ...u, ...position };
        const threatenedAtStart = b.units.some(enemy => enemy.hp > 0 && enemy.team !== u.team && distance(enemy, u) === 1);
        const stillEngaged = b.units.some(enemy => enemy.hp > 0 && enemy.team !== u.team && distance(enemy, movedUnit) === 1);
        const risks = pathRisk(b, u, path);
        let riskCost = 0, arrival = 1, armor = u.armor, hp = u.hp;
        for (const enemy of risks) {
            const p = hitChance(enemy, u, SKILLS[0]);
            const l = losses({ ...u, hp, armor }, power(enemy, SKILLS[0]));
            riskCost += p * (l.hp * 3 + l.armor + (l.hp >= hp ? 100 : 0));
            armor = Math.max(0, armor - l.armor); hp = Math.max(0, hp - l.hp); arrival *= 1 - p;
        }
        for (const skill of availableSkills(u)) for (const t of skillAims(b, movedUnit, skill)) {
            if (threatenedAtStart && skill.effect === 'damage' && skill.hit === 'ranged'
                && (path.length === 0 || stillEngaged)) continue;
            if (skill.effect === 'heal' && Math.min(power(u, skill), t.maxHp - t.hp) < 6) continue;
            const policy = u.policy || 'damage';
            const weapon = EQUIPMENT[u.equipment.weapon || ''];
            const prefersRanged = weapon?.rangedHit || (weapon?.spellPower || 0) > (weapon?.attack || 0);
            let preference = skill.effect === 'heal' ? (policy === 'support' ? 2 : .8) : 1;
            if (skill.effect === 'damage') {
                preference *= prefersRanged ? (skill.hit === 'ranged' ? 1.25 : .7) : (skill.hit === 'melee' ? 1.2 : .85);
                if (policy === 'assassin') { const victims = affected(b, t, skill); preference *= 1 + victims.reduce((sum, v) => sum + 1 - v.hp / v.maxHp, 0) / Math.max(1, victims.length) * .8; }
                if (policy === 'defender') {
                    const vulnerable = b.units.filter(ally => ally.team === u.team && ally.hp > 0 && ally.id !== u.id).sort((a, c) => a.hp - c.hp)[0];
                    if (vulnerable && distance(t, vulnerable) <= 2) preference *= 1.5;
                }
            }
            const exposed = b.units.filter(enemy => enemy.team !== u.team && enemy.hp > 0 && distance(movedUnit, enemy) === 1).length;
            const score = skillScore(b, movedUnit, t, skill) * preference * arrival - riskCost - path.length * .2 - (prefersRanged || policy === 'support' ? exposed * 8 : 0);
            if (score > 0 && (!best || score > best.score + .0001)) best = { score, skill, target: t, path };
        }
    }
    if (best) return best.path.length ? { type: 'move', to: best.path[best.path.length - 1] } : { type: 'skill', skillId: best.skill.id, ...(best.skill.area || best.skill.cross ? { to: { x: best.target.x, y: best.target.y } } : { targetId: best.target.id }) };
    // Once an attack was made, do not retreat gratuitously. Preserve auto pacing.
    if (b.acted && (!b.disengaged || b.moved)) return { type: 'end' };
    if (!b.moved) {
        const enemies = b.units.filter(t => t.team !== u.team && t.hp > 0);
        const longPaths = paths(b, u, COLS * ROWS);
        let approach: Point[] | undefined;
        for (const path of longPaths.values()) {
            if (!path.length) continue;
            const at = { ...u, ...path[path.length - 1] };
            if (!enemies.some(t => (distance(at, t) === 1 || (distance(at, t) >= 2 && distance(at, t) <= 3)) && visible(at, t))) continue;
            if (!approach || path.length < approach.length) approach = path;
        }
        if (approach?.length) {
            const short = approach.slice(0, u.move);
            if (pathRisk(b, u, short).length && !b.disengaged) return { type: 'disengage' };
            return { type: 'move', to: short[short.length - 1] };
        }
    }
    return { type: 'end' };
}
export function configureEquipment(state: Battle, unitId: string, equipment: EquipmentLoadout, artifacts: string[]): Battle {
    if (state.phase !== 'ready') return state;
    const unit = state.units.find(u => u.id === unitId);
    if (!unit || unit.team !== 'ally') return state;
    const b = clone(state), target = b.units.find(u => u.id === unitId)!;
    const carried=(u:Unit)=>[u.equipment.weapon,u.equipment.armor,u.equipment.backpack||'travel-bag',...u.artifacts].filter((id):id is string=>!!id);
    const pool=[...b.stock,...carried(target)];
    for(const id of carried({...target,equipment,artifacts})){const i=pool.indexOf(id);if(i<0)return state;pool.splice(i,1);}
    if (!setCharacterEquipment(target, equipment, artifacts)) return state;
    try { assertStockCapacity(pool, b.stockLimit); } catch { return state; } b.stock=pool;
    b.revision++;
    return b;
}
export const BATTLE_RULES = 'team-stock-2';
export function exportSnapshot(b: Battle): string { return JSON.stringify({ schema: 1, rules: BATTLE_RULES, battle: b }); }
export function importSnapshot(json: string): Battle {
    const parsed = JSON.parse(json) as { schema?: number; rules?: string; battle?: Battle };
    if (parsed.schema !== 1 || parsed.rules !== BATTLE_RULES || !parsed.battle) throw new Error('快照版本不兼容');
    const b = parsed.battle;
    if(!Array.isArray(b.stock)||b.stock.some(id=>typeof id!=='string'||!Object.prototype.hasOwnProperty.call(EQUIPMENT,id)))throw new Error('团队物资数据无效');
    if (!Array.isArray(b.captured) || b.captured.length > MAX_TEAM || b.captured.some(u => !u || u.team !== 'enemy' || (u.rank && u.rank !== 'normal') || u.hp <= 0 || u.heroId)) throw new Error('收服数据无效');
    if (b.version !== 1 || !['ready', 'battle', 'over'].includes(b.phase) || !Array.isArray(b.units) || b.units.length < 1 || b.units.length > 20
        || !Number.isInteger(b.round) || b.round < 0 || !Number.isInteger(b.rng) || b.rng <= 0 || b.rng > 0xffffffff
        || !Number.isInteger(b.draws) || b.draws < 0 || !Number.isInteger(b.seed) || b.seed <= 0
        || !Number.isInteger(b.revision) || b.revision < 0 || !Array.isArray(b.queue) || !Array.isArray(b.logs)
        || !b.logs.every(s => typeof s === 'string') || ![null, 'victory', 'defeat', 'retreat'].includes(b.result)
        || ![b.moved, b.acted, b.disengaged].every(x => typeof x === 'boolean')) throw new Error('无效的战斗快照');
    const ids = new Set<string>(), places = new Set<string>(), orders = new Set<number>();
    const heroes = new Set<HeroId>();
    for (const u of [...b.units, ...b.captured]) {
        if (typeof u.id !== 'string' || ids.has(u.id) || typeof u.name !== 'string' || !['ally', 'enemy'].includes(u.team)
            || !inside(u) || blocked(u) || !Number.isInteger(u.order) || orders.has(u.order) || typeof u.reaction !== 'boolean'
            || !Number.isInteger(u.portrait) || u.portrait < 0 || u.portrait > 3) throw new Error('快照单位数据无效');
        if(u.team==='ally'&&u.cargo?.length)throw new Error('我方消耗品须进入团队物资库');
        if(u.cargo!==undefined&&(!Array.isArray(u.cargo)||u.cargo.some(id=>!Object.prototype.hasOwnProperty.call(EQUIPMENT,id))))throw new Error('敌人携带物品无效');
        if(u.carriedGold!==undefined&&(!Number.isInteger(u.carriedGold)||u.carriedGold<0))throw new Error('敌人金币无效');
        if (!validProgression(u.progression)) throw new Error('角色成长数据无效');
        if (u.team === 'ally') {
            if (u.heroId !== undefined && (!isHeroId(u.heroId) || heroes.has(u.heroId) || u.progression.species !== 'human')) throw new Error('队员预设无效或重复');
            if (u.heroId) heroes.add(u.heroId);
        } else if (u.heroId !== undefined) throw new Error('敌方不能使用我方预设');
        if (!validEquipment(u.equipment, u.artifacts)) throw new Error('装备数据无效');
        if ((['weapon', 'armor'] as const).some(slot => {
            const id = u.equipment[slot];
            return id !== null && !canUseEquipment(EQUIPMENT[id], u.progression.attributes);
        })) throw new Error('未满足裸属性装备要求');
        const derived = deriveStats(u.progression.attributes, u.equipment, u.artifacts);
        if ((Object.keys(derived) as (keyof typeof derived)[]).some(key => u[key] !== derived[key])) throw new Error('战斗属性与主属性不一致');
        ids.add(u.id); orders.add(u.order);
        for (const [current, maximum] of [[u.hp, u.maxHp], [u.mp, u.maxMp], [u.armor, u.maxArmor]]) {
            if (!Number.isInteger(current) || !Number.isInteger(maximum) || current < 0 || current > maximum || maximum < 0) throw new Error('资源数据无效');
        }
        if (u.maxHp < 1 || ![u.attack, u.spellPower, u.speed, u.move, u.meleeHit, u.rangedHit, u.evasion].every(n => Number.isInteger(n) && n >= 0 && n <= 1000)
            || u.move > 8 || u.evasion > 35) throw new Error('属性数据无效');
        if (u.hp > 0 && !b.captured.includes(u)) { if (places.has(key(u))) throw new Error('单位位置重叠'); places.add(key(u)); }
        if (u.learnedSkills !== undefined && (!Array.isArray(u.learnedSkills) || new Set(u.learnedSkills).size !== u.learnedSkills.length || u.learnedSkills.some(id => !EQUIPPABLE.some(s => s.id === id)) || u.skills.some(id => !u.learnedSkills!.includes(id)))) throw new Error('掌握技能数据无效');
        if(u.archetype!==undefined&&(!validMonsterArchetype(u.archetype,u.progression.species,u.rank)||u.heroId))throw new Error('怪物身份数据无效');
        if(u.appearance!==undefined&&(!isHumanAppearance(u.appearance)||u.progression.species!=='human'||u.heroId))throw new Error('人物外观数据无效');
        if (!Array.isArray(u.skills) || u.skills.length > 3 || new Set(u.skills).size !== u.skills.length || u.skills.some(id => !EQUIPPABLE.some(s => s.id === id))) throw new Error('技能数据无效');
    }
    if (b.units.filter(u => u.team === 'ally').length > MAX_TEAM || b.units.filter(u => u.team === 'enemy').length > MAX_TEAM) throw new Error('每方最多10人');
    if (b.units.some(u => u.policy !== undefined && !Object.prototype.hasOwnProperty.call(POLICIES, u.policy)) || b.units.some(u => u.rank !== undefined && !['normal', 'elite', 'boss'].includes(u.rank))) throw new Error('行动方针或敌人级别无效');
    if (new Set(b.queue).size !== b.queue.length || b.queue.some(id => !ids.has(id))) throw new Error('队列无效');
    if (b.phase === 'battle' && (!activeUnit(b) || activeUnit(b)!.hp <= 0 || b.queue.includes(b.activeId)
        || b.result !== null || !b.units.some(u => u.team === 'ally' && u.hp > 0) || !b.units.some(u => u.team === 'enemy' && u.hp > 0))) throw new Error('行动状态无效');
    return clone(b);
}







