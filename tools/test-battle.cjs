const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Compile the pure rules modules in this process without emitting files.
require.extensions['.ts'] = (module, filename) => {
    module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
    }).outputText, filename);
};
const p = require('../src/battle/progression.ts');
const e = require('../src/battle/engine.ts');
const roster = require('../src/battle/roster.ts');
const inventory = require('../src/battle/inventory.ts');
const detailsView = require('../src/ui/CharacterDetails.ts');
const zero = { weapon: null, armor: null };
const five = Object.fromEntries(p.PRIMARY_STATS.map(s => [s.key, 5]));
const bagState = { attributes: { ...five }, equipment: { ...zero }, artifacts: [], items: Object.values(p.EQUIPMENT), editable: true };
assert.equal(inventory.moveInventoryItem(bagState, 'iron-sword', 'weapon').equipment.weapon, 'iron-sword');
assert.equal(bagState.equipment.weapon, null);
assert.equal(inventory.moveInventoryItem(bagState, 'iron-sword', 'armor').changed, false);
assert.ok(inventory.moveInventoryItem(bagState, 'iron-sword', 'armor').error);
assert.ok(inventory.moveInventoryItem(bagState, 'heavy-plate', 'armor').error.includes('体质'));
assert.equal(inventory.moveInventoryItem(bagState, 'novice-armor', 'armor').equipment.armor, 'novice-armor');
assert.ok(inventory.moveInventoryItem(bagState, 'iron-sword', 'bag').error);
assert.ok(inventory.moveInventoryItem(bagState, 'not-an-item', 'weapon').error);
assert.ok(inventory.moveInventoryItem({ ...bagState, editable: false }, 'iron-sword', 'weapon').error);
const carriedCore = inventory.moveInventoryItem(bagState, 'arcane-core', 'bag');
assert.deepEqual(carriedCore.artifacts, ['arcane-core']);
assert.equal(inventory.moveInventoryItem({ ...bagState, artifacts: carriedCore.artifacts }, 'arcane-core', 'bag').changed, false);
assert.deepEqual(inventory.moveInventoryItem({ ...bagState, artifacts: carriedCore.artifacts }, 'arcane-core', 'stock').artifacts, []);
const worn = { ...bagState, attributes: { ...five, strength: 12 }, equipment: { weapon: 'iron-sword', armor: null } };
assert.equal(inventory.moveInventoryItem(worn, 'war-mace', 'weapon').equipment.weapon, 'war-mace');
assert.equal(inventory.moveInventoryItem(worn, 'iron-sword', 'stock').equipment.weapon, null);
assert.equal(inventory.moveInventoryItem(bagState, 'iron-sword', 'stock').changed, false);
const custom = { ...bagState, items: [{ id: 'custom-armor', name: 'Test Armor', slot: 'armor', armor: 20 }] };
assert.equal(inventory.moveInventoryItem(custom, 'custom-armor', 'armor').equipment.armor, 'custom-armor');
for (const id of ['song-ge', 'alan', 'zhang', 'ayang', 'mu']) assert.ok(!roster.HERO_PRESETS[id].skills.includes('healing'));
assert.equal(roster.HERO_PRESETS.mu.name, '铁卫肯子');
for (const id of ['song-ge', 'mu']) assert.equal(roster.HERO_PRESETS[id].equipment.armor, 'novice-armor');
assert.equal(p.EQUIPMENT['novice-armor'].armor, 20);
assert.equal(p.EQUIPMENT['novice-armor'].requirements, undefined);
assert.deepEqual(Object.fromEntries(['common', 'rare', 'excellent'].map(tier =>
    [tier, p.TRAITS.filter(t => t.tier === tier).length])), { common: 20, rare: 15, excellent: 10 });
for (const t of p.TRAITS) for (const id of t.excludes || []) {
    assert.ok(p.TRAITS_BY_ID[id], `Unknown conflict: ${t.id} -> ${id}`);
}

let prefixes = 0;
function checkPools(chosen, index = 0) {
    prefixes++;
    for (const tier of ['common', 'rare', 'excellent']) {
        assert.ok(p.TRAITS.some(t => t.tier === tier && p.traitCompatible(t, chosen)),
            `Empty ${tier} pool after ${chosen.map(t => t.id).join(',')}`);
    }
    if (chosen.length === 3) return;
    for (let i = index; i < p.TRAITS.length; i++) {
        if (p.traitCompatible(p.TRAITS[i], chosen)) checkPools([...chosen, p.TRAITS[i]], i + 1);
    }
}
checkPools([]);
const counts = { 2: 0, 3: 0, 4: 0 }, tiers = { common: 0, rare: 0, excellent: 0 };
let seed = 912347, draws = 0;
const samples = 50000;
for (let n = 0; n < samples; n++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const species = ['human', 'slime', 'gremlin', 'goblin'][n % 4];
    const g = p.generateProgression(species, seed >>> 0);
    assert.ok(p.validProgression(g));
    counts[g.traits.length]++;
    for (const id of g.traits) { tiers[p.TRAITS_BY_ID[id].tier]++; draws++; }
    for (const stat of p.PRIMARY_STATS) {
        const expected = Math.max(1, 5 + (p.SPECIES[species].modifiers[stat.key] || 0)
            + g.traits.reduce((sum, id) => sum + (p.TRAITS_BY_ID[id].modifiers[stat.key] || 0), 0));
        assert.equal(g.attributes[stat.key], expected);
    }
    if (n < 40) assert.deepEqual(g, p.generateProgression(species, seed >>> 0));
}
for (const [count, probability] of [[2, .3], [3, .5], [4, .2]]) assert.ok(Math.abs(counts[count] / samples - probability) < .012);
for (const [tier, probability] of [['common', .7], ['rare', .25], ['excellent', .05]]) assert.ok(Math.abs(tiers[tier] / draws - probability) < .012);
assert.equal(p.SPECIES.slime.modifiers.constitution || 0, 0);
assert.equal(p.SPECIES.gremlin.modifiers.constitution, -5);
assert.equal(p.deriveNakedStats(five).maxHp, 45);
assert.equal(p.deriveNakedStats({ ...five, constitution: 100 }).maxArmor, 0);
for (const item of Object.values(p.EQUIPMENT)) {
    assert.ok(Number.isInteger(p.itemValue(item)));
    if (item.slot === 'armor') assert.ok(item.armor >= 20);
    for (const stat of p.PRIMARY_STATS) assert.ok(!(stat.key in item));
}
assert.equal(p.itemValue(p.EQUIPMENT['iron-sword']), 5);
assert.equal(p.validEquipment({ weapon: 'cloth-armor', armor: null }, []), false);
assert.equal(p.validEquipment(zero, ['iron-sword']), false);
assert.equal(p.validEquipment(zero, ['life-charm', 'life-charm']), false);
assert.equal(p.validEquipment(zero, ['toString']), false);
assert.equal(p.validEquipment(zero, []), true);
const badTraits = e.clone(p.generateProgression('human', 82451));
badTraits.traits = ['toString', 'strong'];
assert.equal(p.validProgression(badTraits), false);
const eligible = { ...five, intelligence: 15, constitution: 8 };
assert.deepEqual(p.deriveStats(eligible, zero, ['arcane-core', 'arcane-core']), p.deriveStats(eligible, zero, ['arcane-core']));
assert.deepEqual(p.deriveStats(five, zero, ['arcane-core']), p.deriveNakedStats(five));
assert.equal(p.canUseEquipment(p.EQUIPMENT['arcane-core'], { ...five, intelligence: 14 }), false);
const growing = p.createCharacter('human', 82451, 1);
growing.progression.attributes.intelligence = 14;
assert.ok(p.setCharacterEquipment(growing, zero, ['arcane-core']));
assert.equal(growing.spellPower, 21);
p.levelUp(growing);
assert.ok(growing.progression.attributes.intelligence >= 15);
assert.equal(growing.spellPower, 7 + growing.progression.attributes.intelligence + 10);
assert.ok(!p.setCharacterEquipment(growing, { weapon: null, armor: 'giant-plate' }, growing.artifacts));
const b = e.createBattle();
assert.deepEqual(b, e.importSnapshot(e.exportSnapshot(b)));
for (const u of b.units) {
    assert.ok(u.maxArmor >= 20);
    assert.deepEqual(p.deriveStats(u.progression.attributes, u.equipment, u.artifacts),
        Object.fromEntries(Object.keys(p.deriveNakedStats(five)).map(k => [k, u[k]])));
    assert.equal(p.equipmentValue(u), p.estimatedPower(u) - p.nakedPower(u));
}
const u = b.units[0];
const detailsHtml = detailsView.renderCharacterDetails(u, { editable: true, portraitUrl: '/test.png', skillsHtml: '' });
assert.ok(detailsHtml.includes('人物特性') && detailsHtml.includes('裸属性'));
assert.ok(!detailsHtml.includes('data-dropzone') && !detailsHtml.includes('data-item-id') && !detailsHtml.includes('<select'));
const changed = e.configureEquipment(b, u.id, zero, []);
assert.equal(changed.units[0].maxArmor, 0);
assert.equal(changed.units[0].hp, changed.units[0].maxHp);
assert.ok(changed.revision > b.revision);
assert.notEqual(b.units[0].maxArmor, 0);
assert.deepEqual(changed, e.importSnapshot(e.exportSnapshot(changed)));
assert.strictEqual(e.configureEquipment(b, b.units.find(t => t.team === 'enemy').id, zero, []), b);
const fighting = e.startBattle(b);
assert.strictEqual(e.configureEquipment(fighting, u.id, zero, []), fighting);
const fake = e.clone(b); fake.units[0].artifacts.push('invalid');
assert.throws(() => e.importSnapshot(e.exportSnapshot(fake)));
const duplicate = e.clone(b); duplicate.units[0].artifacts.push(duplicate.units[0].artifacts[0]);
assert.throws(() => e.importSnapshot(e.exportSnapshot(duplicate)));
const old = JSON.parse(e.exportSnapshot(b)); old.rules = 'demo-3';
assert.throws(() => e.importSnapshot(JSON.stringify(old)));
old.rules = 'demo-4';
assert.throws(() => e.importSnapshot(JSON.stringify(old)));
old.rules = 'demo-5';
assert.throws(() => e.importSnapshot(JSON.stringify(old)));
assert.equal(JSON.parse(e.exportSnapshot(b)).rules, 'team-stock-2');
assert.equal(roster.HERO_IDS.length, 10);
assert.equal(new Set(roster.HERO_IDS.map(id => roster.HERO_PRESETS[id].art)).size, 10);
assert.equal(roster.HERO_PRESETS.alan.gender, 'male');
assert.deepEqual(roster.DEFAULT_HERO_IDS.map(id => roster.HERO_PRESETS[id].name), ['仗义宋哥', '游侠阿兰', '冒险者小张', '参谋阿阳', '铁卫肯子']);
for (const id of roster.HERO_IDS) {
    const hero = roster.createHero(id), preset = roster.HERO_PRESETS[id];
    assert.ok(p.validProgression(hero.progression));
    assert.ok(p.validEquipment(hero.equipment, hero.artifacts));
    for (const item of [hero.equipment.weapon, hero.equipment.armor, ...hero.artifacts]) assert.ok(p.canUseEquipment(p.EQUIPMENT[item], hero.progression.attributes));
    assert.equal(p.estimatedPower(hero), p.estimatedPower(e.createBattle(undefined, [id, ...roster.HERO_IDS.filter(x => x !== id).slice(0, 4)]).units[0]));
    assert.equal(new Set(preset.skills).size, 3);
    assert.ok(preset.skills.every(skill => e.EQUIPPABLE.some(s => s.id === skill)));
    for (const pose of ['idle', 'portrait', 'melee', 'ranged', 'broken']) {
        const png = fs.readFileSync(`image/roster_heroes/${preset.art}_${pose}.png`);
        assert.equal(png.subarray(1, 4).toString(), 'PNG');
        assert.equal(png.readUInt32BE(16), 256);
        assert.equal(png.readUInt32BE(20), 256);
        assert.equal(png[25], 6);
    }
}
const manifest = JSON.parse(fs.readFileSync('image/roster_heroes/manifest.json', 'utf8'));
assert.equal(manifest.sprites.length, 40);
assert.ok(manifest.sprites.every(s => s.alpha_bounds && s.size[0] === 256 && s.size[1] === 256));
for (const [file, hash] of Object.entries(manifest.sources)) assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex'), hash);
let partyCombinations = 0;
for (let mask = 0; mask < (1 << roster.HERO_IDS.length); mask++) {
    const ids = roster.HERO_IDS.filter((_, i) => mask & (1 << i)); if (ids.length !== 5) continue;
    const party = e.createBattle(20261016, ids);
    assert.deepEqual(party.units.filter(x => x.team === 'ally').map(x => x.heroId), ids);
    assert.deepEqual(party, e.importSnapshot(e.exportSnapshot(party))); partyCombinations++;
}
assert.equal(partyCombinations, 252);
assert.throws(() => e.createBattle(undefined, ['alan', 'alan', 'zhang', 'ayang']));
assert.throws(() => e.createBattle(undefined, ['alan']));
assert.throws(() => e.createBattle(undefined, ['alan', 'zhang', 'ayang', 'toString']));
const wrongHero = e.clone(b); wrongHero.units[0].heroId = 'invalid';
assert.throws(() => e.importSnapshot(e.exportSnapshot(wrongHero)));
const duplicateHero = e.clone(b); duplicateHero.units[0].heroId = duplicateHero.units[2].heroId;
assert.throws(() => e.importSnapshot(e.exportSnapshot(duplicateHero)));
const shooter = { ...u, x: 0, y: 0, rangedHit: 80, meleeHit: 80, team: 'ally' };
const shotTarget = { ...u, x: 0, y: 2, evasion: 10, hp: u.maxHp, mp: u.maxMp, team: 'enemy' };
const farther = { ...shotTarget, y: 3 }, adjacent = { ...shotTarget, y: 1 };
assert.equal(e.shootingHitBonus(shooter, shotTarget, e.skillById('ranged')), 10);
assert.equal(e.shootingHitBonus(shooter, farther, e.skillById('ranged')), 0);
assert.equal(e.shootingHitBonus(shooter, adjacent, e.skillById('ranged')), 0);
assert.equal(e.validTarget(b, shooter, adjacent, e.skillById('ranged')), false);
assert.equal(e.hitChance(shooter, shotTarget, e.skillById('ranged')), .8);
assert.equal(e.hitChance(shooter, farther, e.skillById('ranged')), .7);
assert.equal(e.hitChance(shooter, shotTarget, e.skillById('aimed-shot')), .9);
assert.equal(e.hitChance(shooter, farther, e.skillById('aimed-shot')), .8);
for (const id of ['arcane-bolt', 'flame-cross', 'piercing-ray', 'melee', 'healing']) {
    const skill = e.skillById(id);
    assert.equal(e.shootingHitBonus(shooter, shotTarget, skill), 0);
    assert.equal(e.hitChance(shooter, shotTarget, skill), e.hitChance(shooter, farther, skill));
}
assert.equal(e.hitChance({ ...shooter, rangedHit: 200 }, shotTarget, e.skillById('ranged')), .95);
assert.equal(e.hitChance({ ...shooter, rangedHit: 0 }, shotTarget, e.skillById('ranged')), .2);
const closeShotState = e.clone(b);
closeShotState.phase = 'battle'; closeShotState.activeId = u.id;
closeShotState.rng = 12345; closeShotState.draws = 0;
closeShotState.units.forEach(x => { x.hp = 0; });
Object.assign(closeShotState.units[0], shooter, { hp: u.maxHp });
Object.assign(closeShotState.units[1], shotTarget, { id: 'enemy-1' });
closeShotState.queue = ['enemy-1'];
const farShotState = e.clone(closeShotState); farShotState.units[1].y = 3;
const drawCount = closeShotState.draws;
e.hitChance(closeShotState.units[0], closeShotState.units[1], e.skillById('ranged'));
assert.equal(closeShotState.draws, drawCount);
const closeShot = e.resolve(closeShotState, { type: 'skill', skillId: 'ranged', targetId: 'enemy-1' });
const farShot = e.resolve(farShotState, { type: 'skill', skillId: 'ranged', targetId: 'enemy-1' });
assert.equal(closeShot.error, undefined); assert.equal(farShot.error, undefined);
assert.ok(closeShot.events.some(x => x.type === 'hit'));
assert.ok(farShot.events.some(x => x.type === 'miss'));
assert.equal(e.skillById('armor-repair'), undefined);
assert.equal(e.power({ ...u, attack: 17 }, e.skillById('melee')), 19);
assert.equal(e.power({ ...u, spellPower: 17 }, e.skillById('healing')), 8);
assert.equal(e.skillById('healing').mp, 5);
const healingState = e.clone(fighting), healer = e.activeUnit(healingState);
healer.skills = ['healing']; healer.hp -= 20; healer.mp = 10; healer.armor -= 3;
const healed = e.resolve(healingState, { type: 'skill', skillId: 'healing', targetId: healer.id });
assert.equal(healed.error, undefined);
const afterHeal = healed.state.units.find(x => x.id === healer.id);
assert.equal(afterHeal.hp - healer.hp, e.power(healer, e.skillById('healing')));
assert.equal(afterHeal.armor, healer.armor);
assert.equal(afterHeal.mp, 5);
assert.ok(healed.state.logs.at(-1).includes('：HP+'));
assert.deepEqual(e.losses({ hp: 100, armor: 100 }, 19), { hp: 4, armor: 15 });
assert.deepEqual(e.losses({ hp: 100, armor: 100 }, 19, true), { hp: 19, armor: 0 });
const rounds = [];
for (let i = 1; i <= 60; i++) {
    let battle = e.startBattle(e.createBattle(Math.imul(i, 2654435761) >>> 0));
    let commands = 0;
    while (battle.phase === 'battle' && commands++ < 2000) {
        const result = e.resolve(battle, e.chooseAI(battle));
        assert.equal(result.error, undefined);
        battle = result.state;
    }
    assert.equal(battle.phase, 'over', `Battle did not end: ${i}`);
    assert.deepEqual(battle, e.importSnapshot(e.exportSnapshot(battle)));
    rounds.push(battle.round);
}
console.log(JSON.stringify({ samples, counts, tiers, draws, checkedCompatiblePrefixes: prefixes,
    partyCombinations, autoBattles: rounds.length, meanRounds: rounds.reduce((a, b) => a + b) / rounds.length,
    minRounds: Math.min(...rounds), maxRounds: Math.max(...rounds) }, null, 2));
console.log('Battle regression checks passed.');
