import './Inventory.css';
import { InventoryState, InventoryChange, InventoryZone, itemLocation, moveInventoryItem } from '../battle/inventory';
import { Equipment, bagCapacity, canUseEquipment } from '../battle/progression';
import { stockUsage, stockStacks } from '../battle/storage';
import { itemIcon, itemDescription, itemRequirements, ITEM_TYPES, escapeHtml as esc } from './itemPresentation';
const MIME = 'application/x-duskbound-item';
const ZONE_NAMES: Record<InventoryZone, string> = { stock: '物资库', weapon: '武器位', armor: '护甲位', backpack: '行囊位', bag: '行囊法宝' };
interface Selection { id: string; origin: InventoryZone }
export class EquipmentInventory {
    private model: InventoryState; private filter = 'all'; private selected: Selection | null = null;
    private dragged: Selection | null = null; private feedback = ''; private failed = false; private events = new AbortController();
    constructor(private host: HTMLElement, model: InventoryState, private onChange: (value: InventoryChange) => boolean | void) {
        this.model = model; const options = { signal: this.events.signal };
        host.addEventListener('click', event => this.click(event), options);
        host.addEventListener('keydown', event => { if (event.key === 'Escape' && this.selected) { event.preventDefault(); event.stopPropagation(); this.selected = null; this.render(); }
            const tile = (event.target as HTMLElement).closest<HTMLElement>('[data-item-id]');
            if ((event.key === 'Enter' || event.key === ' ') && tile) { event.preventDefault(); if (!event.repeat) tile.click(); return; }
            const zone = (event.target as HTMLElement).closest<HTMLElement>('[data-dropzone]');
            if ((event.key === 'Enter' || event.key === ' ') && zone && event.target === zone && this.selected) { event.preventDefault(); this.move(this.selected, zone.dataset.dropzone as InventoryZone); }
        }, options);
        host.addEventListener('dragstart', event => {
            const tile = (event.target as Element).closest<HTMLElement>('[data-item-id]'); if (!tile || !this.model.editable) { event.preventDefault(); return; }
            this.dragged = { id: tile.dataset.itemId!, origin: tile.dataset.origin as InventoryZone }; event.dataTransfer!.effectAllowed = 'move'; event.dataTransfer!.setData(MIME, JSON.stringify(this.dragged)); tile.classList.add('is-dragging');
        }, options);
        host.addEventListener('dragover', event => { const zone = (event.target as Element).closest<HTMLElement>('[data-dropzone]'); if (!zone || !this.dragged || !this.model.editable) return;
            event.preventDefault(); this.clearTargets(); const valid = !moveInventoryItem(this.model, this.dragged.id, zone.dataset.dropzone as InventoryZone, this.dragged.origin).error; zone.classList.add(valid ? 'drop-valid' : 'drop-invalid');
        }, options);
        host.addEventListener('drop', event => { const zone = (event.target as Element).closest<HTMLElement>('[data-dropzone]'); if (!zone || !this.dragged) return; event.preventDefault(); event.stopPropagation(); this.move(this.dragged, zone.dataset.dropzone as InventoryZone); this.dragged = null; this.clearTargets(); }, options);
        host.addEventListener('dragend', () => { this.dragged = null; this.clearTargets(); host.querySelectorAll('.is-dragging').forEach(t => t.classList.remove('is-dragging')); }, options);
        this.render();
    }
    update(model: InventoryState) { this.model = model; this.selected = null; this.feedback = ''; this.render(); }
    dispose() { this.events.abort(); this.clearTargets(); }
    private clearTargets() { this.host.querySelectorAll('.drop-valid,.drop-invalid').forEach(t => t.classList.remove('drop-valid', 'drop-invalid')); }
    private tile(item: Equipment, origin: InventoryZone, stackCount?: number): string {
        const selected = this.selected?.id === item.id && this.selected.origin === origin, eligible = canUseEquipment(item, this.model.attributes);
        const count = stackCount ?? (origin === 'stock' ? this.model.stockCounts?.[item.id] || 1 : 1);
        return '<button type="button" class="inventory-card compact-item ' + (selected ? 'is-selected ' : '') + (!eligible ? 'is-locked ' : '') + 'quality-' + (item.quality || 'common') + '" data-item-id="' + item.id + '" data-item-type="' + item.slot + '" data-origin="' + origin + '" draggable="' + this.model.editable + '" aria-pressed="' + selected + '" aria-label="' + esc(item.name + '，' + ITEM_TYPES[item.slot] + '，' + itemDescription(item) + '，' + itemRequirements(item) + (count > 1 ? '，数量' + count : '')) + '">' + itemIcon(item.id) + '<strong>' + esc(item.name) + '</strong>' + (count > 1 ? '<b class="item-count">' + count + '</b>' : '') + (!eligible ? '<span class="item-lock">未达要求</span>' : '') + '</button>';
    }
    private move(selection: Selection, destination: InventoryZone) {
        const result = moveInventoryItem(this.model, selection.id, destination, selection.origin); this.clearTargets();
        if (result.error) { this.feedback = result.error; this.failed = true; this.render(); return; } if (!result.changed) return;
        if (this.onChange({ equipment: result.equipment, artifacts: result.artifacts }) === false) { this.feedback = '无法更换，请检查物资容量和装备要求'; this.failed = true; this.render(); return; }
        let stockCounts = this.model.stockCounts;
        if (stockCounts) { const counts = { ...stockCounts }, carried = (m: { equipment: InventoryChange['equipment']; artifacts: readonly string[] }) => [m.equipment.weapon, m.equipment.armor, m.equipment.backpack || 'travel-bag', ...m.artifacts].filter((x): x is string => !!x);
            for (const id of carried(this.model)) counts[id] = (counts[id] || 0) + 1; for (const id of carried(result)) counts[id] = (counts[id] || 0) - 1; stockCounts = counts; }
        this.model = { ...this.model, equipment: result.equipment, artifacts: result.artifacts, stockCounts }; this.selected = null; this.dragged = null;
        this.feedback = (this.model.items.find(t => t.id === selection.id)?.name || '') + '已放入' + ZONE_NAMES[destination]; this.failed = false; this.render();
    }
    private click(event: MouseEvent) {
        const target = event.target as Element, filter = target.closest<HTMLElement>('[data-inventory-filter]');
        if (filter) { this.filter = filter.dataset.inventoryFilter!; this.render(); return; }
        if (target.closest('[data-inventory-return]') && this.selected) { this.move(this.selected, 'stock'); return; }
        if (target.closest('[data-inventory-equip]') && this.selected) { const item = this.model.items.find(t => t.id === this.selected!.id)!; this.move(this.selected, item.slot === 'artifact' ? 'bag' : item.slot as InventoryZone); return; }
        const tile = target.closest<HTMLElement>('[data-item-id]');
        if (tile) { const next = { id: tile.dataset.itemId!, origin: tile.dataset.origin as InventoryZone }, zone = tile.closest<HTMLElement>('[data-dropzone="weapon"],[data-dropzone="armor"],[data-dropzone="backpack"]');
            if (zone && this.selected?.origin === 'stock' && this.selected.id !== next.id) { this.move(this.selected, zone.dataset.dropzone as InventoryZone); return; }
            this.selected = this.selected?.id === next.id && this.selected.origin === next.origin ? null : next; this.feedback = ''; this.failed = false; this.render(); return; }
        const zone = target.closest<HTMLElement>('[data-dropzone]'); if (zone && this.selected) this.move(this.selected, zone.dataset.dropzone as InventoryZone);
    }
    private render() {
        const scroll = this.host.querySelector('.inventory-stock')?.scrollTop || 0, active = document.activeElement as HTMLElement | null;
        const focused = active && this.host.contains(active) ? { id: active.dataset.itemId, origin: active.dataset.origin, filter: active.dataset.inventoryFilter } : null;
        const slots = (['weapon','armor','backpack'] as const).map(slot => { const id = this.model.equipment[slot] || (slot === 'backpack' ? 'travel-bag' : ''), item = this.model.items.find(t => t.id === id);
            return '<section class="inventory-slot" data-dropzone="' + slot + '" tabindex="0" aria-label="' + ZONE_NAMES[slot] + '"><h4>' + (slot === 'weapon' ? '武器' : slot === 'armor' ? '护甲' : '行囊') + '</h4>' + (item ? this.tile(item, slot) : '<span class="inventory-empty">空位</span>') + '</section>'; }).join('');
        const bag = this.model.items.filter(t => this.model.artifacts.includes(t.id)), capacity = bagCapacity(this.model.equipment);
        const stock = this.model.items.filter(t => (this.model.stockCounts ? (this.model.stockCounts[t.id] || 0) > 0 : itemLocation(this.model, t.id) === 'stock') && (this.filter === 'all' || t.slot === this.filter));
        const all = Object.entries(this.model.stockCounts || {}).flatMap(([id,n]) => Array(Math.max(0,n)).fill(id)), selected = this.model.items.find(t => t.id === this.selected?.id);
        const canEquip = selected && ['weapon','armor','backpack','artifact'].includes(selected.slot) && this.selected?.origin === 'stock';
        this.host.innerHTML = '<div class="inventory-layout"><section class="inventory-equipped"><h3>已装备</h3><div class="inventory-slots">' + slots + '</div><section class="inventory-bag" data-dropzone="bag" tabindex="0" aria-label="行囊法宝"><h3>行囊法宝 <span>' + bag.length + ' / ' + capacity + '</span></h3><div class="inventory-grid inventory-bag-grid">' + bag.map(t => this.tile(t,'bag')).join('') + Array(Math.max(0,capacity-bag.length)).fill('<span class="inventory-empty-slot" aria-hidden="true">+</span>').join('') + '</div></section></section>' +
            '<section class="inventory-library" data-dropzone="stock" tabindex="0" aria-label="物资库"><header><h3>物资库 <span>' + (this.model.stockLimit === undefined ? all.length + '件' : stockUsage(all) + ' / ' + this.model.stockLimit + '格') + '</span></h3><div class="inventory-filters" role="group" aria-label="物品类型">' + [['all','全部'],['weapon','武器'],['armor','护甲'],['artifact','法宝'],['backpack','行囊'],['consumable','道具'],['essence','精华'],['valuable','杂物']].map(([id,label]) => '<button type="button" data-inventory-filter="' + id + '" aria-pressed="' + (this.filter === id) + '">' + label + '</button>').join('') + '</div></header><div class="inventory-stock inventory-grid">' + ((this.model.stockCounts ? stockStacks(all).filter(t => stock.some(item => item.id === t.id)).map(t => this.tile(this.model.items.find(item => item.id === t.id)!, 'stock', t.count)) : stock.map(t => this.tile(t,'stock'))).join('') || '<span class="inventory-empty">没有物品</span>') + '</div></section></div>' +
            '<footer class="inventory-footer"><div class="inventory-selection">' + (selected ? itemIcon(selected.id,32) + '<div><strong>' + esc(selected.name) + '<small>' + ITEM_TYPES[selected.slot] + '</small></strong><span>' + esc(itemDescription(selected)) + '</span><span class="' + (!canUseEquipment(selected,this.model.attributes) ? 'is-error' : '') + '">' + esc(itemRequirements(selected)) + '</span></div>' : '<span class="inventory-placeholder">选择物品查看详情</span>') + '</div><div class="inventory-actions">' + (canEquip ? '<button type="button" class="button secondary" data-inventory-equip ' + (!this.model.editable ? 'disabled' : '') + '>装备</button>' : '') + '<button type="button" class="button secondary inventory-return" data-inventory-return ' + (!this.model.editable || !this.selected || this.selected.origin === 'stock' || this.selected.origin === 'backpack' ? 'disabled' : '') + '>放回物资库</button></div></footer><p class="inventory-feedback ' + (this.failed ? 'is-error' : '') + '" role="status" aria-live="polite">' + esc(this.feedback) + '</p>';
        const grid = this.host.querySelector('.inventory-stock'); if (grid) grid.scrollTop = scroll;
        if (focused?.id) this.host.querySelector<HTMLElement>('[data-item-id="' + CSS.escape(focused.id) + '"][data-origin="' + focused.origin + '"]')?.focus({preventScroll:true});
        else if (focused?.filter) this.host.querySelector<HTMLElement>('[data-inventory-filter="' + focused.filter + '"]')?.focus({preventScroll:true});
    }
}
