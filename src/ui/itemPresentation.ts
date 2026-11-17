import { EQUIPMENT, Equipment, PRIMARY_STATS, consumableDescription } from '../battle/progression';
import { icon } from './icons';
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const ITEM_TYPES = { weapon: '武器', armor: '护甲', backpack: '行囊', artifact: '法宝', consumable: '道具', essence: '精华', valuable: '杂物' };
export function itemIcon(id: string, size = 26): string {
    const item = EQUIPMENT[id], names = { weapon: 'sword', armor: 'shield', backpack: 'bag', artifact: 'spark', consumable: 'potion', essence: 'essence', valuable: 'coin' };
    const name = id === 'contract' ? 'contract' : id === 'revival-stone' ? 'revive' : id.startsWith('repair-') ? 'gear' : names[item?.slot] || 'bag';
    return '<span class="item-symbol item-' + escapeHtml(id) + ' item-kind-' + item?.slot + '">' + icon(name, size) + '</span>';
}
export function itemDescription(item: Equipment): string {
    if (item.capacity) return item.capacity + '格个人法宝空间';
    if (item.description) return item.description;
    if (item.slot === 'consumable') return consumableDescription(item);
    const labels = { armor: '护甲', attack: '攻击', spellPower: '法强', maxHp: '生命', maxMp: '魔力', meleeHit: '近战命中', rangedHit: '远程命中', evasion: '闪避', speed: '速度' } as const;
    return (Object.keys(labels) as (keyof typeof labels)[]).filter(k => item[k]).map(k => labels[k] + ' ' + (item[k]! > 0 ? '+' : '') + item[k]).join(' / ');
}
export function itemRequirements(item: Equipment): string { return PRIMARY_STATS.filter(s => item.requirements?.[s.key]).map(s => s.name + ' ' + item.requirements![s.key]).join(' / ') || '无属性要求'; }
