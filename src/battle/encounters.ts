import { MONSTER_ROSTER, defaultMonsterArchetype, validMonsterArchetype } from './monsterRoster';
import { HUMAN_APPEARANCE_NAMES, HUMAN_MELEE_APPEARANCES, HUMAN_RANGED_APPEARANCES, isHumanAppearance } from './raiderArt';
import { Unit, Policy } from './engine';
import { createCharacter, canUseEquipment, EQUIPMENT, setCharacterEquipment } from './progression';
import { EnemyGroup, getEncounter, getHumanEncounter, seededHash } from './dungeonConfig';
const ROLES = {
    melee: { weapon: 'iron-sword', skills: ['heavy-strike','piercing-thrust','aimed-shot'], policy: 'assassin' },
    ranged: { weapon: 'shortbow', skills: ['aimed-shot','piercing-thrust','piercing-ray'], policy: 'damage' },
    caster: { weapon: 'apprentice-staff', skills: ['arcane-bolt','flame-cross','healing'], policy: 'damage' }
} as const;
export function createConfiguredUnit(group: EnemyGroup, seed: number, index: number): Unit {
    if(group.archetype!==undefined&&!validMonsterArchetype(group.archetype,group.species,group.rank))throw new Error('怪物身份与种族或级别不匹配');
    if(group.appearance!==undefined&&(group.species!=='human'||!isHumanAppearance(group.appearance)))throw new Error('人类外观与种族不匹配');
    const archetype=group.archetype||defaultMonsterArchetype(group.species,group.rank,group.role,group.level);
    const role = ROLES[group.role], stats = createCharacter(group.species, seededHash(seed + Math.imul(index + 1, 2654435761)) || 1, group.level, { weapon: 'iron-sword', armor: 'novice-armor' });
    const weapon = canUseEquipment(EQUIPMENT[role.weapon], stats.progression.attributes) ? role.weapon : 'iron-sword';
    setCharacterEquipment(stats, { ...stats.equipment, weapon }, []);
    const name=group.name||(group.appearance?HUMAN_APPEARANCE_NAMES[group.appearance]:archetype?MONSTER_ROSTER[archetype].name:{human:'流浪者',slime:'史莱姆',gremlin:'地精',goblin:'哥布林',orc:'兽人'}[group.species]);
    const unit:Unit={...stats,id:'enemy-'+(index+1),archetype,appearance:group.appearance,name:(group.rank==='elite'?'精英':'')+name,
        team:'enemy',order:index+1,portrait:index%4,x:0,y:0,reaction:true,rank:group.rank,skills:[...role.skills],policy:role.policy as Policy};
    if(group.appearance){
        const armor=(group.rank==='boss'?['heavy-plate','chain-armor','leather-armor']:['chain-armor','leather-armor']).find(id=>canUseEquipment(EQUIPMENT[id],unit.progression.attributes))!;
        const mainWeapon=group.rank==='boss'&&group.role==='melee'&&canUseEquipment(EQUIPMENT.greatsword,unit.progression.attributes)?'greatsword':weapon;
        setCharacterEquipment(unit,{...unit.equipment,armor,weapon:mainWeapon},[group.role==='ranged'?'hunter-mark':group.role==='caster'?'mana-ring':'life-charm']);
        const roll=seededHash(seed+Math.imul(index+1,1103515245));unit.cargo=[group.role==='caster'?'ether':'potion'];unit.carriedGold=8+group.level*3+roll%16;
    }
    unit.hp=unit.maxHp;unit.armor=unit.maxArmor;unit.mp=unit.maxMp;return unit;
}
export function createPresetEnemies(id: string, seed: number): Unit[] {
    const units: Unit[] = [];
    for (const group of getEncounter(id).groups) for (let i = 0; i < group.count; i++) units.push(createConfiguredUnit(group, seed, units.length));
    return units;
}

export function createAdaptiveHumans(id:string,seed:number,party:readonly Unit[]):Unit[]{
    const config=getHumanEncounter(id),average=Math.round(party.reduce((n,u)=>n+u.progression.level,0)/Math.max(1,party.length));
    return Array.from({length:config.count},(_,i)=>{
        const roll=seededHash(seed+Math.imul(i+1,1103515245)),level=Math.min(20,Math.max(1,average+(roll%5)-2));
        const role=(['melee','ranged','caster'] as const)[i%3];
        const u=createConfiguredUnit({species:'human',count:1,level,rank:'normal',role},seed,i);
        const armor=canUseEquipment(EQUIPMENT['chain-armor'],u.progression.attributes)?'chain-armor':'leather-armor';
        const artifact=role==='caster'?'mana-ring':role==='ranged'?'hunter-mark':'life-charm';
        setCharacterEquipment(u,{...u.equipment,armor},[artifact]);u.hp=u.maxHp;u.mp=u.maxMp;u.armor=u.maxArmor;
        u.name=role==='caster'?'流浪术士':role==='ranged'?'盗匪弓手':'拦路佣兵';
        if(role!=='caster'){const pool=role==='ranged'?HUMAN_RANGED_APPEARANCES:HUMAN_MELEE_APPEARANCES;u.appearance=pool[seededHash(roll+7717)%pool.length];u.name=HUMAN_APPEARANCE_NAMES[u.appearance];}
        u.cargo=[i%2?'ether':'potion',...(roll%3===0?['contract']:[])];u.carriedGold=8+level*3+roll%16;return u;
    });
}
