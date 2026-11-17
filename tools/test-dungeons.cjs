const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const takeLoot=run=>require('./loot-test-helper.cjs')(x,run);
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,f);
const c=require('../src/battle/dungeonConfig.ts'),x=require('../src/battle/expedition.ts'),e=require('../src/battle/engine.ts'),f=require('../src/battle/encounters.ts'),p=require('../src/battle/progression.ts'),r=require('../src/battle/roster.ts'),b=require('../src/battle/base.ts');
const settleAndLoot=(r,b)=>{const next=x.settleBattle(r,b);return next.stage==='loot'?takeLoot(next):next;};
const report={dungeons:[],encounters:c.ENCOUNTERS.length,eventDefinitions:c.EVENTS.length,eventChoicePaths:0,riskOutcomes:{}};
assert.equal(c.DUNGEONS.length,3);assert.equal(c.getDungeon('suburban-road').name,'城郊大道');assert.equal(c.getDungeon('goblin-den').name,'哥布林巢穴');
assert.throws(()=>c.getDungeon('missing'));c.validateDungeonData();
for(const d of c.DUNGEONS){
 const eventHits=new Set(),encounterHits=new Set();let paths=0;
 for(let seed=1;seed<=300;seed++){
  const nodes=x.generateRoute(seed,d.id);assert.deepEqual(nodes,x.generateRoute(seed,d.id));assert.equal(nodes.length,d.layers.flat().length);assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length);
  const reached=new Set(nodes.filter(n=>n.depth===0).map(n=>n.id));
  for(const n of nodes){assert.ok(reached.has(n.id),'Unreachable '+n.id);if(!['boss','extract'].includes(n.kind))assert.ok(n.next.length);for(const nextId of n.next){const next=nodes.find(t=>t.id===nextId);assert.equal(next.depth,n.depth+1);reached.add(nextId);}if(n.kind==='event'){eventHits.add(n.eventId);assert.ok(d.eventPool.includes(n.eventId));}if(n.kind==='human'){assert.ok(c.getHumanEncounter(n.encounterId));}else if(n.encounterId){encounterHits.add(n.encounterId);assert.ok(d.encounterPool.includes(n.encounterId));const def=c.getEncounter(n.encounterId);assert.equal(def.kind,n.kind);const phase=d.phases.find(v=>n.depth>=v.from&&n.depth<=v.to);assert.ok(phase.strength[n.kind].includes(def.strength));}}
  for(const depth of new Set(nodes.map(n=>n.depth))){const same=nodes.filter(n=>n.depth===depth&&n.encounterId).map(n=>n.encounterId);assert.equal(new Set(same).size,same.length,'Same-layer encounter should differ');}
  const ids=nodes.filter(n=>n.kind==='event').map(n=>n.eventId);assert.equal(new Set(ids).size,ids.length,'Repeated event in route');
  const minFights=n=>(['battle','elite','boss','human'].includes(n.kind)?1:0)+(['boss','extract'].includes(n.kind)?0:Math.min(...n.next.map(id=>minFights(nodes.find(v=>v.id===id)))));if(d.id==='goblin-den'){const copy=nodes.map(n=>({...n,next:n.next.filter(id=>nodes.find(v=>v.id===id).kind!=='extract')}));const minBoss=n=>(['battle','elite','boss','human'].includes(n.kind)?1:0)+(n.kind==='boss'?0:Math.min(...n.next.map(id=>minBoss(copy.find(v=>v.id===id)))));assert.ok(minBoss(copy[0])>=4,'Den boss route needs combat progression');}
  assert.ok(minFights(nodes[0])>=1);const countPaths=n=>['boss','extract'].includes(n.kind)?1:n.next.reduce((n,id)=>n+countPaths(nodes.find(v=>v.id===id)),0);paths=Math.max(paths,countPaths(nodes[0]));
 }
 assert.equal(eventHits.size,d.eventPool.length);assert.equal(encounterHits.size,d.encounterPool.length);
 report.dungeons.push({id:d.id,layers:d.layers.length,totalNodes:d.layers.flat().length,maxPaths:paths,eventsSampled:eventHits.size,presetsSampled:encounterHits.size,seeds:300});
}
assert.ok(report.dungeons[0].totalNodes<report.dungeons[1].totalNodes);assert.ok(report.dungeons[0].layers<report.dungeons[1].layers);
for(const cfg of c.ENCOUNTERS){
 const units=f.createPresetEnemies(cfg.id,888);assert.deepEqual(units,f.createPresetEnemies(cfg.id,888));assert.equal(units.length,cfg.groups.reduce((n,g)=>n+g.count,0));assert.ok(units.length<=10);assert.equal(new Set(units.map(u=>u.id)).size,units.length);
 let offset=0;for(const g of cfg.groups)for(let i=0;i<g.count;i++){const u=units[offset++];assert.equal(u.progression.species,g.species);assert.equal(u.progression.level,g.level);assert.equal(u.rank,g.rank);assert.ok(p.validProgression(u.progression));assert.ok(p.validEquipment(u.equipment,u.artifacts));assert.equal(u.hp,u.maxHp);assert.equal(u.mp,u.maxMp);assert.equal(u.armor,u.maxArmor);}
 if(cfg.kind==='elite'){assert.ok(units.some(u=>u.rank==='elite'));assert.ok(units.some(u=>u.rank==='normal'));}
 const battle=e.createEncounter(999,e.createBattle().units.filter(u=>u.team==='ally'),units);assert.deepEqual(e.importSnapshot(e.exportSnapshot(battle)),battle);
}
const invalid=c.ENCOUNTERS.find(v=>v.kind==='elite'),group=invalid.groups.find(g=>g.rank==='normal'),oldRank=group.rank;group.rank='elite';assert.throws(()=>c.validateDungeonData());group.rank=oldRank;c.validateDungeonData();
function eventRun(id,seed=123){const def=c.getEvent(id),run=x.createExpedition(r.DEFAULT_HERO_IDS,seed,id.startsWith('smuggler')?'goblin-den':'suburban-road'),node=run.nodes.find(n=>n.kind==='event');node.eventId=id;run.current=node.id;run.stage='node';run.event={nodeId:node.id,id,stage:def.start};return run;}
for(const def of c.EVENTS){
 const walk=(run,depth=0)=>{assert.ok(depth<5);const options=x.eventChoices(run);assert.ok(options.length);assert.ok(options.some(o=>!o.disabledReason),'Event must have an exit: '+def.id);
  for(const{choice,disabledReason}of options){const before=JSON.stringify(run);if(disabledReason){assert.throws(()=>x.resolveEvent(run,choice.id));assert.equal(JSON.stringify(run),before);continue;}
   const next=x.resolveEvent(run,choice.id);assert.equal(JSON.stringify(run),before);report.eventChoicePaths++;
   if(choice.nextStage){assert.equal(next.stage,'node');assert.equal(next.eventHistory.length,run.eventHistory.length);walk(next,depth+1);}else{assert.ok(['route','battle','loot'].includes(next.stage));assert.equal(next.eventHistory.length,run.eventHistory.length+1);assert.throws(()=>x.resolveEvent(next,choice.id));}
  }
 };const run=eventRun(def.id);run.party[0].hp=0;run.party[1].hp=Math.max(1,run.party[1].hp-20);run.party[1].armor=0;walk(run);
}
let run=eventRun('herbalist');assert.ok(x.eventChoices(run).find(v=>v.choice.id==='treat').disabledReason.includes('已满'));run.party[0].hp-=20;run.gold=0;const before=JSON.stringify(run);assert.throws(()=>x.resolveEvent(run,'treat'),/金币不足/);assert.equal(JSON.stringify(run),before);
run=eventRun('overturned-cart');run.stock=run.stock.filter(id=>id!=='repair-kit');assert.throws(()=>x.resolveEvent(run,'repair'),/缺少/);run.stock.push('repair-kit');const repair=x.resolveEvent(run,'repair');assert.equal(repair.stock.includes('repair-kit'),false);assert.equal(repair.gold,run.gold+40);assert.ok(repair.stock.includes('potion'));
run=eventRun('contract-wanderer');const recruits=x.resolveEvent(run,'recruit');assert.equal(recruits.party.length,6);assert.equal(recruits.party.at(-1).rank,'normal');assert.equal(recruits.party.at(-1).progression.level,1);assert.equal(recruits.party.at(-1).team,'ally');assert.equal(recruits.party.at(-1).heroId,undefined);assert.equal(recruits.stock.filter(id=>id==='contract').length,run.stock.filter(id=>id==='contract').length-1);
const full=e.clone(run);while(full.party.length<10)full.party.push({...e.clone(full.party[0]),heroId:undefined,id:'fill-'+full.party.length});const fullBefore=JSON.stringify(full);assert.throws(()=>x.resolveEvent(full,'recruit'),/队伍已满/);assert.equal(JSON.stringify(full),fullBefore);
run=eventRun('injured-scout');run.party[0].hp=0;let revived=x.resolveEvent(run,'revive');assert.equal(revived.party[0].hp,Math.ceil(run.party[0].maxHp*.4));assert.equal(revived.party[0].armor,0);
const scout=x.resolveEvent(eventRun('injured-scout'),'scout');assert.equal(scout.nextEnemyHp,.85);const restNode=scout.nodes.find(n=>n.kind==='rest');scout.current=restNode.id;scout.stage='node';const rested=x.resolveNode(scout,'rest');assert.equal(rested.nextEnemyHp,.85);
const combatNode=rested.nodes.find(n=>['battle','human'].includes(n.kind)&&n.depth>0);rested.current=rested.nodes.find(n=>n.next.includes(combatNode.id)).id;rested.stage='route';const scouted=x.enterNode(rested,combatNode.id);assert.equal(scouted.nextEnemyHp,1);assert.ok(scouted.battle.units.filter(u=>u.team==='enemy').every(u=>u.hp===Math.ceil(u.maxHp*.85)));
run=eventRun('mushroom-grotto');run.party[0].hp=1;run.party[1].hp=0;const mist=x.resolveEvent(run,'inhale');assert.equal(mist.party[0].hp,1);assert.equal(mist.party[1].hp,0);
for(const[eventId,inspect,choice]of [['abandoned-cache','inspect','open'],['smuggler-cache','inspect','force']]){
 const counts={safe:0,ambush:0};for(let seed=1;seed<=300;seed++){let initial=eventRun(eventId,seed);initial=x.resolveEvent(initial,inspect);assert.equal(initial.stage,'node');const a=x.resolveEvent(initial,choice),b=x.resolveEvent(initial,choice);assert.deepEqual(a,b,'Risk cannot reroll');if(a.stage==='battle'){counts.ambush++;assert.equal(a.nodes.find(n=>n.id===a.current).kind,'event');const battle=e.clone(a.battle);battle.phase='over';battle.result='victory';battle.units.filter(u=>u.team==='enemy').forEach(u=>u.hp=0);const settled=settleAndLoot(a,battle);assert.equal(settled.stage,'route');assert.throws(()=>x.resolveEvent(settled,choice));}else counts.safe++;}
 assert.ok(counts.safe>0&&counts.ambush>0);report.riskOutcomes[eventId]=counts;
}
const configured=b.createBase(1),runDen=b.prepareExpedition(configured,r.DEFAULT_HERO_IDS,2,'goblin-den');assert.equal(runDen.dungeonId,'goblin-den');assert.equal(runDen.nodes.length,23);assert.deepEqual(runDen.stock,configured.stock);
for(const dungeon of c.DUNGEONS){const start=x.createExpedition(r.DEFAULT_HERO_IDS,5,dungeon.id),boss=start.nodes.find(n=>n.kind==='boss');start.current=start.nodes.find(n=>n.next.includes(boss.id)).id;let battleRun=x.enterNode(start,boss.id);const end=e.clone(battleRun.battle);end.phase='over';end.result='victory';end.units.filter(u=>u.team==='enemy').forEach(u=>u.hp=0);end.captured=[...Array.from({length:6},(_,i)=>({...e.clone(end.units.find(u=>u.team==='enemy')),id:'capture-'+i,rank:'normal',hp:1}))];let settled=settleAndLoot(battleRun,end);assert.equal(settled.stage,'overcrowded');settled=x.dismissRecruit(settled,settled.party.find(u=>!u.heroId).id);settled=takeLoot(settled);assert.equal(settled.stage,'won');}
console.log(JSON.stringify(report,null,2));console.log('Dual dungeon, JSON presets and branching event checks passed.');
