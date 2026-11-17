import type { Unit } from './engine';
import type { SpeciesId } from './progression';
import { MonsterArchetype, defaultMonsterArchetype } from './monsterRoster';
import type { HumanAppearance } from './raiderArt';
import { HERO_PRESETS, HeroArtId } from './roster';
export type ArtId = SpeciesId | HeroArtId | 'elf_archer' | 'goblin_chief' | HumanAppearance | MonsterArchetype;

export const ART_POSES = ['idle', 'portrait', 'melee', 'ranged', 'broken'] as const;
export type ArtPose = typeof ART_POSES[number];
export const ART_SPECIES: SpeciesId[] = ['human', 'slime', 'gremlin', 'goblin'];
const images = import.meta.glob('../../image/roster_5x4_grid/{human,slime,gremlin,goblin}_{idle,portrait,melee,ranged,broken}.png', {
    eager: true, query: '?url', import: 'default'
}) as Record<string, string>;

const heroImages = import.meta.glob('../../image/roster_heroes/*_{idle,portrait,melee,ranged,broken}.png', {
    eager: true, query: '?url', import: 'default'
}) as Record<string, string>;

const monsterImages = import.meta.glob('../../image/roster_monsters/*_{idle,portrait,melee,ranged,broken}.webp', { eager: true, query: '?url', import: 'default' }) as Record<string,string>;
const womenImages = import.meta.glob('../../image/roster_bandit_women/*_{idle,portrait,melee,ranged,broken}.webp', { eager: true, query: '?url', import: 'default' }) as Record<string,string>;
const raiderImages = import.meta.glob('../../image/roster_raiders/*_{idle,portrait,melee,ranged,broken}.webp', { eager: true, query: '?url', import: 'default' }) as Record<string,string>;

export function imageUrl(species: ArtId, pose: ArtPose): string {
    const resolved=species==='orc'?'orc_recruit':species;
    const url = womenImages[`../../image/roster_bandit_women/${species}_${pose}.webp`] || monsterImages[`../../image/roster_monsters/${resolved}_${pose}.webp`] || raiderImages[`../../image/roster_raiders/${species}_${pose}.webp`] || heroImages[`../../image/roster_heroes/${species}_${pose}.png`] || images[`../../image/roster_5x4_grid/${species}_${pose}.png`];
    if (!url) throw new Error(`Missing character image: ${species}_${pose}.png`);
    return url;
}
export function artPose(unit: Unit, requested: ArtPose = 'idle'): ArtPose {
    // No damaged attack frames yet: retain broken art rather than flash intact armor.
    return requested !== 'portrait' && unit.maxArmor > 0 && unit.armor === 0 ? 'broken' : requested;
}
export function textureKey(unit: Unit, requested: ArtPose = 'idle'): string {
    return `character-${unitArtId(unit)}-${artPose(unit, requested)}`;
}
export function unitArtId(unit: Unit): ArtId {
    return unit.heroId ? HERO_PRESETS[unit.heroId].art : unit.progression.species==='human'&&unit.appearance ? unit.appearance : unit.archetype || defaultMonsterArchetype(unit.progression.species,unit.rank||'normal','melee',unit.progression.level) || unit.progression.species;
}
export function characterImage(unit: Unit, requested: ArtPose = 'portrait'): string {
    return imageUrl(unitArtId(unit), artPose(unit, requested));
}
