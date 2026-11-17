const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,f);
const e=require('../src/battle/engine.ts'),r=require('../src/battle/roster.ts'),b=require('../src/battle/base.ts');
assert.deepEqual(r.createHero('dong-ge'),r.createHero('alan'),'东哥应完整复用游侠面板、成长、装备与技能');
assert.equal(r.HERO_PRESETS['xiao-xu'].name,'盾战士小徐');assert.equal(r.HERO_PRESETS['xiao-xu'].art,'xu_guardian');
assert.equal(b.createBase(123).party.find(u=>u.heroId==='xiao-xu').policy,'defender');
const heroes=['dong-ge','xiao-xu','alan','song-ge','lia'];assert.deepEqual(e.createBattle(123,heroes).units.filter(u=>u.team==='ally').map(u=>u.heroId),heroes);
for(const rank of ['normal','elite','boss']){
 const units=e.createEnemies(123,10,3,rank);assert.equal(new Set(units.map(u=>u.id)).size,10);assert.ok(units.every(u=>!/[0-9]/.test(u.name)));assert.ok(units.every(u=>!u.name.includes('经营')));
 assert.notStrictEqual(units[2],units[5]);assert.notStrictEqual(units[2].progression,units[5].progression);assert.notStrictEqual(units[2].equipment,units[5].equipment);
 const hp=units[5].hp;units[2].hp=1;assert.equal(units[5].hp,hp);
 if(rank==='elite')assert.ok(units.every(u=>u.name.startsWith('精英')));
 if(rank==='boss'){assert.equal(units[0].name,'哥布林首领');assert.equal(units[0].progression.species,'goblin');assert.equal(units[0].rank,'boss');}
}
const manifest=JSON.parse(fs.readFileSync('image/roster_heroes/companions_manifest.json','utf8'));assert.equal(manifest.sprites.length,20);
for(const[file,hash]of Object.entries(manifest.sources))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash);
for(const sprite of manifest.sprites){const data=fs.readFileSync('image/roster_heroes/'+sprite.file);assert.equal(data.readUInt32BE(16),256);assert.equal(data.readUInt32BE(20),256);assert.equal(data[25],6);assert.ok(sprite.alpha_bounds);}
const sceneCode=fs.readFileSync('src/game/scenes/Game.ts','utf8');assert.ok(sceneCode.includes('effects.destroy(true)'));
console.log('Companion panels, independent enemy objects and 20 sprite checks passed.');
