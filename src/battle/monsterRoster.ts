import type { SpeciesId } from './progression';
export const MONSTER_ROSTER = {
    goblin_recruit:{name:'哥布林新兵',species:'goblin',boss:false},
    goblin_warrior:{name:'哥布林战士',species:'goblin',boss:false},
    goblin_raider:{name:'哥布林袭击者',species:'goblin',boss:false},
    goblin_chief:{name:'哥布林首领',species:'goblin',boss:true},
    orc_recruit:{name:'兽人新兵',species:'orc',boss:false},
    orc_warrior:{name:'兽人战士',species:'orc',boss:false},
    orc_archer:{name:'兽人弓箭手',species:'orc',boss:false},
    orc_chief:{name:'兽人首领',species:'orc',boss:true}
} as const;
export type MonsterArchetype = keyof typeof MONSTER_ROSTER;
export const MONSTER_ARCHETYPES = Object.keys(MONSTER_ROSTER) as MonsterArchetype[];
export function isMonsterArchetype(value: unknown): value is MonsterArchetype { return typeof value==='string'&&Object.prototype.hasOwnProperty.call(MONSTER_ROSTER,value); }
export function validMonsterArchetype(value: unknown, species: SpeciesId, rank = 'normal'): value is MonsterArchetype {
    return isMonsterArchetype(value)&&MONSTER_ROSTER[value].species===species&&MONSTER_ROSTER[value].boss===(rank==='boss');
}
export function defaultMonsterArchetype(species: SpeciesId, rank: string, role: string, level: number): MonsterArchetype | undefined {
    if(species!=='goblin'&&species!=='orc')return undefined;
    if(rank==='boss')return species==='goblin'?'goblin_chief':'orc_chief';
    if(role==='ranged'||role==='caster')return species==='goblin'?'goblin_raider':'orc_archer';
    if(rank==='elite'||level>=3)return species==='goblin'?'goblin_warrior':'orc_warrior';
    return species==='goblin'?'goblin_recruit':'orc_recruit';
}
