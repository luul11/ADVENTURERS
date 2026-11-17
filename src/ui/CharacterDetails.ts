import { Unit, effectiveEvasion, evasionPenalty } from '../battle/engine';
import { PRIMARY_STATS, SPECIES, MAX_LEVEL, TRAITS_BY_ID, EQUIPMENT, allocationGain, estimatedPower, nakedPower, equipmentValue, talentTitle, totalStars } from '../battle/progression';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export interface CharacterDetailsOptions { editable: boolean; portraitUrl: string; skillsHtml: string }

export function renderCharacterDetails(u: Unit, options: CharacterDetailsOptions): string {
    const p = u.progression;
    const attrs = [['生命', `${u.hp} / ${u.maxHp}`], ['护甲', `${u.armor} / ${u.maxArmor}`], ['法力', `${u.mp} / ${u.maxMp}`],
        ['攻击', u.attack], ['法强', u.spellPower], ['速度', u.speed], ['近战命中', `${u.meleeHit}%`],
        ['远程命中', `${u.rangedHit}%`], ['闪避', `${effectiveEvasion(u)}%`], ['移动', `${u.move} 格`]];
    const tiers = { common: '普通', rare: '稀有', excellent: '卓越' };
    const traits = p.traits.map(id => {
        const t = TRAITS_BY_ID[id];
        const bonuses = PRIMARY_STATS.filter(s => t.modifiers[s.key]).map(s => `${s.name}${t.modifiers[s.key]! > 0 ? '+' : ''}${t.modifiers[s.key]}`).join(' / ');
        return `<li class="trait-row"><span>${esc(t.name)} <small class="trait-tier ${t.tier}">${tiers[t.tier]}</small></span><small>${bonuses}</small></li>`;
    }).join('');
    const attributes = PRIMARY_STATS.map(stat => {
        const stars = p.potential[stat.key], gain = allocationGain(u, stat.key);
        return `<div class="growth-row"><div><strong>${stat.name}</strong><span class="potential-stars" aria-label="潜力${stars}星">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span></div><div><b>${p.attributes[stat.key]}</b><small>每级 +${stars}–${stars + 1}<br>每点${stat.benefit}</small></div>${options.editable ? `<button type="button" data-action="allocate" data-id="${stat.key}" class="growth-add" ${p.freePoints < 1 || !gain ? 'disabled' : ''} aria-label="消耗一点，${stat.name}增加1">+1</button>` : ''}</div>`;
    }).join('');
    const gear = [u.equipment.weapon, u.equipment.armor].map(id => id ? EQUIPMENT[id].name : '未装备').join(' / ');
    return `<div class="modal-unit"><img src="${esc(options.portraitUrl)}" alt="" class="portrait ${u.team}"><div><span class="eyebrow">${SPECIES[p.species].name} / Lv.${p.level}</span><h3>${esc(u.name)}</h3><p>${talentTitle(p).replace('·', ' / ')} / 总潜力 ${totalStars(p)} 星</p></div></div>
        <div class="power-heading character-power"><div><span>最终战力</span><strong>${estimatedPower(u)}</strong></div><span>裸 ${nakedPower(u)} / 装备 +${equipmentValue(u)}</span></div>
        <div class="attribute-grid">${attrs.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>
        ${evasionPenalty(u) ? `<p class="muted">低资源闪避减益 −${evasionPenalty(u)} / 基础闪避 ${u.evasion}%</p>` : ''}
        <p class="character-gear-summary">${esc(gear)}</p>${options.editable ? '<button type="button" data-action="gear" class="button secondary full">装备与背包</button>' : ''}
        <h3 class="modal-subtitle">人物特性</h3><ul class="trait-list">${traits}</ul>
        <section class="growth-panel"><h3 class="modal-subtitle">裸属性</h3><div class="growth-list">${attributes}</div><p class="growth-points">自由点 <b>${p.freePoints}</b> / 上限 100 / 移动 3 格</p>
        ${options.editable ? `<button type="button" data-action="train" class="button secondary full" ${p.level >= MAX_LEVEL ? 'disabled' : ''}>Demo 升级 +1 / 额外 1 点自由点</button>` : ''}</section>
        <h3 class="modal-subtitle">携带技能</h3>${options.skillsHtml}${options.editable ? '<button type="button" data-action="equip" class="button secondary full">调整本场技能</button>' : ''}`;
}
