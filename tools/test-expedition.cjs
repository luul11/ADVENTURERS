const assert = require('node:assert/strict');
const takeLoot=run=>require('./loot-test-helper.cjs')(x,run);
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, filename);
const e = require('../src/battle/engine.ts'), x = require('../src/battle/expedition.ts'), p = require('../src/battle/progression.ts'), inv = require('../src/battle/inventory.ts'), roster = require('../src/battle/roster.ts');
const settleAndLoot=(run,battle)=>{const next=x.settleBattle(run,battle);return next.stage==='loot'?takeLoot(next):next;};
const fresh = () => x.createExpedition(roster.DEFAULT_HERO_IDS, 12345);
let r = fresh();
assert.equal(r.party.length, 5); assert.equal(new Set(r.party.map(u => u.heroId)).size, 5);
assert.deepEqual(new Set(r.nodes.map(n => n.kind)), new Set([...new Set(r.nodes.map(n=>n.kind))]));
for (let seed = 1; seed <= 100; seed++) {
    const nodes = x.generateRoute(seed), reached = new Set([nodes[0].id]);
    for (const n of nodes) if (reached.has(n.id)) { if (n.kind !== 'boss') assert.ok(n.next.length); n.next.forEach(id => { const t = nodes.find(v => v.id === id); assert.equal(t.depth, n.depth + 1); reached.add(id); }); }
    assert.equal(reached.size, nodes.length);
}
assert.throws(() => x.enterNode(r, r.nodes.find(n => n.kind === 'boss').id));
let battleRun = x.enterNode(r, x.availableNodes(r)[0]);
assert.equal(battleRun.stage, 'battle');
const ended = e.clone(battleRun.battle); ended.phase = 'over'; ended.result = 'victory';
const lead = ended.units.find(u => u.team === 'ally'); lead.hp -= 12; lead.mp = 1; lead.armor = 0;
const fallen = ended.units.filter(u => u.team === 'ally')[1]; fallen.hp = 0;
const recruited = e.clone(ended.units.find(u => u.team === 'enemy')); recruited.hp = 3; ended.captured = [recruited];
r = settleAndLoot(battleRun, ended);
assert.equal(r.party.find(u => u.id === lead.id).hp, lead.hp); assert.equal(r.party.find(u => u.id === lead.id).mp, 1); assert.equal(r.party.find(u => u.id === lead.id).armor, 0);
assert.equal(r.party.find(u => u.id === fallen.id).hp, 0); assert.equal(r.party.length, 6); assert.equal(r.party.at(-1).hp, 3); assert.equal(r.party.at(-1).team, 'ally'); assert.equal(r.party.at(-1).heroId, undefined);
assert.throws(() => settleAndLoot(r, ended)); assert.throws(() => x.dismissRecruit(r, lead.id));
const rested = x.resolveNode({ ...r, stage: 'node', current: r.nodes.find(n => n.kind === 'rest').id }, 'rest');
assert.equal(rested.party.find(u => u.id === fallen.id).hp, 0);
const eventNode = r.nodes.find(n => n.kind === 'event');
const eventRun = e.clone({ ...r, stage: 'node', current: eventNode.id, event: { nodeId: eventNode.id, id: 'injured-scout', stage: 'start' } });
eventRun.nodes.find(n => n.id === eventNode.id).eventId = 'injured-scout';
const revived = x.resolveNode(eventRun, 'revive'); assert.equal(revived.party.find(u => u.id === fallen.id).hp, Math.ceil(fallen.maxHp * .4));
assert.equal(takeLoot(x.resolveNode(eventRun, 'supplies')).stock.length, eventRun.stock.length + 2);
assert.equal(x.useCampItem(r, null, 'revival-stone', fallen.id).party.find(u => u.id === fallen.id).hp, Math.ceil(fallen.maxHp * .2));
const worn = e.clone(r.party[0]); worn.hp = 0; worn.armor = 0; worn.mp = 0; assert.ok(p.setCharacterEquipment(worn, { ...worn.equipment, backpack: 'scout-bag' }, worn.artifacts)); assert.deepEqual([worn.hp, worn.armor, worn.mp], [0, 0, 0]);
const stockBefore = [...r.stock, ...r.party.flatMap(x.carriedItems)].sort();
const changed = x.equipMember(r, r.party[0].id, { ...r.party[0].equipment, backpack: 'scout-bag' }, r.party[0].artifacts);
assert.deepEqual([...changed.stock, ...changed.party.flatMap(x.carriedItems)].sort(), stockBefore);
assert.throws(() => x.equipMember(r, r.party[0].id, { ...r.party[0].equipment, backpack: 'expedition-bag' }, r.party[0].artifacts));
const model = { attributes: r.party[0].progression.attributes, equipment: { weapon: null, armor: null, backpack: 'expedition-bag' }, artifacts: ['potion', 'ether', 'contract', 'revival-stone'], items: Object.values(p.EQUIPMENT), editable: true };
assert.ok(inv.moveInventoryItem(model, 'travel-bag', 'backpack').error); assert.equal(model.artifacts.length, 4);
assert.equal(p.bagCapacity(model.equipment), 6); assert.equal(p.bagCapacity({ weapon: null, armor: null }), 3);
assert.ok(inv.moveInventoryItem({ ...model, equipment: { ...model.equipment, backpack: 'travel-bag' }, artifacts: ['potion', 'ether', 'contract'] }, 'life-charm', 'bag').error);
const over = { ...r, stage: 'overcrowded', party: [...r.party, ...Array.from({ length: 5 }, (_, i) => ({ ...e.clone(recruited), id: 'extra-' + i, team: 'ally' }))] };
assert.equal(over.party.length, 11); assert.deepEqual(x.availableNodes(over), []); const cleared = x.dismissRecruit(over, 'extra-0'); assert.equal(cleared.party.length, 10); assert.equal(cleared.stage, 'route');
assert.equal(settleAndLoot(battleRun, { ...ended, result: 'defeat' }).stage, 'lost');
const extractNode = r.nodes.find(n => n.kind === 'extract'), previous = r.nodes.find(n => n.next.includes(extractNode.id));
assert.equal(x.enterNode({ ...r, current: previous.id }, extractNode.id).stage, 'won');
const shop = { ...r, stage: 'node', current: r.nodes.find(n => n.kind === 'shop').id };
assert.equal(x.buyItem(shop, 'contract').gold, shop.gold - 25); assert.throws(() => x.buyItem({ ...shop, gold: 0 }, 'contract'));
function combat() {
    const b = e.startBattle(e.createBattle(12345)), source = b.units.find(u => u.team === 'ally'), enemy = b.units.find(u => u.team === 'enemy');
    b.units.forEach(u => { u.hp = 0; }); Object.assign(source, { hp: source.maxHp, x: 0, y: 0, artifacts: ['contract', 'potion', 'ether'] }); Object.assign(enemy, { hp: 1, x: 0, y: 2 }); b.activeId = source.id; b.queue = [enemy.id]; b.rng = 1;
    b.stock=['contract','potion','ether'];source.artifacts=[];return { b, source, enemy };
}
let c = combat(); assert.equal(e.captureChance({ hp: 100, maxHp: 100 }), .1); assert.equal(e.captureChance({ hp: 1, maxHp: 100 }), .95);
let captured = e.resolve(c.b, { type: 'item', itemId: 'contract', targetId: c.enemy.id }); assert.equal(captured.error, undefined); assert.equal(captured.state.captured.length, 1); assert.equal(captured.state.units.some(u => u.id === c.enemy.id), false); assert.equal(captured.state.units.filter(u => u.team === 'ally' && u.hp > 0).length, 1); assert.equal(captured.state.result, 'victory');
assert.equal(c.b.units.some(u => u.id === c.enemy.id), true); assert.ok(c.b.stock.includes('contract'));
c = combat(); c.enemy.rank = 'elite'; assert.ok(e.resolve(c.b, { type: 'item', itemId: 'contract', targetId: c.enemy.id }).error); c.enemy.rank = 'boss'; assert.ok(e.resolve(c.b, { type: 'item', itemId: 'contract', targetId: c.enemy.id }).error);
c = combat(); c.b.rng = 100000; c.enemy.hp = c.enemy.maxHp; const failed = e.resolve(c.b, { type: 'item', itemId: 'contract', targetId: c.enemy.id }); assert.equal(failed.state.captured.length, 0); assert.equal(failed.state.acted, false); assert.ok(!failed.state.stock.includes('contract'));
assert.ok(e.resolve(c.b, { type: 'retreat' }).error);
c = combat(); c.source.hp -= 35; const healed = e.resolve(c.b, { type: 'item', itemId: 'potion', targetId: c.source.id }); assert.equal(healed.state.units.find(u => u.id === c.source.id).hp, c.source.hp + 30); assert.ok(e.resolve(healed.state, { type: 'item', itemId: 'potion', targetId: c.source.id }).error);
c = combat(); c.source.skills = ['flame-cross']; c.source.mp = 20; c.enemy.hp = c.enemy.maxHp; c.enemy.x = 1; c.enemy.y = 2;
const foe2 = e.clone(c.enemy); foe2.id = 'foe-extra'; foe2.x = 0; foe2.y = 3; c.b.units = [c.source, c.enemy, foe2]; c.b.queue = [c.enemy.id, foe2.id];
const spell = e.skillById('flame-cross'), center = { x: 0, y: 2 };
assert.equal(e.unitAt(c.b, center), undefined); assert.equal(e.affected(c.b, e.areaTarget(c.source, center), spell).length, 2);
assert.equal(e.areaCells({ x: 0, y: 0 }, { ...spell, area: { shape: 'cross', radius: 2 } }).length, 5);
const area = e.resolve(c.b, { type: 'skill', skillId: 'flame-cross', to: center }); assert.equal(area.error, undefined); assert.equal(area.state.units.find(u => u.id === c.source.id).mp, 15); assert.equal(area.events.filter(v => v.type === 'area').length, 1); assert.equal(area.events.filter(v => ['hit', 'miss'].includes(v.type)).length, 2); assert.ok(!area.events.some(v => v.targetId === c.source.id));
assert.ok(e.resolve(c.b, { type: 'skill', skillId: 'arcane-bolt', to: center }).error);
const ten = [...fresh().party, ...e.createEnemies(321, 5).map((u, i) => ({ ...u, id: 'ally-captured-' + i, team: 'ally' }))];
const twenty = e.createEncounter(333, ten, e.createEnemies(444, 10)); assert.equal(twenty.units.length, 20); assert.equal(new Set(twenty.units.map(u => `${u.x},${u.y}`)).size, 20); assert.ok(twenty.units.every(u => !e.blocked(u)));
for (const team of ['ally', 'enemy']) { const front = twenty.units.filter(u => u.team === team && u.y === (team === 'ally' ? 4 : 1)), back = twenty.units.filter(u => u.team === team && u.y !== (team === 'ally' ? 4 : 1)); assert.ok(Math.min(...front.map(u => u.hp)) >= Math.max(...back.map(u => u.hp))); }
assert.deepEqual(e.importSnapshot(e.exportSnapshot(twenty)), twenty);
const timings = [], rounds = [];
for (let i = 1; i <= 20; i++) {
    let b = e.startBattle(e.createEncounter(i, ten, e.createEnemies(i * 29, 10))), commands = 0;
    while (b.phase === 'battle' && commands++ < 2000) { const start = performance.now(), command = e.chooseAI(b); timings.push(performance.now() - start); const result = e.resolve(b, command); assert.equal(result.error, undefined); b = result.state; }
    assert.equal(b.phase, 'over'); rounds.push(b.round); assert.deepEqual(e.importSnapshot(e.exportSnapshot(b)), b);
}
timings.sort((a, b) => a - b);
console.log(JSON.stringify({ routeSeeds: 100, twentyUnitBattles: rounds.length, maxRounds: Math.max(...rounds), aiDecisions: timings.length, aiP95Ms: +timings[Math.floor(timings.length * .95)].toFixed(2), aiMaxMs: +timings.at(-1).toFixed(2) }, null, 2));
// Full runs use real AI, cross-battle resources, camp items, shops and node transitions.
const fullRuns = {};
for (const dungeonId of ['suburban-road','goblin-den']) {
    fullRuns[dungeonId] = {};
    for (const destination of ['extract','boss']) {
        fullRuns[dungeonId][destination] = { won: 0, lost: 0 };
        for (let seed=1;seed<=30;seed++) {
            let run=x.createExpedition(roster.DEFAULT_HERO_IDS,seed,dungeonId), guard=0;
            while(!['won','lost'].includes(run.stage)&&guard++<100) {
                if(run.stage==='route') {
                    for(const member of [...run.party]) {
                        if(member.hp===0&&run.stock.includes('revival-stone'))run=x.useCampItem(run,null,'revival-stone',member.id);
                        let u=run.party.find(t=>t.id===member.id);
                        if(u.hp>0&&u.hp<u.maxHp*.7&&run.stock.includes('potion'))run=x.useCampItem(run,null,'potion',u.id);
                        u=run.party.find(t=>t.id===member.id);
                        if(u.hp>0&&u.mp<u.maxMp*.5&&run.stock.includes('ether'))run=x.useCampItem(run,null,'ether',u.id);
                        u=run.party.find(t=>t.id===member.id);
                        if(u.hp>0&&u.armor<u.maxArmor*.3&&run.stock.includes('repair-kit'))run=x.useCampItem(run,null,'repair-kit',u.id);
                    }
                    const choices=x.availableNodes(run).map(id=>run.nodes.find(n=>n.id===id));
                    const priority=destination==='extract'?['extract','rest','event','battle','shop','elite','boss']:['rest','event','shop','battle','elite','boss','extract'];
                    choices.sort((a,b)=>priority.indexOf(a.kind)-priority.indexOf(b.kind));run=x.enterNode(run,choices[0].id);
                } else if(run.stage==='battle') {
                    let battle=e.startBattle(run.battle),commands=0;
                    while(battle.phase==='battle'&&commands++<2000){const next=e.resolve(battle,e.chooseAI(battle));assert.equal(next.error,undefined);battle=next.state;}
                    assert.equal(battle.phase,'over');run=settleAndLoot(run,battle);
                } else if(run.stage==='node') {
                    const kind=run.nodes.find(n=>n.id===run.current).kind;
                    if(kind==='rest')run=x.resolveNode(run,'rest');
                    else if(kind==='event') {
                        const choices=x.eventChoices(run).filter(c=>!c.disabledReason);
                        const desired=run.party.some(u=>u.hp===0)?['revive','aid','offer']:run.party.some(u=>u.hp<u.maxHp*.7)?['treat','blessing','restore','water','take','supplies']:['scout','intel','supplies','salvage','gather','tools','take','release','outside','surface'];
                        choices.sort((a,b)=>(desired.indexOf(a.choice.id)<0?99:desired.indexOf(a.choice.id))-(desired.indexOf(b.choice.id)<0?99:desired.indexOf(b.choice.id)));
                        assert.ok(choices.length);run=x.resolveEvent(run,choices[0].choice.id);
                    } else {while(run.gold>=20&&run.stock.filter(id=>id==='potion').length<5)run=x.buyItem(run,'potion');run=x.resolveNode(run,'leave');}
                } else if(run.stage==='loot')run=takeLoot(run);
                else if(run.stage==='overcrowded')run=x.dismissRecruit(run,run.party.find(u=>!u.heroId).id);
                else throw Error('Unexpected full run stage '+run.stage);
            }
            assert.ok(['won','lost'].includes(run.stage));fullRuns[dungeonId][destination][run.stage]++;
        }
    }
}
console.log(JSON.stringify({fullRuns},null,2));
console.log('Expedition regression checks passed.');
