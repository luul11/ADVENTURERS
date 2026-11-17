import { EQUIPMENT } from '../battle/progression';
import { stockStacks } from '../battle/storage';
import { itemIcon, itemDescription, itemRequirements, ITEM_TYPES, escapeHtml as esc } from './itemPresentation';
export interface StockTransferModel { left: readonly string[]; right: readonly string[]; leftTitle: string; rightTitle: string; rightLimit: number }
type Side = 'left' | 'right';
interface Selected { id: string; side: Side; index: number }
/** 搜刮与出发打包共用；拖拽、点选按钮和键盘均可搬运。 */
export class StockTransfer {
    private selected: Selected | null = null; private dragged: Selected | null = null;
    private feedback = ''; private failed = false; private events = new AbortController();
    constructor(private host: HTMLElement, private model: StockTransferModel, private onMove: (side: Side, id: string, count: number) => StockTransferModel) {
        const options = { signal: this.events.signal };
        host.addEventListener('click', event => {
            const target = event.target as Element, tile = target.closest<HTMLElement>('[data-transfer-item]');
            if (tile) { this.selected = { id: tile.dataset.transferItem!, side: tile.dataset.side as Side, index: Number(tile.dataset.index) }; this.feedback = ''; this.render(); return; }
            const button = target.closest<HTMLElement>('[data-transfer-move]'); if (button && this.selected) {
                const input = host.querySelector<HTMLInputElement>('[data-transfer-count]'), stack = this.currentStack();
                this.move(this.selected, button.dataset.transferMove === 'stack' ? stack?.count || 1 : Number(input?.value || 1));
            }
        }, options);
        host.addEventListener('dblclick', event => { const tile = (event.target as Element).closest<HTMLElement>('[data-transfer-item]'); if (!tile) return;
            const selection = { id: tile.dataset.transferItem!, side: tile.dataset.side as Side, index: Number(tile.dataset.index) }; this.move(selection, stockStacks(this.model[selection.side])[selection.index]?.count || 1);
        }, options);
        host.addEventListener('dragstart', event => { const tile = (event.target as Element).closest<HTMLElement>('[data-transfer-item]'); if (!tile) return;
            this.dragged = { id: tile.dataset.transferItem!, side: tile.dataset.side as Side, index: Number(tile.dataset.index) }; event.dataTransfer!.setData('application/x-adventurers-loot', JSON.stringify(this.dragged)); event.dataTransfer!.effectAllowed = 'move';
        }, options);
        host.addEventListener('dragover', event => { const zone = (event.target as Element).closest<HTMLElement>('[data-transfer-zone]'); if (zone && this.dragged && zone.dataset.transferZone !== this.dragged.side) { event.preventDefault(); zone.classList.add('drop-valid'); } }, options);
        host.addEventListener('dragleave', event => { const zone = (event.target as Element).closest<HTMLElement>('[data-transfer-zone]'); if (zone && !zone.contains(event.relatedTarget as Node)) zone.classList.remove('drop-valid'); }, options);
        host.addEventListener('drop', event => { const zone = (event.target as Element).closest<HTMLElement>('[data-transfer-zone]'); if (!zone || !this.dragged || zone.dataset.transferZone === this.dragged.side) return;
            event.preventDefault(); const dragged = this.dragged; this.dragged = null; this.move(dragged, stockStacks(this.model[dragged.side])[dragged.index]?.count || 1);
        }, options);
        host.addEventListener('dragend', () => { this.dragged = null; host.querySelectorAll('.drop-valid').forEach(t => t.classList.remove('drop-valid')); }, options);
        this.render();
    }
    dispose() { this.events.abort(); }
    private currentStack() { if (!this.selected) return undefined; const stacks = stockStacks(this.model[this.selected.side]); return stacks[this.selected.index]?.id === this.selected.id ? stacks[this.selected.index] : stacks.find(s => s.id === this.selected!.id); }
    private move(selection: Selected, count: number) {
        try { this.model = this.onMove(selection.side, selection.id, count); this.feedback = EQUIPMENT[selection.id].name + ' ×' + count + (selection.side === 'left' ? ' 已收纳' : ' 已移出'); this.failed = false;
            this.selected = this.model[selection.side].includes(selection.id) ? { ...selection, index: stockStacks(this.model[selection.side]).findIndex(t => t.id === selection.id) } : null;
        } catch (e) { this.feedback = (e as Error).message; this.failed = true; }
        this.render();
    }
    private panel(side: Side): string {
        const stacks = stockStacks(this.model[side]), limit = side === 'right' ? this.model.rightLimit : Math.max(12, stacks.length);
        return '<section class="transfer-panel" data-transfer-zone="' + side + '"><header><h3>' + esc(side === 'left' ? this.model.leftTitle : this.model.rightTitle) + '</h3><span>' + stacks.length + (side === 'right' ? ' / ' + limit + '格' : '格') + '</span></header><div class="transfer-grid">' + stacks.map((stack,index) => {
            const item = EQUIPMENT[stack.id], selected = this.selected?.side === side && this.selected.index === index && this.selected.id === stack.id;
            return '<button type="button" class="compact-item quality-' + (item.quality || 'common') + (selected ? ' is-selected' : '') + '" data-transfer-item="' + item.id + '" data-side="' + side + '" data-index="' + index + '" draggable="true" aria-pressed="' + selected + '" aria-label="' + esc(item.name + '，数量' + stack.count) + '">' + itemIcon(item.id) + '<strong>' + esc(item.name) + '</strong>' + (stack.count > 1 ? '<b class="item-count">' + stack.count + '</b>' : '') + '</button>';
        }).join('') + Array(Math.max(0,limit-stacks.length)).fill('<span class="inventory-empty-slot" aria-hidden="true"></span>').join('') + '</div></section>';
    }
    private render() {
        const scrolls = [...this.host.querySelectorAll('.transfer-grid')].map(t => t.scrollTop), active = document.activeElement as HTMLElement | null;
        const focus = active && this.host.contains(active) ? { id: active.dataset.transferItem, side: active.dataset.side, index: active.dataset.index, move: active.dataset.transferMove } : undefined;
        const item = this.selected ? EQUIPMENT[this.selected.id] : undefined, stack = this.currentStack();
        this.host.innerHTML = '<div class="stock-transfer">' + this.panel('left') + this.panel('right') + '</div><footer class="transfer-detail">' + (item ? '<div class="transfer-item-detail">' + itemIcon(item.id,32) + '<div><strong>' + esc(item.name) + '<small>' + ITEM_TYPES[item.slot] + '</small></strong><p>' + esc(itemDescription(item)) + '</p><span>' + esc(itemRequirements(item)) + '</span></div></div><div class="transfer-controls"><input type="number" data-transfer-count min="1" max="' + (stack?.count || 1) + '" value="1" aria-label="搬运数量"><button class="button secondary" data-transfer-move="count">' + (this.selected!.side === 'left' ? '收纳' : '移出') + '</button><button class="button secondary" data-transfer-move="stack">整组' + (this.selected!.side === 'left' ? '收纳' : '移出') + '</button></div>' : '<span class="inventory-placeholder">选择物品后收纳或移出，也可拖动整组物品</span>') + '</footer><p class="transfer-feedback ' + (this.failed ? 'is-error' : '') + '" role="status" aria-live="polite">' + esc(this.feedback) + '</p>';
        this.host.querySelectorAll('.transfer-grid').forEach((t,i) => t.scrollTop = scrolls[i] || 0);
        if (focus?.id) this.host.querySelector<HTMLElement>('[data-transfer-item="' + CSS.escape(focus.id) + '"][data-side="' + focus.side + '"][data-index="' + focus.index + '"]')?.focus({preventScroll:true});
        else if (focus?.move) this.host.querySelector<HTMLElement>('[data-transfer-move="' + focus.move + '"]')?.focus({preventScroll:true});
    }
}
