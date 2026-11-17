import type { Battle, Unit } from './engine';
import { seededHash } from './dungeonConfig';
export interface BattleSpoils { items: string[]; gold: number; defeated: number }
export function enemySpoils(enemy: Unit, seed: number): BattleSpoils {
    const hash=seededHash(seed+enemy.order*7919),types=['vital','martial','arcane'];
    const essence=types[enemy.progression.species==='slime'?0:enemy.spellPower>enemy.attack?2:1];
    const items:string[]=[];let gold=0;
    if(enemy.rank==='boss') {
        items.push('pure-'+types[hash%types.length]+'-essence',...types.map(id=>'refined-'+id+'-essence'),'chief-trophy','chief-trophy','salvaged-trinket');
    }else{
        const count=enemy.rank==='elite'?2:1;for(let i=0;i<count;i++)items.push(essence+'-essence');
        items.push(hash%3===0?'salvaged-trinket':'worn-remains');if(enemy.rank==='elite')items.push('salvaged-trinket');
    }
    if(enemy.progression.species==='human') {
        items.push(...[enemy.equipment.weapon,enemy.equipment.armor,enemy.equipment.backpack||'travel-bag'].filter((id):id is string=>!!id),...enemy.artifacts,...(enemy.cargo||[]));
        gold=enemy.carriedGold||0;
    }
    return {items,gold,defeated:1};
}
export function battleSpoils(battle: Battle): BattleSpoils {
    const total:BattleSpoils={items:[],gold:0,defeated:0};
    if(battle.result!=='victory')return total;
    for(const u of battle.units.filter(u=>u.team==='enemy'&&u.hp<=0)){const loot=enemySpoils(u,battle.seed);total.items.push(...loot.items);total.gold+=loot.gold;total.defeated++;}
    return total;
}
