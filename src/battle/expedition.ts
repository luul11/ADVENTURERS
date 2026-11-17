import { Battle, Unit, Policy, MAX_TEAM, clone, createBattle, createEncounter } from './engine';
import { EquipmentLoadout, EQUIPMENT, applyRestoration, setCharacterEquipment } from './progression';
import { HeroId } from './roster';
import { DungeonId, NodeKind, CombatKind, EventChoice, EventEffect, getDungeon, getEvent, getEncounter, HUMAN_ENCOUNTERS, getHumanEncounter, encounterForNode, seededHash, weightedPick } from './dungeonConfig';
import { assertStockCapacity, storageCapacity, transferStock } from './storage';
import { battleSpoils } from './loot';
import { createConfiguredUnit, createPresetEnemies, createAdaptiveHumans } from './encounters';
export type { NodeKind } from './dungeonConfig';
export const NODE_NAMES: Record<NodeKind, string> = { battle: '普通战斗', rest: '休息', elite: '精英战斗', shop: '商店', boss: 'Boss', extract: '撤离', event: '事件', human: '人类遭遇' };
export interface RouteNode { id: string; depth: number; lane: number; kind: NodeKind; next: string[]; encounterId?: string; eventId?: string }
export interface Expedition {
    lootReturnStage?: 'route' | 'node'; storageLevel?: number; stockLimit?: number; packedStock?: string[]; packedGold?: number; pendingItems?: string[]; settledSeeds?: number[];
    seed: number; dungeonId: DungeonId; party: Unit[]; stock: string[]; gold: number; nodes: RouteNode[]; visited: string[];
    current: string | null; stage: 'route' | 'node' | 'battle' | 'overcrowded' | 'loot' | 'won' | 'lost';
    battle?: Battle; message: string; battlesWon: number; activeEncounterId?: string; pendingCompletion?: boolean;
    event?: { nodeId: string; id: string; stage: string }; eventHistory: { nodeId: string; eventId: string; choiceId: string; result: string }[];
    nextEnemyHp: number; lastLoot?: { nodeId:string; items:string[]; gold:number; defeated:number; claimed:boolean };
}
export const SHOP: { id: string; price: number }[] = [
    { id: 'contract', price: 25 }, { id: 'potion', price: 20 }, { id: 'ether', price: 20 }, { id: 'repair-kit', price: 15 }, { id: 'repair-kit-large', price: 25 },
    { id: 'revival-stone', price: 50 }, { id: 'scout-bag', price: 45 }, { id: 'expedition-bag', price: 90 },
    { id: 'arcane-core', price: 65 }, { id: 'chain-armor', price: 50 }, { id: 'shortbow', price: 40 }
];
export function generateRoute(seed: number, dungeonId: DungeonId = 'suburban-road'): RouteNode[] {
    const d = getDungeon(dungeonId), seenEvents: string[] = []; let humanPlaced=false;
    const nodes = d.layers.flatMap((kinds, depth) => {
        const ordered = depth > 0 && depth < d.layers.length - 1 && seededHash(seed + depth) % 2 ? [...kinds].reverse() : kinds;
        return ordered.map((kind, i): RouteNode => ({ id: `node-${depth}-${i}`, kind, depth, lane: ordered.length === 1 ? 1 : ordered.length === 2 ? i * 2 : i, next: [] }));
    });
    for (const n of nodes) {
        n.next = nodes.filter(t => t.depth === n.depth + 1 && Math.abs(t.lane - n.lane) <= 1).map(t => t.id);
        const salt = seededHash(seed + Math.imul(n.depth + 1, 2654435761) + n.lane * 1103515245);
        if(n.kind==='battle'&&n.depth>0&&!humanPlaced&&seededHash(salt+753917)/4294967296<d.humanChance){n.kind='human';n.encounterId=weightedPick(HUMAN_ENCOUNTERS,c=>c.weight,salt+137).id;humanPlaced=true;}
        if (['battle','elite','boss'].includes(n.kind)) n.encounterId = encounterForNode(d, n.kind as CombatKind, n.depth, salt, nodes.filter(t=>t.depth===n.depth&&t.encounterId).map(t=>t.encounterId!)).id;
        if (n.kind === 'event') {
            const unused = d.eventPool.filter(id => !seenEvents.includes(id)), pool = unused.length ? unused : d.eventPool;
            n.eventId = pool[seededHash(salt + 89137) % pool.length]; seenEvents.push(n.eventId);
        }
    }
    return nodes;
}
export function createExpedition(heroIds: readonly HeroId[], seed = Date.now() >>> 0, dungeonId: DungeonId = 'suburban-road'): Expedition {
    getDungeon(dungeonId);
    const party = createBattle(seed || 1, heroIds).units.filter(u => u.team === 'ally');

    return { storageLevel: 0, stockLimit: storageCapacity(), seed: seed || 1, dungeonId, party, stock: ['repair-kit','repair-kit-large','contract','contract','contract','potion','potion','potion','potion','ether','ether','ether','revival-stone','scout-bag'], gold: 80,
        nodes: generateRoute(seed || 1, dungeonId), visited: [], current: null, stage: 'route', message: '', battlesWon: 0, eventHistory: [], nextEnemyHp: 1 };
}
export function normalizeTeamInventory(run:Expedition):Expedition {
    const r=clone(run);
    for(const u of r.party){const kept=u.artifacts.filter(id=>EQUIPMENT[id]?.slot==='artifact');r.stock.push(...u.artifacts.filter(id=>EQUIPMENT[id]?.slot!=='artifact'),...(u.cargo||[]));u.artifacts=kept;u.cargo=[];r.gold+=u.carriedGold||0;u.carriedGold=0;}
    return r;
}
export function availableNodes(run: Expedition): string[] {
    if (run.stage !== 'route' || run.party.length > MAX_TEAM) return [];
    try { assertStockCapacity(run.stock, run.stockLimit); } catch { return []; }
    return run.current ? run.nodes.find(n => n.id === run.current)!.next : run.nodes.filter(n => n.depth === 0).map(n => n.id);
}
function startEncounter(r: Expedition, encounterId: string): void {
    if (!r.party.some(u => u.hp > 0)) { r.stage = 'lost'; r.message = '没有可出战队员。'; return; }
    const node = r.nodes.find(n => n.id === r.current)!, seed = seededHash(r.seed + (node.depth + 1) * 103813 + node.lane * 97) || 1;
    const enemies = node.kind==='human'?createAdaptiveHumans(encounterId,seed,r.party):createPresetEnemies(encounterId, seed);
    if (r.nextEnemyHp < 1) enemies.forEach(u => { u.hp = Math.max(1, Math.ceil(u.maxHp * r.nextEnemyHp)); });
    const scouted = r.nextEnemyHp < 1; r.nextEnemyHp = 1;
    r.battle = createEncounter(seed, r.party, enemies, r.stock); r.battle.stockLimit = r.stockLimit; r.activeEncounterId = encounterId;
    r.battle.logs.push((node.kind==='human'?getHumanEncounter(encounterId).name:getEncounter(encounterId).name) + (scouted ? '：侦察生效，敌人以85%生命入场。' : ''));
    r.stage = 'battle';
}
export function enterNode(run: Expedition, id: string): Expedition {
    if (!availableNodes(run).includes(id)) throw new Error('只能进入相连的下一节点');
    const r = clone(run), node = r.nodes.find(n => n.id === id)!; r.current = id; r.visited.push(id); r.message = '';
    if (node.kind === 'extract') { r.gold += getDungeon(r.dungeonId).extractionGold; r.stage = 'won'; r.message = '队伍已安全撤离，获得撤离奖励，副本通关。'; return r; }
    if (['battle','elite','boss','human'].includes(node.kind)) startEncounter(r, node.encounterId!);
    else { r.stage = 'node'; if (node.kind === 'event') { const e = getEvent(node.eventId!); r.event = { nodeId: id, id: e.id, stage: e.start }; } }
    return r;
}
export function settleBattle(run: Expedition, battle: Battle): Expedition {
    if (run.stage !== 'battle' || battle.phase !== 'over' || !run.battle || battle.seed !== run.battle.seed || !run.activeEncounterId) throw new Error('当前没有可结算的战斗');
    const r = clone(run);
    r.party = r.party.map(u => clone(battle.units.find(t => t.team === 'ally' && t.id === u.id) || u));
    r.stock=[...battle.stock]; r.battle = undefined;
    if (battle.result !== 'victory') { r.stage = 'lost'; r.message = '队伍战败，本局结束。'; return r; }
    const node=r.nodes.find(n=>n.id===r.current)!,reward=node.kind==='human'?{gold:0,items:[]}:getEncounter(r.activeEncounterId!).reward,loot=battleSpoils(battle);r.battlesWon++;
    for (const captured of battle.captured || []) {
        const recruit = clone(captured); recruit.id = `recruit-${node.id}-${captured.id}`; recruit.team = 'ally'; recruit.rank = 'normal'; recruit.heroId = undefined; (r.pendingItems ||= []).push(...(recruit.cargo||[]));r.gold+=recruit.carriedGold||0;recruit.cargo=[];recruit.carriedGold=0;r.party.push(recruit);
    }
    r.pendingCompletion=node.kind==='boss';
    r.lastLoot={nodeId:node.id,items:[...(r.pendingItems || []),...reward.items,...loot.items],gold:reward.gold+loot.gold+(r.pendingCompletion?getDungeon(r.dungeonId).completionGold:0),defeated:loot.defeated,claimed:false};
    r.pendingItems = []; r.stage='loot';r.message='战斗胜利，整理物资后继续冒险。';
    r.activeEncounterId = undefined; r.event = undefined; return r;
}
export function collectLoot(run:Expedition):Expedition {
    if(run.stage!=='loot'||!run.lastLoot||run.lastLoot.claimed)throw new Error('没有可搜刮的战利品');
    assertStockCapacity(run.stock, run.stockLimit);
    const r=clone(run),loot=r.lastLoot!;r.gold+=loot.gold;loot.claimed=true;loot.items=[];
    r.stage=r.party.length>MAX_TEAM?'overcrowded':r.pendingCompletion?'won':r.lootReturnStage||'route';delete r.lootReturnStage;r.message='整理完成，已带走所选物资。';return r;
}
export function moveLootItem(run: Expedition, id: string, from: 'loot' | 'stock', count = 1): Expedition {
    if (run.stage !== 'loot' || !run.lastLoot || run.lastLoot.claimed) throw new Error('当前不能搜刮');
    const r = clone(run), loot = r.lastLoot!;
    const moved = transferStock(from === 'loot' ? loot.items : r.stock, from === 'loot' ? r.stock : loot.items, id, count, from === 'loot' ? r.stockLimit : undefined);
    if (from === 'loot') { loot.items = moved.source; r.stock = moved.target; } else { r.stock = moved.source; loot.items = moved.target; }
    return r;
}
export function sellValuables(run:Expedition):Expedition {
    if(!['route','node'].includes(run.stage) || (run.stockLimit !== undefined && (run.stage !== 'node' || run.nodes.find(n=>n.id===run.current)?.kind !== 'shop')))throw new Error('杂物只能在基地或商店出售');
    const ids=run.stock.filter(id=>EQUIPMENT[id]?.slot==='valuable');if(!ids.length)throw new Error('没有可换金的杂物');
    const r=clone(run),gold=ids.reduce((n,id)=>n+(EQUIPMENT[id].sellPrice||0),0);r.stock=r.stock.filter(id=>EQUIPMENT[id]?.slot!=='valuable');r.gold+=gold;r.message='换金杂物售出，获得'+gold+'金币。';return r;
}
export function dismissRecruit(run: Expedition, unitId: string): Expedition {
    if (!['route','node','overcrowded'].includes(run.stage)) throw new Error('当前不能整理队伍');
    const u = run.party.find(t => t.id === unitId); if (!u || u.heroId) throw new Error('初始主角团不可遣散');
    const r = clone(run); r.party = r.party.filter(t => t.id !== unitId);
    const belongings = carriedItems(u);
    try { assertStockCapacity([...r.stock, ...belongings], r.stockLimit); r.stock.push(...belongings); }
    catch { r.lootReturnStage = run.stage === 'node' ? 'node' : 'route'; r.lastLoot = { nodeId: 'dismiss-' + u.id, items: belongings, gold: 0, defeated: 0, claimed: false }; r.stage = 'loot'; r.message = '队员已遣散，请整理留下的装备。'; return r; }
    if (r.stage === 'overcrowded' && r.party.length <= MAX_TEAM) r.stage = r.pendingCompletion ? 'won' : 'route';
    return r;
}
export function eventChoices(run: Expedition): { choice: EventChoice; disabledReason?: string }[] {
    if (run.stage !== 'node' || !run.event || run.event.nodeId !== run.current) return [];
    const event = getEvent(run.event.id), stage = event.stages[run.event.stage]; if (!stage) return [];
    return stage.choices.map(choice => ({ choice, disabledReason: eventChoiceError(run, choice) }));
}
function eventChoiceError(run: Expedition, choice: EventChoice): string | undefined {
    if (choice.requires === 'fallen' && !run.party.some(u=>u.hp===0)) return '没有倒下的队员';
    if (choice.requires === 'injured' && !run.party.some(u=>u.hp>0&&u.hp<u.maxHp)) return '存活队员生命已满';
    if (choice.requires === 'damagedArmor' && !run.party.some(u=>u.hp>0&&u.armor<u.maxArmor)) return '存活队员护甲已满';
    // Event recruitment is optional; ordinary combat capture still permits temporary overflow.
    if (choice.requires === 'space' && run.party.length >= MAX_TEAM) return '队伍已满，请先遣散非主角成员';
    if (run.gold < (choice.cost?.gold || 0)) return '金币不足，需要' + choice.cost!.gold + '金币';
    const available = [...run.stock];
    for (const id of choice.cost?.items || []) { const i = available.indexOf(id); if (i < 0) return '缺少' + EQUIPMENT[id].name; available.splice(i,1); }
    return undefined;
}
function consumeEventCost(r: Expedition, choice: EventChoice): void {
    r.gold -= choice.cost?.gold || 0;
    for (const id of choice.cost?.items || []) {
        const i = r.stock.indexOf(id); if (i >= 0) r.stock.splice(i,1);
        else throw new Error('团队物资库缺少事件所需物品');
    }
}
function applyEventEffects(r: Expedition, effects: EventEffect[]): void {
    for (const e of effects) {
        if (e.type === 'gold') r.gold += e.amount;
        else if (e.type === 'items') (r.pendingItems ||= []).push(...e.ids);
        else if (e.type === 'scout') r.nextEnemyHp = Math.min(r.nextEnemyHp, e.enemyHp);
        else if (e.type === 'recover') r.party.filter(u=>u.hp>0).forEach(u=>{ u.hp=Math.min(u.maxHp,u.hp+Math.ceil(u.maxHp*e.hp)); u.mp=Math.min(u.maxMp,u.mp+Math.ceil(u.maxMp*e.mp)); u.armor=Math.min(u.maxArmor,u.armor+Math.ceil(u.maxArmor*e.armor)); });
        else if (e.type === 'hurt') r.party.filter(u=>u.hp>0).forEach(u=>{ u.hp=Math.max(1,u.hp-Math.ceil(u.maxHp*e.hp)); });
        else if (e.type === 'revive') { const u=r.party.find(u=>u.hp===0); if (!u) throw new Error('没有倒下的队员'); u.hp=Math.max(1,Math.ceil(u.maxHp*e.hp));u.mp=Math.ceil(u.maxMp*e.mp);u.armor=0; }
        else if (e.type === 'recruit') {
            if (r.party.length>=MAX_TEAM) throw new Error('队伍已满');
            const u=createConfiguredUnit({species:e.species,count:1,level:e.level,rank:'normal',role:e.role},seededHash(r.seed+(r.current?.length||1)*917+ r.visited.length*67),r.party.length);
            u.id='event-recruit-'+r.current;u.team='ally';r.party.push(u);
        }
    }
}
export function resolveEvent(run: Expedition, choiceId: string): Expedition {
    const node = run.nodes.find(n=>n.id===run.current);
    if (run.stage!=='node' || node?.kind!=='event' || !run.event || run.event.nodeId!==node.id || run.event.id!==node.eventId) throw new Error('当前没有待处理事件');
    const entry=eventChoices(run).find(e=>e.choice.id===choiceId);if(!entry)throw new Error('事件选项不存在');if(entry.disabledReason)throw new Error(entry.disabledReason);
    const r=clone(run), choice=entry.choice;consumeEventCost(r,choice);applyEventEffects(r,choice.effects);
    if (choice.nextStage) { r.event!.stage=choice.nextStage;r.message='';return r; }
    let result=choice.description, encounter: string|undefined;
    if (choice.outcomes?.length) {
        const salt = [...(node.id+choice.id)].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619),r.seed);
        const outcome=weightedPick(choice.outcomes,o=>o.weight,salt);applyEventEffects(r,outcome.effects);result=outcome.text;encounter=outcome.encounter;
    }
    r.eventHistory.push({nodeId:node.id,eventId:r.event!.id,choiceId,result});r.event=undefined;r.message=result;
    if(encounter)startEncounter(r,encounter);else if(r.pendingItems?.length){r.lastLoot={nodeId:node.id,items:r.pendingItems,gold:0,defeated:0,claimed:false};r.pendingItems=[];r.pendingCompletion=false;r.stage='loot';}else r.stage='route';return r;
}
export function resolveNode(run: Expedition, choice: string): Expedition {
    if (run.stage !== 'node') throw new Error('当前没有待处理节点');
    const node = run.nodes.find(n=>n.id===run.current)!;
    if(node.kind==='event')return resolveEvent(run,choice);
    const r=clone(run);
    if(node.kind==='rest'&&choice==='rest'){
        const recovery=getDungeon(r.dungeonId).rest;
        applyEventEffects(r,[{type:'recover',...recovery}]);r.message=getDungeon(r.dungeonId).restDescription;
    }else if(!(node.kind==='shop'&&choice==='leave'))throw new Error('无效的节点选项');
    r.stage='route';return r;
}
export function buyItem(run: Expedition, id: string): Expedition {
    const offer = SHOP.find(o=>o.id===id);
    if(run.stage!=='node'||run.nodes.find(n=>n.id===run.current)?.kind!=='shop'||!offer||run.gold<offer.price)throw new Error('金币不足或当前不在商店');
    assertStockCapacity([...run.stock, id], run.stockLimit);
    const r=clone(run);r.gold-=offer.price;r.stock.push(id);r.message='已购买'+EQUIPMENT[id].name;return r;
}
export function carriedItems(u: Unit): string[] { return [u.equipment.weapon, u.equipment.armor, u.equipment.backpack || 'travel-bag', ...u.artifacts].filter((id): id is string => !!id); }
export function equipMember(run: Expedition, unitId: string, equipment: EquipmentLoadout, artifacts: string[]): Expedition {
    if (!['route', 'node', 'battle'].includes(run.stage) || (run.stage === 'battle' && run.battle?.phase !== 'ready')) throw new Error('当前不可更换装备');
    const r = clone(run), unit = r.party.find(u => u.id === unitId); if (!unit) throw new Error('队员不存在');
    const pool = [...r.stock, ...carriedItems(unit)];
    const next = { ...unit, equipment, artifacts };
    for (const id of carriedItems(next)) { const i = pool.indexOf(id); if (i < 0) throw new Error('物资库没有该物品'); pool.splice(i, 1); }
    if (!setCharacterEquipment(unit, equipment, artifacts)) throw new Error('装备要求或背包容量不满足');
    assertStockCapacity(pool, r.stockLimit); r.stock = pool;
    if (r.battle) { r.battle.stock=[...r.stock];const actor = r.battle.units.find(u => u.id === unitId); if (actor) Object.assign(actor, clone(unit)); }
    return r;
}
export function useCampItem(run: Expedition, ownerId: string | null, itemId: string, targetId: string): Expedition {
    if (!['route', 'node'].includes(run.stage)) throw new Error('当前不能使用营地道具');
    void ownerId;const r=clone(run),bag=r.stock;
    const target = r.party.find(u => u.id === targetId), i = bag?.indexOf(itemId) ?? -1;
    if (!bag || i < 0 || !target) throw new Error('道具或目标不存在');
    if (itemId === 'revival-stone' && target.hp === 0) { target.hp = Math.max(1, Math.ceil(target.maxHp * .2)); target.mp = target.maxMp; target.armor = 0; }
    else if (EQUIPMENT[itemId]?.restore) applyRestoration(target, itemId);
    else throw new Error(itemId === 'revival-stone' ? '队员未倒下，无需使用复苏石' : '该道具不能用于此目标');
    bag.splice(i, 1); r.message = target.name + '使用了' + EQUIPMENT[itemId].name; return r;
}
export function setPolicy(run: Expedition, id: string, policy: Policy): Expedition {
    if (!['route', 'node'].includes(run.stage) || !['assassin', 'damage', 'defender', 'support'].includes(policy)) throw new Error('当前不可设置该行动方针');
    const r = clone(run), u = r.party.find(u => u.id === id); if (!u) throw new Error('队员不存在'); u.policy = policy; return r;
}
