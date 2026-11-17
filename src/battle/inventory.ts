import { assertStockCapacity } from './storage';
import { Equipment, EquipmentLoadout, PrimaryAttributes, PRIMARY_STATS, bagCapacity, canUseEquipment } from './progression';

export type InventoryZone = 'stock' | 'weapon' | 'armor' | 'backpack' | 'bag';
export interface InventoryState {
    attributes: PrimaryAttributes;
    equipment: EquipmentLoadout;
    artifacts: readonly string[];
    items: readonly Equipment[];
    editable: boolean;
    stockCounts?: Readonly<Record<string, number>>; stockLimit?: number;
}
export interface InventoryChange { equipment: EquipmentLoadout; artifacts: string[] }
export interface InventoryMove extends InventoryChange { changed: boolean; error?: string }

export function itemLocation(state: InventoryState, id: string): InventoryZone {
    if ((state.equipment.backpack || 'travel-bag') === id) return 'backpack';
    if (state.equipment.weapon === id) return 'weapon';
    if (state.equipment.armor === id) return 'armor';
    return state.artifacts.includes(id) ? 'bag' : 'stock';
}

export function moveInventoryItem(state: InventoryState, id: string, destination: InventoryZone, source: InventoryZone = itemLocation(state, id)): InventoryMove {
    const next: InventoryMove = { equipment: { ...state.equipment }, artifacts: [...state.artifacts], changed: false };
    const fail = (error: string) => ({ ...next, error });
    if (!state.editable) return fail('当前不可更换装备');
    const item = state.items.find(x => x.id === id);
    if (!item) return fail('物品不存在');
    if (!['stock', 'weapon', 'armor', 'backpack', 'bag'].includes(destination)) return fail('无效的放置区域');
    if (source !== 'stock' && itemLocation(state, id) !== source) return fail('物品位置已改变');
    if (source === 'stock' && state.stockCounts && (state.stockCounts[id] || 0) < 1) return fail('物资库数量不足');
    if (source === 'backpack' && destination !== 'backpack') return fail('请用另一个行囊替换当前行囊');
    if (source === destination) return next;
    if (source === 'stock' && itemLocation(state, id) === destination) return fail('已装备同类物品，无需替换');
    if (destination === 'weapon' || destination === 'armor' || destination === 'backpack') {
        if (destination === 'backpack' && next.artifacts.length > (item.capacity || 3)) return fail('行囊空间不足，请先整理物品');
        if (item.slot !== destination) return fail(destination === 'weapon' ? '这里只能放武器' : '这里只能放护甲');
        if (!canUseEquipment(item, state.attributes)) {
            const missing = PRIMARY_STATS.filter(s => (item.requirements?.[s.key] || 0) > state.attributes[s.key])
                .map(s => `${s.name}需要${item.requirements![s.key]}，当前${state.attributes[s.key]}`).join('；');
            return fail(missing);
        }
        next.equipment[destination] = id;
    } else if (destination === 'bag') {
        if (item.slot !== 'artifact') return fail('行囊只收纳个人增益法宝；消耗品和材料由团队物资库保管');
        if (next.artifacts.includes(id)) return fail('已携带该法宝，重复法宝不会叠加增益');
        if (next.artifacts.length >= bagCapacity(next.equipment)) return fail('行囊已满');
        next.artifacts.push(id);
    } else {
        if (source === 'weapon' || source === 'armor') next.equipment[source] = null;
        if (source === 'bag') next.artifacts = next.artifacts.filter(x => x !== id);
    }
    if (state.stockCounts && state.stockLimit !== undefined) {
        const carried = (value: { equipment: EquipmentLoadout; artifacts: readonly string[] }) => [value.equipment.weapon, value.equipment.armor, value.equipment.backpack || 'travel-bag', ...value.artifacts].filter((x): x is string => !!x);
        const pool = Object.entries(state.stockCounts).flatMap(([key, n]) => Array(n).fill(key)), before = carried(state), after = carried(next);
        pool.push(...before); for (const key of after) { const i = pool.indexOf(key); if (i >= 0) pool.splice(i, 1); }
        try { assertStockCapacity(pool, state.stockLimit); } catch (e) { return fail((e as Error).message); }
    }
    next.changed = true;
    return next;
}
