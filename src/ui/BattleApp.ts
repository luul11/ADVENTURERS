import StartGame from '../game/main';
import { Game as BattleScene } from '../game/scenes/Game';
import {
    Battle, Point, Unit, Skill, Command, Mode, COLS, ROWS, activeUnit, affected,
    areaTarget, areaCells, skillAims, itemTargets, captureChance, POLICIES, Policy, deployUnits, blocked, chooseAI, clone, createBattle, distance, EQUIPPABLE, hitChance, losses, paths,
    pathRisk, power, resolve, same, skillById, startBattle, targets, unitAt, visible, configureEquipment, learnedSkills, configureSkills
} from '../battle/engine';
import { gameTipsHtml } from './GameTips';
import { icon } from './icons';
import { ArtPose, characterImage, unitArtId } from '../battle/characterArt';
import { DEFAULT_HERO_IDS, HeroId } from '../battle/roster';
import { PRIMARY_STATS, PrimaryStat, EquipmentLoadout, EQUIPMENT, restorationError, consumableDescription, levelUp, allocatePoint, estimatedPower, nakedPower, equipmentValue } from '../battle/progression';
import { EquipmentInventory } from './EquipmentInventory';
import { renderCharacterDetails } from './CharacterDetails';
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const portrait = (u: Unit, pose: ArtPose = 'portrait') => `<img src="${characterImage(u, pose)}" alt="" class="portrait ${u.team}" />`;
const QUICK_ITEMS = ['potion', 'ether', 'contract', 'revival-stone'] as const;
type QuickItemId = typeof QUICK_ITEMS[number];
type Modal = 'help' | 'logs' | 'details' | 'skills' | 'equip' | 'gear' | 'end' | 'result' | 'items' | 'revive' | null;
export interface BattleOptions { battle?: Battle; onComplete?: (battle: Battle) => void; stock?: () => string[]; onEquipment?: (id: string, equipment: EquipmentLoadout, artifacts: string[]) => boolean; partySize?: () => number }
export class BattleApp {
    private events = new AbortController();
    private game: ReturnType<typeof StartGame>;
    private options: BattleOptions;
    private state: Battle;
    private scene = new BattleScene();
    private mode: Mode = 'manual';
    private busy = false;
    private quickItem: string | null = null;
    private pendingQuickItem: string | null = null;
    private reviveTargetId: string | null = null;
    private loaded = false;
    private inspectedId = 'ally-1';
    private selection: 'move' | string | null = null;
    private to: Point | null = null;
    private targetId: string | null = null;
    private threat = false;
    private showGrid = false;
    private modal: Modal = null;
    private inventory?: EquipmentInventory;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private modalReturn: HTMLElement | null = null;
    private notice = '';
    private readonly root: HTMLElement;
    constructor(root: HTMLElement, heroIds: readonly HeroId[] = DEFAULT_HERO_IDS, options: BattleOptions = {}) {
        this.options = options;
        this.state = options.battle ? clone(options.battle) : createBattle(undefined, heroIds);
        this.scene.artIds = [...new Set(this.state.units.map(unitArtId))];
        this.root = root;
        root.innerHTML = `
        <div class="battle-shell">
            <main class="battle-main">
                <div class="battle-stage">
                    <aside id="team-panel" class="team-panel panel" aria-label="小队与单位情报"><div class="panel-heading"><h2>${icon('shield', 16)} 我方小队</h2><button data-action="team-panel" class="icon-button mobile-close" aria-label="收起小队">${icon('close', 16)}</button><span class="panel-count">04</span></div><div id="team-roster" class="team-roster"></div><div class="detail-label">单位情报</div><section id="unit-detail" class="unit-detail"></section></aside>
                    <section class="arena-column" aria-label="战场与行动栏">
                        <div class="board-frame"><div class="board-top"><details class="board-settings"><summary aria-label="战场显示设置">${icon('gear', 18)}</summary><div class="board-tools"><button data-action="grid" class="text-button" id="grid-toggle" aria-pressed="false"></button><button data-action="threat" class="text-button" id="threat-toggle" aria-pressed="false"></button><div class="zoom-tools"><button data-action="zoom-out" aria-label="缩小战场" title="缩小">−</button><button data-action="zoom-reset" aria-label="重置战场视角">重置</button><button data-action="zoom-in" aria-label="放大战场" title="放大">+</button></div><div id="survivors" class="tool-survivors"></div></div></details></div><div id="game-container" role="img" aria-label="5列6行战场，点击格子选择角色或目标"></div><div class="board-coordinates"><span>A — E</span><span>5 × 6</span><span>01 — 06</span></div></div>
                        <footer class="battle-console"><div class="console-toolbar"><div class="console-indicator"><div id="console-status" class="console-status"></div><div id="feedback" class="feedback" role="status" aria-live="polite" hidden></div></div><nav id="battle-tools" class="battle-tools" aria-label="战斗工具"></nav></div><nav id="quick-items" class="quick-items" aria-label="快捷道具"></nav><div id="controls" class="controls"></div></footer>
                    </section>
                    <aside id="initiative-panel" class="initiative panel" aria-label="本轮行动序列"><div class="panel-heading"><h2>${icon('swap', 16)} 行动序列</h2><span id="round-label" class="round-chip"></span><button data-action="timeline-panel" class="icon-button mobile-close" aria-label="收起行动序列">${icon('close', 16)}</button></div><div id="turn-track" class="turn-track"></div><section class="journal"><div class="panel-heading"><h2>${icon('scroll', 16)} 战况</h2><button data-action="logs" class="text-button" aria-label="查看完整战斗记录">全部 ${icon('arrow', 14)}</button></div><div id="recent-log" class="recent-log" aria-live="polite"></div></section></aside>
                </div>
            </main>
        </div>
        <dialog id="battle-dialog" class="battle-dialog" aria-labelledby="dialog-title"><div id="dialog-content"></div></dialog>`;
        const listenerOptions = { signal: this.events.signal };
        root.addEventListener('click', event => {
            const element = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
            if (element && !element.hasAttribute('disabled')) this.handle(element.dataset.action!, element.dataset.id);
        }, listenerOptions);
        root.addEventListener('change', event => {
            const select = event.target as HTMLSelectElement;
            if (select.matches('[data-policy]') && Object.prototype.hasOwnProperty.call(POLICIES, select.value) && !this.busy) { const unit = this.inspected(); if (unit.team === 'ally') { unit.policy = select.value as Policy; this.state.revision++; this.render(); } return; }
            if (!select.matches('[data-slot]') || this.state.phase !== 'ready') return;
            const u = this.inspected(); const slot = Number(select.dataset.slot);
            if (u.team !== 'ally' || slot < 0 || slot > 2) return;
            const next = [...u.skills]; next[slot] = select.value;
            if (new Set(next).size !== next.length) { this.notice = '每个角色不能重复携带同一技能'; this.renderModal(); return; }
            if (!next.every(id => learnedSkills(u).includes(id))) { this.notice = '角色尚未掌握该技能'; this.renderModal(); return; }
            this.state = configureSkills(this.state, u.id, next); this.render(); this.renderModal();
        }, listenerOptions);
        this.dialog().addEventListener('cancel', event => { event.preventDefault(); if (this.modal !== 'result') this.closeModal(); });
        this.dialog().addEventListener('click', event => { if (event.target === this.dialog() && this.modal !== 'result') this.closeModal(); });
        document.addEventListener('keydown', event => this.keydown(event), listenerOptions);
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.clearTimer(); else this.schedule(); }, listenerOptions);
        this.scene.onCell = p => this.clickCell(p);
        this.scene.onReady = () => { this.loaded = true; this.render(); };
        this.game = StartGame('game-container', this.scene);
        this.render();
    }
    dispose() { this.quickItem = null; this.pendingQuickItem = null; this.reviveTargetId = null; this.clearTimer(); this.events.abort(); this.inventory?.dispose(); this.scene.onReady = () => {}; this.scene.onCell = () => {}; this.game.destroy(true); }
    private $(id: string) { return this.root.querySelector<HTMLElement>(`#${id}`)!; }
    private dialog() { return this.$('battle-dialog') as HTMLDialogElement; }
    private inspected() { return this.state.units.find(u => u.id === this.inspectedId) || this.state.units[0]; }
    private manual() { return this.state.phase === 'battle' && this.mode === 'manual' && activeUnit(this.state)?.team === 'ally' && !this.busy && !this.modal; }
    private clearTimer() { if (this.timer !== undefined) clearTimeout(this.timer); this.timer = undefined; }
    private resetSelection() { this.selection = null; this.to = null; this.targetId = null; this.notice = ''; }
    private handle(action: string, id?: string) {
        switch (action) {
            case 'quick-item': if (id && QUICK_ITEMS.includes(id as QuickItemId)) this.beginQuickItem(id as QuickItemId); return;
            case 'revive-target': if(this.modal==='revive'&&id&&this.state.units.some(u=>u.id===id&&u.team==='ally'&&u.hp===0)){this.reviveTargetId=id;this.renderModal();}return;
            case 'revive-confirm': if(this.modal==='revive'&&this.reviveTargetId){const targetId=this.reviveTargetId;this.closeModal(false);void this.execute({type:'item',itemId:'revival-stone',targetId});}return;
            case 'quick-cancel': this.cancelQuickItem(); return;
            case 'mode':
                if (this.state.phase === 'over') return;
                this.quickItem = null; this.pendingQuickItem = null; this.clearTimer(); this.mode = this.mode === 'manual' ? 'auto' : 'manual'; this.resetSelection(); this.render(); this.schedule(); return;
            case 'team-panel': case 'timeline-panel': {
                const panel = this.$(action === 'team-panel' ? 'team-panel' : 'initiative-panel');
                const open = panel.classList.toggle('mobile-open');
                this.root.querySelectorAll(`[data-action="${action}"]`).forEach(button => button.setAttribute('aria-expanded', String(open)));
                return;
            }
            case 'zoom-in': this.scene.zoomBy(.2); return;
            case 'zoom-out': this.scene.zoomBy(-.2); return;
            case 'zoom-reset': this.scene.resetView(); return;
            case 'threat': this.threat = !this.threat; this.render(); return;
            case 'grid': this.showGrid = !this.showGrid; this.render(); return;
            case 'inspect': if (id && this.quickItem) { const target = this.state.units.find(u => u.id === id); if (target) this.useQuickItem(target); return; } if (id) { this.inspectedId = id; this.render(); } return;
            case 'help': case 'logs': case 'details': this.openModal(action); return;
            case 'equip': this.openModal('equip'); return;
            case 'gear': this.openModal('gear'); return;
            case 'close': this.closeModal(); return;
            case 'train': {
                if (this.options.onComplete) return;
                if (this.state.phase !== 'ready' || this.inspected().team !== 'ally') return;
                levelUp(this.inspected()); this.state.revision++; this.render(); this.renderModal(); return;
            }
            case 'allocate': {
                if (this.options.onComplete) return;
                if (this.state.phase !== 'ready' || this.inspected().team !== 'ally' || !PRIMARY_STATS.some(s => s.key === id)) return;
                allocatePoint(this.inspected(), id as PrimaryStat); this.state.revision++; this.render(); this.renderModal(); return;
            }
            case 'start':
                if (this.state.phase !== 'ready' || !this.loaded) return;
                deployUnits(this.state.units); this.state = startBattle(this.state); this.inspectedId = this.state.activeId; this.resetSelection(); this.render(); this.schedule(); return;
            case 'continue': if (this.state.phase === 'over' && this.options.onComplete) { const result = clone(this.state); this.closeModal(false); this.dispose(); this.options.onComplete(result); } return;
            case 'restart': {
                if (this.options.onComplete) return;
                this.clearTimer(); this.closeModal();
                const previous = this.state; this.state = createBattle(previous.seed, previous.units.filter(u => u.team === 'ally').map(u => u.heroId!));
                for (const unit of this.state.units) {
                    const saved = clone(previous.units.find(u => u.id === unit.id)!);
                    Object.assign(unit, saved, { x: unit.x, y: unit.y, hp: saved.maxHp, armor: saved.maxArmor, mp: saved.maxMp, reaction: true });
                }
                this.mode = 'manual'; this.inspectedId = 'ally-1'; this.resetSelection(); this.render(); return;
            }
            case 'cancel': if (this.quickItem || this.pendingQuickItem) this.cancelQuickItem(); else { this.resetSelection(); this.render(); } return;
            case 'confirm': {
                if (!this.manual()) return;
                if (this.selection === 'move' && this.to) void this.execute({ type: 'move', to: this.to });
                else if (this.selection?.startsWith('item:') && this.targetId) void this.execute({ type: 'item', itemId: this.selection.slice(5), targetId: this.targetId });
                else if (this.selection && (this.targetId || this.to)) void this.execute({ type: 'skill', skillId: this.selection, ...(this.to ? { to: this.to } : { targetId: this.targetId! }) });
                return;
            }
            case 'items': if (this.state.phase==='battle'&&!this.busy) this.openModal('items'); return;
            case 'use-item': if(id){this.closeModal(false);this.beginQuickItem(id);}return;
            case 'skills': if (this.manual() && !this.state.acted) this.openModal('skills'); return;
            case 'skill':
                if (id) { this.closeModal(); if (this.manual()) this.select(id); } return;
            case 'move': if (this.manual()) this.select('move'); return;
            case 'melee': case 'ranged': if (this.manual()) this.select(action); return;
            case 'disengage': if (this.manual()) void this.execute({ type: 'disengage' }); return;
            case 'end': if (this.manual()) this.openModal('end'); return;
            case 'end-confirm': this.closeModal(); if (this.manual()) void this.execute({ type: 'end' }); return;
            case 'retreat': this.notice = '战斗中不能撤退'; this.render(); return;
        }
    }
    private quickItemError(id: string): string | undefined {
        if(EQUIPMENT[id]?.slot!=='consumable')return '请选择团队消耗品';
        if(this.state.phase!=='battle')return '开战后才能使用团队道具';
        if(!this.state.stock.includes(id))return '团队物资库中没有'+EQUIPMENT[id].name;
        if(id==='revival-stone'&&!this.state.units.some(u=>u.team==='ally'&&u.hp===0))return '没有倒下的队友';
        return undefined;
    }
    private beginQuickItem(id: string) {
        if (this.modal || this.state.phase !== 'battle') return;
        if (this.quickItem === id && !this.busy) { this.cancelQuickItem(); return; }
        const error = this.quickItemError(id);
        if (error) { this.notice = error; this.render(); return; }
        this.clearTimer(); this.resetSelection();
        if (this.busy) {
            this.pendingQuickItem = id; this.reviveTargetId = null; this.quickItem = null;
            this.notice = '当前动作结算后选择道具目标'; this.render(); return;
        }
        this.pendingQuickItem = null; this.quickItem = id; this.selection = 'item:' + id;
        this.inspectedId = activeUnit(this.state)!.id;this.render();if(id==='revival-stone'){this.reviveTargetId=this.state.units.find(u=>u.team==='ally'&&u.hp===0)?.id||null;this.openModal('revive');}
    }
    private cancelQuickItem() {
        this.quickItem = null; this.pendingQuickItem = null; this.reviveTargetId = null;
        this.resetSelection(); this.render(); this.schedule();
    }
    private useQuickItem(target: Unit) {
        const id = this.quickItem; if (!id || this.busy || this.modal) return;
        const error = this.quickItemError(id), source = activeUnit(this.state);
        if (error || !source) { this.notice = error || '行动者不存在'; this.render(); return; }
        if (!itemTargets(this.state, source, id).some(u => u.id === target.id)) {
            this.targetId = null;
            this.notice = EQUIPMENT[id].restore && target.team === 'ally'
                ? restorationError(target, id) || '请选择需要恢复的队友'
                : id === 'contract' && target.team !== source.team && target.rank && target.rank !== 'normal'
                    ? '精英与Boss不能收服' : '请选择合法目标';
            this.render(); return;
        }
        void this.execute({ type: 'item', itemId: id, targetId: target.id });
    }
    private renderQuickItems() {
        const waiting = this.quickItem || this.pendingQuickItem;
        this.$('quick-items').innerHTML = QUICK_ITEMS.map(id => {
            const count=this.state.stock.filter(item=>item===id).length;
            const reason = this.quickItemError(id), selected = waiting === id;
            const name = id === 'potion' ? '生命药水' : id === 'ether' ? '魔力药水' : id==='contract'?'契约':'复苏石';
            const label = name + '，' + '团队物资库' + count + '件' + (reason ? '，' + reason : '，点击暂停并选择目标');
            return '<button type="button" data-action="quick-item" data-id="' + id + '" class="quick-item quick-' + id + (selected ? ' selected' : '') + '" aria-label="' + esc(label) + '" title="' + esc(label) + '" aria-pressed="' + selected + '" ' + (this.state.phase !== 'battle' || this.modal ? 'disabled' : '') + '>' + icon(id === 'contract' ? 'contract' : id==='revival-stone'?'revive':'potion',24) + '<span class="quick-count" aria-hidden="true">' + count + '</span></button>';
        }).join('') + '<span class="quick-state" role="status">' + (this.pendingQuickItem ? '结算后暂停' : this.quickItem ? '已暂停，选择目标' : '') + '</span><button type="button" data-action="quick-cancel" class="quick-cancel" ' + (!waiting ? 'disabled' : '') + ' aria-label="取消道具选择并恢复原战斗模式" title="取消并恢复战斗">' + icon('close', 16) + '<span>取消</span></button>';
    }
    private select(id: string) {
        const u = activeUnit(this.state); if (!u) return;
        if (id === 'move' && this.state.moved) return;
        if (id !== 'move' && this.state.acted) return;
        this.resetSelection(); this.selection = id; this.inspectedId = u.id; this.render();
    }
    private clickCell(p: Point) {
        if (this.modal) return;
        const unit = unitAt(this.state, p), u = activeUnit(this.state);
        if (this.quickItem) { if (unit) this.useQuickItem(unit); else { this.notice = '请选择高亮的目标'; this.render(); } return; }
        if (!this.manual() || !this.selection || !u) {
            if (unit) { this.inspectedId = unit.id; this.render(); } return;
        }
        if (this.selection === 'move') {
            const path = paths(this.state, u).get(`${p.x},${p.y}`);
            if (path?.length) { this.to = p; this.notice = ''; }
            else this.notice = '该格无法到达：检查占位、障碍和移动距离';
        } else if (this.selection.startsWith('item:')) {
            this.targetId = null;
            if (unit && itemTargets(this.state, u, this.selection.slice(5)).some(t => t.id === unit.id)) { this.targetId = unit.id; this.notice = ''; } else this.notice = unit?.team === u.team && EQUIPMENT[this.selection.slice(5)]?.restore ? restorationError(unit, this.selection.slice(5)) || '目标超出射程或视线不可达' : '道具无法作用于该目标';
        } else {
            const skill = skillById(this.selection);
            if (skill && (skill.area || skill.cross)) { const aim = areaTarget(u, p); if (skillAims(this.state, u, skill).some(t => same(t, aim))) { this.to = p; this.targetId = null; this.notice = ''; } else this.notice = '范围内没有敌人，或射程与视线不满足'; this.render(); return; }
            if (skill && unit && targets(this.state, u, skill).some(t => t.id === unit.id)) { this.targetId = unit.id; this.notice = ''; }
            else this.notice = '不是合法目标：检查阵营、射程、视线和剩余资源';
        }
        this.render();
    }
    private async execute(command: Command) {
        if (this.busy || this.state.phase !== 'battle') return;
        this.clearTimer();
        const previous = this.state;
        const result = resolve(previous, command);
        if (result.error) { this.notice = result.error; this.render(); return; }
        if (command.type === 'item' && this.quickItem === command.itemId) this.quickItem = null;
        this.resetSelection(); this.renderBoard(); this.busy = true;
        this.notice = command.type === 'move' ? '正在移动与结算借机攻击…' : command.type === 'skill' ? `${skillById(command.skillId)?.name} / 正在结算…` : '正在结算…';
        this.render();
        try { await this.scene.play(result.events); }
        finally {
            this.state = result.state; this.busy = false;
            this.inspectedId = activeUnit(this.state)?.id || this.inspectedId; this.notice = '';
            this.render();
            if (this.state.phase === 'over') { this.quickItem = null; this.pendingQuickItem = null; this.reviveTargetId = null; this.openModal('result'); }
            else if (this.pendingQuickItem) {
                const pending=this.pendingQuickItem;this.pendingQuickItem=null;this.reviveTargetId=null;
                const error=this.quickItemError(pending);
                if (!error) this.beginQuickItem(pending);
                else { this.notice = error; this.render(); this.schedule(); }
            } else this.schedule();
        }
    }
    private schedule() {
        this.clearTimer();
        if (!this.loaded || this.busy || this.modal || this.quickItem || this.pendingQuickItem || document.hidden || this.state.phase !== 'battle') return;
        if (this.mode === 'manual' && activeUnit(this.state)?.team === 'ally') return;
        const revision = this.state.revision;
        this.timer = setTimeout(() => {
            this.timer = undefined;
            if (this.busy || this.modal || this.quickItem || this.pendingQuickItem || document.hidden || revision !== this.state.revision) return;
            if (this.mode === 'manual' && activeUnit(this.state)?.team === 'ally') return;
            void this.execute(chooseAI(this.state));
        }, 380);
    }
    private render() {
        const b = this.state, u = activeUnit(b), ready = b.phase === 'ready', over = b.phase === 'over';
        this.renderQuickItems();
        this.$('battle-tools').innerHTML = `<button data-action="team-panel" class="icon-button compact-tool" aria-controls="team-panel" aria-expanded="${this.$('team-panel').classList.contains('mobile-open')}" aria-label="小队与单位情报" title="小队与单位情报">${icon('shield', 16)}</button><button data-action="timeline-panel" class="icon-button compact-tool" aria-controls="initiative-panel" aria-expanded="${this.$('initiative-panel').classList.contains('mobile-open')}" aria-label="行动序列与战况" title="行动序列与战况">${icon('swap', 16)}</button><button data-action="mode" class="mode-button ${this.mode === 'auto' ? 'is-auto' : ''}" ${over ? 'disabled' : ''} aria-pressed="${this.mode === 'auto'}" aria-label="${this.mode === 'auto' ? '自动战斗中，点击手动接管' : '开启自动战斗'}" title="${this.mode === 'auto' ? '自动战斗中 / 手动接管' : '开启自动战斗'}">${icon(this.mode === 'auto' ? 'pause' : 'auto', 16)}<span>${this.mode === 'auto' ? '手动接管' : '自动战斗'}</span></button><button data-action="help" class="icon-button" aria-label="战斗帮助" title="战斗帮助">${icon('help', 16)}</button>`;
        this.root.querySelector('.panel-count')!.textContent = String(b.units.filter(t => t.team === 'ally').length).padStart(2, '0');
        const count = (team: string) => b.units.filter(t => t.team === team && t.hp > 0).length;
        this.$('survivors').innerHTML = `<div class="survivors"><span class="ally">${icon('shield', 13)} ${count('ally')}<small>我方</small></span><b>/</b><span class="enemy">${icon('sword', 13)} ${count('enemy')}<small>敌方</small></span></div>`;
        this.$('round-label').textContent = ready ? '部署中' : `第 ${b.round} 轮`;
        const queue = ready ? [...b.units].sort((a, c) => c.speed - a.speed || a.order - c.order) : [u, ...b.queue.map(id => b.units.find(t => t.id === id))].filter((t): t is Unit => !!t && t.hp > 0);
        this.$('turn-track').innerHTML = queue.map((t, i) => `<button data-action="inspect" data-id="${t.id}" class="turn-unit ${t.team} ${!ready && i === 0 ? 'current' : ''} ${this.inspectedId === t.id ? 'inspected' : ''}" aria-label="查看${esc(t.name)}，生命${t.hp}/${t.maxHp}"><span class="turn-order">${String(i + 1).padStart(2, '0')}</span>${portrait(t)}<span class="turn-name">${esc(t.name)}<small>${!ready && i === 0 ? '行动中' : t.team === 'ally' ? '我方' : '敌方'}</small></span>${!ready && i === 0 ? '<i class="acting-dot"></i>' : ''}</button>`).join('');
        const hpColor = (t: Unit) => t.hp / t.maxHp <= .25 ? '#e5484d' : t.hp / t.maxHp <= .5 ? '#ffc53d' : '#3dd68c';
        this.$('team-roster').innerHTML = b.units.filter(t => t.team === 'ally').map(t => `<button data-action="inspect" data-id="${t.id}" class="roster-unit ${this.inspectedId === t.id ? 'selected' : ''} ${t.hp <= 0 ? 'fallen' : ''}" aria-label="查看${esc(t.name)}，生命${t.hp}/${t.maxHp}，护甲${t.armor}/${t.maxArmor}"><span class="roster-avatar">${portrait(t)}</span><span class="roster-copy"><span class="roster-name">${esc(t.name)}<small>Lv.${t.progression.level}</small></span><span class="roster-health"><i style="width:${t.hp / t.maxHp * 100}%;background:${hpColor(t)}"></i></span><span class="roster-armor" aria-hidden="true"><i style="width:${t.maxArmor ? t.armor / t.maxArmor * 100 : 0}%"></i></span><span class="roster-resources"><b>${t.hp}<small>/${t.maxHp}</small></b><span>${icon('shield', 12)} ${t.armor}</span><span class="mana-value">MP ${t.mp}</span></span></span>${u?.id === t.id ? '<i class="acting-dot"></i>' : ''}</button>`).join('');
        this.$('threat-toggle').innerHTML = `${icon('eye', 14)} ${this.threat ? '隐藏威胁' : '显示威胁'}`;
        this.$('threat-toggle').setAttribute('aria-pressed', String(this.threat));
        this.$('grid-toggle').innerHTML = `${icon('grid', 14)} <span>${this.showGrid ? '隐藏格线' : '显示格线'}</span>`;
        this.$('grid-toggle').setAttribute('aria-pressed', String(this.showGrid));
        this.renderBoard();
        this.renderFeedback();
        const inspected = this.inspected();
        const resource = (name: string, value: number, max: number, css: string) => `<div class="detail-resource ${css}"><span>${name}<strong>${value}<small>/${max}</small></strong></span><i><b style="width:${max ? value / max * 100 : 0}%"></b></i></div>`;
        this.$('console-status').innerHTML = `<span><i class="status-dot ${u?.team === 'enemy' ? 'red' : ''}"></i>${ready ? '部署阶段' : over ? '战斗结束' : `第 ${b.round} 轮 / ${u ? esc(u.name) : ''}`}<small>${ready ? '开战前自由配置' : this.busy ? '动作结算中' : this.quickItem ? '道具选择已暂停' : u?.team === 'enemy' ? '敌方行动中' : this.mode === 'auto' ? '自动行动中' : '你的行动'}</small></span><span class="console-budget">${ready || over ? '' : `<b class="${b.moved ? 'spent' : ''}">移动 ${b.moved ? '●' : '○'}</b><b class="${b.acted ? 'spent' : ''}">行动 ${b.acted ? '●' : '○'}</b>`}</span>`;
        this.$('unit-detail').innerHTML = `<button data-action="details" class="console-portrait" aria-label="查看${esc(inspected.name)}完整属性">${portrait(inspected)}<span>${inspected.team === 'ally' ? '我方' : '敌方'} / ${esc(inspected.name)}</span><i>${inspected.reaction ? '◆' : '◇'}</i></button><div class="console-stats"><div class="console-name"><strong>${esc(inspected.name)} <span class="level-chip">Lv.${inspected.progression.level}</span></strong><small>${u?.id === inspected.id ? '当前行动者' : '正在查看'} <button data-action="details" aria-label="完整属性">${icon('gear', 13)}</button></small></div><div class="resources">${resource('HP', inspected.hp, inspected.maxHp, 'hp')}${resource('甲', inspected.armor, inspected.maxArmor, 'armor')}${resource('MP', inspected.mp, inspected.maxMp, 'mp')}</div><div class="detail-bottom"><span>预估战力 <b>${estimatedPower(inspected)}</b><br>攻 ${inspected.attack} / 法 ${inspected.spellPower} / 移 ${inspected.move}</span></div></div>`;
        this.$('recent-log').innerHTML = b.logs.length ? b.logs.slice(-3).map((line, i) => `<p class="log-entry"><span>${String(Math.max(1, b.logs.length - 2) + i).padStart(2, '0')}</span>${esc(line)}</p>`).join('') : '<div class="log-empty">尚未交战</div>';
        if (ready) {
            this.$('controls').innerHTML = `<div class="ready-actions deployment-actions"><button data-action="gear" class="button secondary">${icon('shield')} 装备</button><button data-action="equip" class="button secondary">${icon('spark')} 技能</button><button data-action="start" class="button primary" ${!this.loaded ? 'disabled' : ''}>进入战斗 ${icon('arrow')}</button></div>`;
            return;
        }
        if (over && this.options.onComplete) { this.$('controls').innerHTML = '<button data-action="continue" class="button primary full">' + (b.result === 'victory' ? '继续冒险' : '查看结果') + '</button>'; return; }
        if (over) { this.$('controls').innerHTML = `<button data-action="restart" class="button primary full">${icon('swap')} 重新部署</button>`; return; }
        if (this.quickItem && !this.busy) {
            this.$('controls').innerHTML = '<div class="quick-use-actions"><span>' + esc(EQUIPMENT[this.quickItem].name) + '<small>点选高亮目标立即使用</small></span><button data-action="quick-cancel" class="button secondary">取消并恢复</button></div>'; return;
        }
        const manual = this.mode === 'manual' && u?.team === 'ally' && !this.busy;
        if (this.selection && manual) {
            const valid = !!this.to || !!this.targetId;
            this.$('controls').innerHTML = `<div class="ready-actions"><button data-action="cancel" class="button secondary">${icon('close')} 取消</button><button data-action="confirm" class="button primary" ${!valid ? 'disabled' : ''}>${icon('check')} ${this.selection === 'move' ? '确认移动' : '确认行动'}</button></div>`;
        } else {
            const button = (action: string, label: string, image: string, disabled: boolean, sub: string) => `<button data-action="${action}" class="action-button" ${disabled ? 'disabled' : ''}>${icon(image, 19)}<span>${label}<small>${sub}</small></span></button>`;
            const moveDisabled = !manual || b.moved || !u || paths(b, u).size <= 1;
            const attackDisabled = (id: string) => !manual || b.acted || !u || !targets(b, u, skillById(id)!).length;
            this.$('controls').innerHTML = `<div class="main-attacks">${button('melee', '近战', 'sword', attackDisabled('melee'), '射程 1')}${button('ranged', '远程', 'bow', attackDisabled('ranged'), '射程 2–3')}</div><div class="support-actions">${button('move', '移动', 'move', moveDisabled, b.moved ? '已使用' : `${u?.move || 0} 格`)}${button('skills', '技能', 'spark', !manual || b.acted, `${u?.skills.length || 0} 个`)}</div><div class="secondary-actions"><button data-action="items" class="text-button" ${this.busy || b.phase!=='battle' ? 'disabled' : ''}>道具</button><button data-action="disengage" class="text-button" ${!manual || b.acted || b.moved ? 'disabled' : ''} title="消耗主动行动，安全脱离近战范围">${icon('shield', 13)} 脱离</button><button data-action="end" class="end-button" ${!manual ? 'disabled' : ''}>结束 ${icon('arrow', 13)}</button></div>`;
        }
    }
    private renderBoard() {
        if (!this.loaded || this.busy) return;
        const b = this.state, u = activeUnit(b); let moves: Point[] = [], range: Point[] = [], targetIds: string[] = [], path: Point[] = [], danger: Point[] = [], effectIds: string[] = [];
        if (u && this.selection === 'move' && !b.moved) {
            const map = paths(b, u); moves = [...map.keys()].map(k => { const [x, y] = k.split(',').map(Number); return { x, y }; }).filter(p => !same(p, u));
            if (this.to) { path = map.get(`${this.to.x},${this.to.y}`) || []; danger = pathRisk(b, u, path); }
        } else if (u && this.selection?.startsWith('item:')) {
            targetIds = itemTargets(b, u, this.selection.slice(5)).map(t => t.id);
            range = b.units.filter(t => targetIds.includes(t.id)).map(t => ({ x: t.x, y: t.y }));
        } else if (u && this.selection) {
            const skill = skillById(this.selection);
            if (skill) {
                for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const p = { x, y }, d = distance(u, p); if (!blocked(p) && d >= skill.min && d <= skill.max && visible(u, p)) range.push(p); }
                targetIds = targets(b, u, skill).map(t => t.id);
                const target = this.to ? areaTarget(u, this.to) : b.units.find(t => t.id === this.targetId); if (target) effectIds = affected(b, target, skill).map(t => t.id);
            }
        }
        const threat: Point[] = [];
        if (this.threat) {
            const seen = new Set<string>();
            for (const enemy of b.units.filter(t => t.hp > 0 && t.team === 'enemy')) for (const walk of paths(b, enemy).values()) {
                const from = walk.length ? walk[walk.length - 1] : enemy;
                for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
                    const p = { x, y }, d = distance(from, p), k = `${x},${y}`;
                    if (d >= 1 && d <= 3 && !blocked(p) && visible(from, p) && !seen.has(k)) { seen.add(k); threat.push(p); }
                }
            }
        }
        const effectCells = u && this.to && this.selection && skillById(this.selection) ? areaCells(this.to, skillById(this.selection)!) : [];
        this.scene.draw({ effectCells, battle: clone(b), inspectedId: this.inspectedId, moves, range, targetIds, path, effectIds, danger, threat, showGrid: this.showGrid, rangeKind: this.selection === 'melee' || this.selection === 'ranged' ? 'attack' : 'skill' });
    }
    private renderFeedback() {
        let html = '', danger = false;
        const b = this.state, u = activeUnit(b);
        if (this.notice) html = `${icon(this.busy ? 'bolt' : 'help', 16)}<span>${esc(this.notice)}${this.busy && this.mode === 'manual' && u?.team === 'ally' ? ' / 本次动作后手动接管' : ''}</span>`;
        else if (b.phase === 'ready') html = `${icon('spark', 17)}<span>没有职业限制。点选角色，配置属于你的打法。</span>`;
        else if (this.selection?.startsWith('item:') && u) {
            const itemId = this.selection.slice(5), target = this.to ? areaTarget(u, this.to) : b.units.find(t => t.id === this.targetId);
            html = '<span>' + esc(EQUIPMENT[itemId].name) + (target ? ' → ' + esc(target.name) + (itemId === 'contract' ? ' / 成功率 ' + Math.round(captureChance(target) * 100) + '%' : '') : ' / 选择全场目标') + (itemId === 'contract' && (this.options.partySize?.() || b.units.filter(t => t.team === 'ally').length) + (b.captured?.length || 0) >= 10 ? '<small>队伍已满，收服后需在战后遣散非主角团成员</small>' : '') + '</span>';
        }
        else if (this.selection === 'move' && this.to && u) {
            const path = paths(b, u).get(`${this.to.x},${this.to.y}`) || []; const risks = pathRisk(b, u, path); danger = !!risks.length;
            html = `${icon(risks.length ? 'bolt' : 'move', 17)}<span>移动 ${path.length} 格${risks.length ? ` / ${risks.length} 次借机风险，命中将停步` : ' / 无借机风险'}<small>确认后消耗本次移动机会</small></span>`;
        } else if (this.selection && (this.targetId || this.to) && u) {
            const skill = skillById(this.selection), target = b.units.find(t => t.id === this.targetId);
            if (skill && target) {
                const lines = affected(b, target, skill).map(t => {
                    if (skill.effect !== 'damage') return `${esc(t.name)} / ${skill.effect === 'heal' ? 'HP' : '护甲'} +${Math.min(power(u, skill), skill.effect === 'heal' ? t.maxHp - t.hp : t.maxArmor - t.armor)}`;
                    const loss = losses(t, power(u, skill), skill.piercing);
                    return `${esc(t.name)} / 命中 ${Math.round(hitChance(u, t, skill) * 100)}% / 甲 −${loss.armor} / HP −${loss.hp}${loss.hp >= t.hp ? ' / 可击倒' : ''}`;
                });
                html = `${icon(skill.icon, 17)}<span>${esc(skill.name)} / ${skill.mp} MP<small>${lines.join('<br>')}${skill.piercing ? '<br>穿透：完全绕过护甲' : ''}</small></span>`;
            }
        } else if (this.selection) html = `${icon(this.selection === 'move' ? 'move' : 'spark', 17)}<span>${this.selection === 'move' ? '点选蓝色格子预览路径' : '点选高亮范围内的合法目标'}<small>确认前不会扣除任何资源</small></span>`;
        else html = `${icon('shield', 17)}<span>${u?.team === 'enemy' ? '敌方正在决策，随时可以查看角色与记录。' : this.mode === 'auto' ? '自动作战中，可随时点击顶部按钮接管。' : b.disengaged ? '脱离已生效，本次移动不会触发借机攻击。' : '先选行动，再选目标。离开近战范围可能遭到截停。'}</span>`;
        const feedback = this.$('feedback');
        const shown = !!this.selection || !!this.notice;
        feedback.hidden = !shown;
        feedback.innerHTML = html;
        feedback.title = feedback.textContent || '';
        feedback.classList.toggle('danger', danger);
        this.$('console-status').classList.toggle('has-feedback', shown);
    }
    private openModal(type: Modal) {
        if (this.busy || !type) return;
        this.clearTimer(); this.modalReturn = document.activeElement as HTMLElement;
        this.modal = type; this.renderModal(); this.dialog().showModal();
    }
    private closeModal(resume = true) {
        if(this.modal==='revive'){this.quickItem=null;this.pendingQuickItem=null;this.reviveTargetId=null;this.resetSelection();}
        this.inventory?.dispose(); this.inventory = undefined;
        this.dialog().close(); this.modal = null; this.notice = '';
        if (this.modalReturn?.isConnected) this.modalReturn.focus();
        if (resume){this.render();this.schedule();}
    }
    private renderModal() {
        this.inventory?.dispose(); this.inventory = undefined;
        const type = this.modal, b = this.state, u = this.inspected(), active = activeUnit(b);
        this.dialog().dataset.view = type || '';
        let title = '', content = '';
        if (type === 'help') {
            title = 'TIPS / 战斗手册';
            content = `<div class="prose"><h3>一张卡牌，一种可能</h3><p>无职业限制，开战前为每人自由选择三个独立技能。每次行动可以移动一次，并使用一次攻击、技能或脱离，顺序不限。</p><h3>护甲不是减伤</h3><p>普通伤害80%由护甲承担，20%进入HP；护甲不够时，剩余伤害全部进入HP。法术也遵循此规则，只有穿透技能完全绕甲。</p><h3>不要随意背对敌人</h3><p>离开敌方四邻近战范围时，对方每轮可借机攻击一次。命中会截停移动。先使用“脱离”可以安全撤退，但会消耗本次主动行动。</p><h3>随时接管</h3><p>操作栏切换手动/自动。已提交动作执行完后接管，不回滚已发生的结果。离开页面时暂停后续动作。</p><h3>快捷键</h3><p>M移动 / A近战 / R远程 / S技能 / E结束 / Enter确认 / Esc取消。手机直接点选即可，无需悬停。</p><p class="muted">战斗中不能撤退。HP、MP与护甲跨场保留，路线撤离节点也算通关。刷新会结束本局。</p></div>`;
            content = gameTipsHtml() + content;
        } else if (type === 'logs') {
            title = '战斗记录'; content = `<ol class="log-list">${[...b.logs].reverse().map(s => `<li>${esc(s)}</li>`).join('')}</ol>`;
        } else if (type === 'details') {
            title = u.name + ' / 角色详情';
            content = renderCharacterDetails(u, { editable: !this.options.onComplete && b.phase === 'ready' && u.team === 'ally', portraitUrl: characterImage(u), skillsHtml: u.skills.map(id => this.skillCard(skillById(id)!, u, false)).join('') });
        } else if (type === 'gear') {
            title = '装备与行囊';
            const owner = u.team === 'ally' ? u : b.units.find(t => t.team === 'ally')!;
            this.inspectedId = owner.id;
            content = '<nav class="equip-units inventory-owners" aria-label="切换队员">' + b.units.filter(t => t.team === 'ally').map(t => '<button data-action="equip-unit" data-id="' + t.id + '" aria-label="配置' + esc(t.name) + '的装备" class="' + (owner.id === t.id ? 'selected' : '') + '">' + portrait(t) + '<span>' + esc(t.name) + '</span></button>').join('') + '</nav><div id="inventory-owner-summary">' + this.gearSummary(owner) + '</div><div id="equipment-inventory"></div>';
        } else if (type === 'skills' && active) {
            title = `${active.name} / 选择技能`; content = active.skills.map(id => this.skillCard(skillById(id)!, active, true)).join('');
        } else if (type === 'equip') {
            title = '本场技能配置';
            const editable = u.team === 'ally' ? u : b.units.find(t => t.team === 'ally')!;
            if (u.team !== 'ally') this.inspectedId = editable.id;
            content = `<p class="modal-intro">只能配置已掌握的技能，学习不受职业限制，开战后锁定。</p><div class="equip-units">${b.units.filter(t => t.team === 'ally').map(t => `<button data-action="equip-unit" data-id="${t.id}" class="${editable.id === t.id ? 'selected' : ''}">${portrait(t)}<span>${esc(t.name)}</span></button>`).join('')}</div><div class="equip-slots">${editable.skills.map((id, slot) => `<label><span>技能槽 ${slot + 1}</span><select data-slot="${slot}" aria-label="${esc(editable.name)}的技能槽${slot + 1}">${EQUIPPABLE.filter(s => learnedSkills(editable).includes(s.id)).map(s => `<option value="${s.id}" ${id === s.id ? 'selected' : ''} ${editable.skills.some((other, i) => other === s.id && i !== slot) ? 'disabled' : ''}>${s.name} / ${s.mp}MP</option>`).join('')}</select><small>${esc(skillById(id)!.description)}</small></label>`).join('')}</div><p class="muted">攻击 ${editable.attack} / 法强 ${editable.spellPower} / 近命 ${editable.meleeHit}% / 远命 ${editable.rangedHit}%</p><button data-action="close" class="button primary full">${icon('check')} 完成配置</button>`;
        } else if (type === 'items') {
            title = '团队道具';
            content = [...new Set(b.stock)].filter(id=>EQUIPMENT[id]?.slot==='consumable').map(id => '<button data-action="use-item" data-id="' + id + '" class="button secondary full" ' + '' + '>' + esc(EQUIPMENT[id].name) + ' / ' + esc(consumableDescription(EQUIPMENT[id])) + '</button>').join('') || '<p class="muted">团队物资库没有消耗品</p>';
        }else if(type==='revive'){
            title='使用复苏石';const fallen=b.units.filter(u=>u.team==='ally'&&u.hp===0);
            content='<p class="modal-intro">选择倒下的队友，消耗1枚团队复苏石，以20%最大生命和满魔力复活，护甲为0，下轮加入行动。</p><div class="revive-targets">'+fallen.map(t=>'<button data-action="revive-target" data-id="'+t.id+'" class="revive-target '+(this.reviveTargetId===t.id?'selected':'')+'" aria-pressed="'+(this.reviveTargetId===t.id)+'">'+portrait(t)+'<span>'+esc(t.name)+'<small>HP '+Math.max(1,Math.ceil(t.maxHp*.2))+'/'+t.maxHp+' / MP '+t.maxMp+'/'+t.maxMp+'</small></span></button>').join('')+'</div><div class="dialog-actions"><button data-action="close" class="button secondary">取消</button><button data-action="revive-confirm" class="button primary" '+(!this.reviveTargetId||!b.stock.includes('revival-stone')?'disabled':'')+'>确认复活</button></div>';
        } else if (type === 'end') {
            title = '结束本次行动？'; content = `<p class="modal-intro">将放弃${!b.moved ? '剩余移动机会' : ''}${!b.moved && !b.acted ? '与' : ''}${!b.acted ? '剩余主动行动' : ''}，轮到下一位。</p><div class="dialog-actions"><button data-action="close" class="button secondary">继续操作</button><button data-action="end-confirm" class="button primary">结束行动</button></div>`;
        } else if (type === 'result') {
            title = b.result === 'victory' ? '战场已肃清' : b.result === 'defeat' ? '此战失利' : '已撤离战场';
            content = `<div class="result-emblem">${icon(b.result === 'victory' ? 'spark' : 'shield', 52)}</div><p class="result-subtitle">${b.result === 'victory' ? 'VICTORY' : b.result === 'defeat' ? 'DEFEAT' : 'RETREATED'}</p><p class="modal-intro">第 ${b.round} 轮 / 我方存活 ${b.units.filter(t => t.team === 'ally' && t.hp > 0).length} / ${b.units.filter(t => t.team === 'ally').length}</p><p class="muted">重新部署恢复资源与战斗随机种子，保留等级、潜力、加点和技能。</p><button data-action="restart" class="button primary full">${icon('swap')} 重新部署</button>`;
        }
        if (type === 'result' && this.options.onComplete) {
            title = b.result === 'victory' ? '战斗胜利' : 'Game Over';
            content = '<div class="result-emblem">' + icon(b.result === 'victory' ? 'spark' : 'shield', 52) + '</div><p class="modal-intro">第' + b.round + '轮 / 我方存活' + b.units.filter(t => t.team === 'ally' && t.hp > 0).length + '</p><button data-action="continue" class="button primary full">' + (b.result === 'victory' ? '继续冒险' : '查看结果') + '</button>';
        }
        if (type === 'details' && u.team === 'ally') content += '<label class="policy-control">行动方针<select data-policy>' + Object.entries(POLICIES).map(([id, name]) => '<option value="' + id + '" ' + ((u.policy || 'damage') === id ? 'selected' : '') + '>' + name + '</option>').join('') + '</select></label>';
        this.$('dialog-content').innerHTML = `<div class="dialog-header"><div><span class="eyebrow">BATTLE ARCHIVE</span><h2 id="dialog-title">${esc(title)}</h2></div>${type !== 'result' ? `<button data-action="close" class="icon-button" aria-label="关闭">${icon('close')}</button>` : ''}</div><div class="dialog-body">${content}</div>`;
        if (type === 'gear') {
            const owner = this.inspected();
            this.inventory = new EquipmentInventory(this.$('equipment-inventory'), {
                stockLimit:b.stockLimit, stockCounts:Object.fromEntries(b.stock.map(id=>[id,b.stock.filter(item=>item===id).length])), attributes: owner.progression.attributes, equipment: owner.equipment, artifacts: owner.artifacts,
                items:Object.values(EQUIPMENT).filter(item=>b.stock.includes(item.id)||owner.artifacts.includes(item.id)||Object.values(owner.equipment).includes(item.id)), editable: b.phase === 'ready' && owner.team === 'ally'
            }, change => {
                const next = configureEquipment(this.state, owner.id, change.equipment, change.artifacts);
                if (next === this.state) return false;
                if (this.options.onEquipment && !this.options.onEquipment(owner.id, change.equipment, change.artifacts)) return false;
                this.state = next; this.render();
                const current = this.state.units.find(unit => unit.id === owner.id)!;
                this.$('inventory-owner-summary').innerHTML = this.gearSummary(current);
                return true;
            });
        }
        this.$('dialog-content').querySelectorAll<HTMLElement>('[data-action="equip-unit"]').forEach(button => button.addEventListener('click', event => {
            event.stopPropagation(); this.inspectedId = button.dataset.id!; this.render(); this.renderModal();
        }));
    }
    private gearSummary(u: Unit): string {
        return '<div class="inventory-owner-summary"><strong>' + esc(u.name) + '</strong><span>战力 <b>' + estimatedPower(u) + '</b><small>裸 ' + nakedPower(u) + ' / 装备 +' + equipmentValue(u) + '</small></span></div>';
    }
    private skillCard(s: Skill, u: Unit, interactive: boolean) {
        const usable = !this.state.acted && u.mp >= s.mp && skillAims(this.state, u, s).length > 0;
        const tag = s.effect === 'heal' ? '治疗' : s.piercing ? '穿透' : '普通';
        return `<${interactive ? 'button' : 'div'} class="skill-card" ${interactive ? `data-action="skill" data-id="${s.id}" ${usable ? '' : 'disabled'}` : ''}><span class="skill-icon">${icon(s.icon, 25)}</span><span class="skill-copy"><strong>${esc(s.name)} <small>${tag}</small></strong><span>${esc(s.description)}</span><small>强度 ${power(u, s)} / 射程 ${s.min}–${s.max}${interactive && !usable ? ` / ${u.mp < s.mp ? 'MP不足' : '暂无合法目标'}` : ''}</small></span><b>${s.mp}<small>MP</small></b></${interactive ? 'button' : 'div'}>`;
    }
    private keydown(event: KeyboardEvent) {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || this.modal) return;
        if (event.key === 'Escape') { if (this.quickItem || this.pendingQuickItem) this.cancelQuickItem(); else { this.resetSelection(); this.render(); } return; }
        if (this.quickItem || this.pendingQuickItem) return;
        if (!this.manual()) return;
        const keys: Record<string, string> = { m: 'move', a: 'melee', r: 'ranged', s: 'skills', e: 'end', Enter: 'confirm' };
        const action = keys[event.key] || keys[event.key.toLowerCase()];
        if (action) { event.preventDefault(); if (!event.repeat) this.handle(action); }
    }
}









