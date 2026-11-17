import { EQUIPMENT } from './progression';
export const STORAGE_LEVELS = [{ slots: 24, cost: 120 }, { slots: 32, cost: 280 }, { slots: 40, cost: 520 }, { slots: 48, cost: 0 }] as const;
export function storageCapacity(level = 0): number { return STORAGE_LEVELS[Math.max(0, Math.min(3, Math.floor(level)))].slots; }
export function stackLimit(id: string): number { return ['consumable', 'essence', 'valuable'].includes(EQUIPMENT[id]?.slot) ? 10 : 1; }
export function stockStacks(items: readonly string[]): { id: string; count: number }[] {
    const counts = new Map<string, number>(); for (const id of items) counts.set(id, (counts.get(id) || 0) + 1);
    return [...counts].flatMap(([id, count]) => { const result = []; while (count > 0) { const n = Math.min(stackLimit(id), count); result.push({ id, count: n }); count -= n; } return result; });
}
export const stockUsage = (items: readonly string[]): number => stockStacks(items).length;
export function assertStockCapacity(items: readonly string[], limit?: number): void { if (limit !== undefined && stockUsage(items) > limit) throw new Error('物资库空间不足，请先整理或放弃部分物品'); }
export function transferStock(source: readonly string[], target: readonly string[], id: string, count: number, limit?: number): { source: string[]; target: string[] } {
    if (!Number.isInteger(count) || count < 1 || !EQUIPMENT[id]) throw new Error('搬运数量无效');
    const from = [...source], to = [...target];
    for (let n = 0; n < count; n++) { const i = from.indexOf(id); if (i < 0) throw new Error('物品数量不足'); from.splice(i, 1); to.push(id); }
    assertStockCapacity(to, limit); return { source: from, target: to };
}
