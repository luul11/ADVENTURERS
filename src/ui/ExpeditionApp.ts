import { renderBaseScene, bindBaseScene } from './BaseScene';
import { BattleApp } from './BattleApp';
import { StockTransfer } from './StockTransfer';
import { packedSupplies, upgradeStorage, trainMember, trainingOffer } from '../battle/base';
import { storageCapacity, stockUsage, STORAGE_LEVELS, transferStock } from '../battle/storage';
import { itemIcon } from './itemPresentation';
import { EquipmentInventory } from './EquipmentInventory';
import { HeroId, DEFAULT_HERO_IDS } from '../battle/roster';
import { POLICIES, Policy, Unit, clone } from '../battle/engine';
import { EQUIPMENT, PRIMARY_STATS, PrimaryStat, bagCapacity, restorationError, consumableDescription } from '../battle/progression';
import { characterImage } from '../battle/characterArt';
import { Expedition, NodeKind, NODE_NAMES, SHOP, createExpedition, normalizeTeamInventory, availableNodes, enterNode, settleBattle, resolveNode, resolveEvent, eventChoices, collectLoot, moveLootItem, sellValuables, buyItem, equipMember, carriedItems, useCampItem, dismissRecruit, setPolicy } from '../battle/expedition';
import { DUNGEONS, DungeonId, getDungeon, getEvent, getEncounter, getHumanEncounter } from '../battle/dungeonConfig';
import { icon } from './icons';
import './ExpeditionApp.css';
import { gameTipsHtml } from './GameTips';
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const nodeIcons: Record<NodeKind, string> = { battle: 'sword', elite: 'bolt', boss: 'flame', rest: 'heart', event: 'spark', shop: 'bag', extract: 'arrow', human: 'shield' };
export interface ExpeditionOptions { base?: boolean; initialRun?: Expedition; onEnter?: (prepared: Expedition, dungeonId: DungeonId) => void; onChange?: (prepared: Expedition) => void; onFinish?: (finished: Expedition) => void }
export class ExpeditionApp {
    private run: Expedition;
    private battle?: BattleApp;
    private inventory?: EquipmentInventory;
    private transfer?: StockTransfer;
    private events = new AbortController();
    private ownerId: string;
    private notice = '';
    private resultReported = false;
    private basePanel: 'roster' | 'departure' | 'logistics' | null = null;
    private baseSceneCleanup?: () => void;
    private selectedDungeon: DungeonId = 'suburban-road';
    private mobileView: 'route' | 'party' = 'route';
    constructor(private root: HTMLElement, private heroes: readonly HeroId[] = DEFAULT_HERO_IDS, private onRestart?: (finished: Expedition) => void, private options: ExpeditionOptions = {}) {
        this.run = normalizeTeamInventory(options.initialRun ? clone(options.initialRun) : createExpedition(heroes)); this.ownerId = this.run.party[0].id; this.selectedDungeon = this.run.dungeonId; if(['loot','overcrowded'].includes(this.run.stage))this.mobileView='party';
        root.addEventListener('click', event => {
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-exp-action]');
            if (button && !button.disabled) this.action(button.dataset.expAction!, button.dataset.id);
        }, { signal: this.events.signal });
        root.addEventListener('change', event => {
            const select = event.target as HTMLSelectElement;
            if (select.matches('[data-packed-gold]')) { const n=Number(select.value);this.run.packedGold=Number.isInteger(n)?Math.max(0,Math.min(this.run.gold,n)):0;select.value=String(this.run.packedGold);this.options.onChange?.(clone(this.run));return; }
            if (select.matches('[data-training-owner]')) { this.ownerId=select.value;this.renderTraining();return; }
            if (select.matches('[data-equipment-owner]')) { this.ownerId = select.value; this.renderEquipment(); return; }
            if (select.matches('[data-exp-policy]') && Object.prototype.hasOwnProperty.call(POLICIES, select.value)) { this.run = setPolicy(this.run, select.dataset.expPolicy!, select.value as Policy); this.options.onChange?.(clone(this.run)); }
        }, { signal: this.events.signal });
        this.render();
    }
    dispose() { this.baseSceneCleanup?.(); this.events.abort(); this.inventory?.dispose(); this.transfer?.dispose(); this.battle?.dispose(); }
    private action(action: string, id?: string) {
        try {
            this.notice = '';
            if(this.options.base&&['base-roster','base-departure','base-logistics'].includes(action)){this.basePanel=action==='base-roster'?'roster':action==='base-departure'?'departure':'logistics';this.renderBasePanel();this.root.querySelector<HTMLDialogElement>('#base-panel-dialog')?.showModal();return;}
            if(action==='base-panel-close'){const previous=this.basePanel;this.basePanel=null;this.root.querySelector<HTMLDialogElement>('#base-panel-dialog')?.close();this.root.querySelector<HTMLButtonElement>('[data-exp-action="'+(previous==='departure'?'base-departure':previous==='logistics'?'base-logistics':'base-roster')+'"]')?.focus({preventScroll:true});return;}
            if(action==='base-pan-left'||action==='base-pan-right'){const pan=this.root.querySelector<HTMLElement>('.base-panorama');pan?.scrollBy({left:(action==='base-pan-left'?-1:1)*(pan.clientWidth*.65),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});return;}
            if(action==='loot-collect'){ if(this.run.lastLoot?.items.length){this.root.querySelector<HTMLDialogElement>('#loot-leave-dialog')?.showModal();return;} action='loot-finish'; }
            if(action==='loot-finish'){this.run=collectLoot(this.run);this.mobileView=this.run.stage==='overcrowded'?'party':'route';this.render();return;}
            if(action==='loot-stay'){this.root.querySelector<HTMLDialogElement>('#loot-leave-dialog')?.close();return;}
            if(action==='upgrade-storage'&&this.options.base){this.run=upgradeStorage(this.run);this.render();return;}
            if(action==='train-open'&&this.options.base){this.renderTraining();this.root.querySelector<HTMLDialogElement>('#base-training-dialog')?.showModal();return;}
            if(action==='train-close'){this.root.querySelector<HTMLDialogElement>('#base-training-dialog')?.close();this.render();this.root.querySelector<HTMLButtonElement>('[data-exp-action="train-open"]')?.focus({preventScroll:true});return;}
            if(action==='train'&&id&&this.options.base){try{this.run=trainMember(this.run,this.ownerId,id as PrimaryStat);this.notice='';}catch(e){this.notice=(e as Error).message;}this.options.onChange?.(clone(this.run));this.renderTraining();return;}
            if(action==='pack-open'&&this.options.base){this.openPacking();return;}
            if(action==='pack-close'){this.root.querySelector<HTMLDialogElement>('#base-packing-dialog')?.close();this.transfer?.dispose();this.transfer=undefined;this.render();this.root.querySelector<HTMLButtonElement>('[data-exp-action="pack-open"]')?.focus({preventScroll:true});return;}
            if(action==='sell-valuables'){this.run=sellValuables(this.run);this.options.onChange?.(clone(this.run));this.renderEquipment();return;}
            if (action === 'select-dungeon' && this.options.base && DUNGEONS.some(d=>d.id===id)) { this.selectedDungeon=id as DungeonId;this.run.dungeonId=this.selectedDungeon;this.render();return; }
            if (action === 'event-choice' && id) { this.run=resolveEvent(this.run,id);if(this.run.stage==='battle'){this.launchBattle();return;}this.mobileView=['node','loot','overcrowded'].includes(this.run.stage)?'party':'route';this.render();return; }
            if (action === 'enter-dungeon' && this.options.onEnter) { this.run.packedStock=packedSupplies(this.run); const prepared = clone(this.run); this.dispose(); this.options.onEnter(prepared, this.selectedDungeon); return; }
            if (action === 'tips') { this.root.querySelector<HTMLDialogElement>('#exp-tips-dialog')?.showModal(); return; }
            if (action === 'tips-close') { this.root.querySelector<HTMLDialogElement>('#exp-tips-dialog')?.close(); return; }
            if (action === 'equipment') { this.openEquipment(); return; }
            if (action === 'equipment-close') { this.closeEquipment(); return; }
            if (action === 'view-route' || action === 'view-party') { this.mobileView = action === 'view-route' ? 'route' : 'party'; this.render(); return; }
            if (action === 'node' && id && !this.options.base) this.run = enterNode(this.run, id);
            else if (action === 'rest' || action === 'revive' || action === 'blessing' || action === 'supplies' || action === 'leave') this.run = resolveNode(this.run, action);
            else if (action === 'buy' && id) this.run = buyItem(this.run, id);
            else if (action === 'member' && id) { this.ownerId = id; if(this.options.base)this.basePanel='roster'; }
            else if (action === 'dismiss' && id) this.run = dismissRecruit(this.run, id);
            else if (action === 'camp-item' && id) {
                const [item, target] = id.split('|');
                this.run = useCampItem(this.run,null,item,target);
            } else if (action === 'restart') {
                if (!['won', 'lost'].includes(this.run.stage)) return;
                this.dispose(); if(this.onRestart) this.onRestart(clone(this.run)); else new ExpeditionApp(this.root, this.heroes); return;
            }
            if (this.run.stage === 'battle') { if (!this.battle) this.launchBattle(); return; }
            if (this.run.stage === 'loot' || this.run.stage === 'overcrowded') this.mobileView = 'party';
            else if (action === 'node' && this.run.stage === 'node') this.mobileView = 'party';
            else if (['rest', 'revive', 'blessing', 'supplies', 'leave'].includes(action)) this.mobileView = 'route';
            this.render();
        } catch (error) { this.notice = error instanceof Error ? error.message : '操作失败'; this.render(); }
    }
    private launchBattle() {
        this.inventory?.dispose(); this.inventory = undefined;
        this.battle = new BattleApp(this.root, this.heroes, {
            battle: this.run.battle!, stock: () => this.run.stock, partySize: () => this.run.party.length,
            onEquipment: (id, equipment, artifacts) => {
                try { this.run = equipMember(this.run, id, equipment, artifacts); return true; }
                catch (error) { this.notice = error instanceof Error ? error.message : '装备失败'; return false; }
            },
            onComplete: result => { this.battle = undefined; this.run = settleBattle(this.run, result); if (this.run.stage === 'overcrowded'||this.run.stage==='loot') this.mobileView = 'party'; this.render(); }
        });
    }
    private route() {
        const available = availableNodes(this.run), visited = this.run.visited;
        const layers=getDungeon(this.run.dungeonId).layers.length;
        const x = (lane: number) => 80 + lane * 140, y = (depth: number) => 58 + depth * (624 / Math.max(1,layers-1));
        return `<div class="route-map-viewport" tabindex="0" aria-label="副本路线滚动区域"><div class="route-map" style="min-height:${Math.max(440,(layers-1)*70+100)}px" aria-label="副本路线"><svg class="route-links" viewBox="0 0 440 740" preserveAspectRatio="none" aria-hidden="true">${this.run.nodes.flatMap(n => n.next.map(id => { const t = this.run.nodes.find(v => v.id === id)!; return `<path d="M ${x(n.lane)} ${y(n.depth)} L ${x(t.lane)} ${y(t.depth)}" class="${visited.includes(n.id) && visited.includes(id) ? 'traveled' : ''}"/>`; })).join('')}</svg>${this.run.nodes.map(n => `<button data-exp-action="node" data-id="${n.id}" title="${esc(n.encounterId ? this.encounterSummary(n.encounterId) : n.eventId ? getEvent(n.eventId).title : NODE_NAMES[n.kind])}" class="route-node ${n.kind} ${available.includes(n.id) ? 'available' : ''} ${visited.includes(n.id) ? 'visited' : ''} ${this.run.current === n.id ? 'current' : ''}" style="left:${x(n.lane) / 440 * 100}%;top:${y(n.depth) / 740 * 100}%" ${available.includes(n.id) ? '' : 'disabled'} aria-label="第${n.depth + 1}层 ${NODE_NAMES[n.kind]}${visited.includes(n.id) ? '，已完成' : available.includes(n.id) ? '，可前往' : ''}">${n.kind==='human'||n.kind==='boss'?'<em class="danger-badge">DANGER</em>':''}<span>${icon(nodeIcons[n.kind], 22)}</span><b>${NODE_NAMES[n.kind]}</b></button>`).join('')}</div></div>`;
    }
    private encounterSummary(id: string): string {
        if(id.startsWith('human-')){const c=getHumanEncounter(id);return c.name+' / '+c.count+'名人类 / 等级为队伍平均±2 / DANGER';}
        const c=getEncounter(id),species={human:'流浪者',slime:'史莱姆',gremlin:'地精',goblin:'哥布林',orc:'兽人'};
        return c.name+' / 强度'+c.strength+' / '+c.groups.map(g=>(g.rank==='elite'?'精英':g.rank==='boss'?'首领':'普通')+species[g.species]+' Lv.'+g.level+' ×'+g.count).join('，')+' / '+c.reward.gold+'金币';
    }
    private departure(): string {
        const selected=getDungeon(this.selectedDungeon);
        return '<section class="base-departure"><section class="base-logistics"><div class="exp-section-heading"><h2>基地后勤</h2><span>等级 '+((this.run.storageLevel||0)+1)+'</span></div><div class="storage-upgrade">'+icon('bag',24)+'<strong>随队物资 '+storageCapacity(this.run.storageLevel)+'格<small>基地物资库不限容量</small></strong><button data-exp-action="upgrade-storage" class="button secondary" '+((this.run.storageLevel||0)>=3||this.run.gold<STORAGE_LEVELS[this.run.storageLevel||0].cost?'disabled':'')+'>'+((this.run.storageLevel||0)>=3?'已满级':'扩容 '+STORAGE_LEVELS[this.run.storageLevel||0].cost+'金币')+'</button></div><div class="base-logistics-actions"><button data-exp-action="pack-open" class="button secondary">'+icon('bag',18)+' 出发物资 <b>'+stockUsage(packedSupplies(this.run))+'/'+storageCapacity(this.run.storageLevel)+'</b></button><button data-exp-action="train-open" class="button secondary">'+icon('essence',18)+' 精华培养</button></div></section><h2>选择副本</h2><div class="dungeon-choices">'+DUNGEONS.map(d=>'<button class="dungeon-choice" data-exp-action="select-dungeon" data-id="'+d.id+'" aria-pressed="'+(d.id===this.selectedDungeon)+'"><strong>'+esc(d.name)+'</strong><span>'+esc(d.tag)+' / '+d.layers.length+'层 / '+d.layers.flat().length+'节点</span><small>'+esc(d.description)+'</small></button>').join('')+'</div><button data-exp-action="enter-dungeon" class="button primary full" aria-label="进入'+selected.name+'">进入副本 '+icon('arrow')+'</button></section>';
    }
    private nodeContent() {
        if(this.run.stage==='loot'&&this.run.lastLoot){const loot=this.run.lastLoot;return '<section class="node-content spoils-content"><div class="exp-section-heading"><h2>'+(loot.defeated?'战场搜刮':'发现物资')+'</h2><span class="spoils-gold">金币 +'+loot.gold+'</span></div><div id="loot-transfer"></div><button data-exp-action="loot-collect" class="button primary full">结束搜刮 '+icon('arrow')+'</button></section>';}

        if (this.run.stage === 'overcrowded') return `<section class="node-content"><h2>整理队伍</h2><p>当前${this.run.party.length}人。请遣散非初始主角团成员，保留最多10人后继续。</p>${this.run.party.filter(u => !u.heroId).map(u => `<button data-exp-action="dismiss" data-id="${u.id}" class="button secondary">遣散 ${esc(u.name)}</button>`).join('')}</section>`;
        if (this.run.stage !== 'node') return '';
        const kind = this.run.nodes.find(n => n.id === this.run.current)!.kind;
        if (kind === 'rest') return `<section class="node-content"><h2>篝火休息</h2><p>${getDungeon(this.run.dungeonId).restDescription}倒下队员需复活。</p><button data-exp-action="rest" class="button primary">休整后继续 ${icon('arrow')}</button></section>`;
        if (kind === 'event' && this.run.event) {
            const e=getEvent(this.run.event.id),stage=e.stages[this.run.event.stage];
            return '<section class="node-content event-content"><h2>'+esc(e.title)+'</h2><p>'+esc(stage.description||e.description)+'</p><div class="event-choices">'+eventChoices(this.run).map(({choice,disabledReason})=>'<button data-exp-action="event-choice" data-id="'+choice.id+'" class="event-choice" '+(disabledReason?'disabled':'')+'><strong>'+esc(choice.label)+'</strong><span>'+esc(choice.description)+'</span>'+(disabledReason?'<small>'+esc(disabledReason)+'</small>':'')+'</button>').join('')+'</div></section>';
        }
        if (kind === 'shop') return `<section class="node-content"><div class="exp-section-heading"><h2>行商营地</h2><button data-exp-action="leave" class="button primary">继续前进 ${icon('arrow')}</button></div><div class="shop-grid">${SHOP.map(o => `<button data-exp-action="buy" data-id="${o.id}" class="shop-item" ${this.run.gold < o.price ? 'disabled' : ''}><strong>${EQUIPMENT[o.id].name}</strong><span>${EQUIPMENT[o.id].capacity ? EQUIPMENT[o.id].capacity + '格空间' : o.id === 'contract' ? '收服普通敌人' : o.id === 'revival-stone' ? '复活倒下队员' : EQUIPMENT[o.id].restore ? consumableDescription(EQUIPMENT[o.id]) : '装备'}<b>${o.price} 金币</b></span></button>`).join('')}</div></section>`;
        return '';
    }
    private member(u: Unit) {
        return `<button data-exp-action="member" data-id="${u.id}" class="exp-member ${this.ownerId === u.id ? 'selected' : ''} ${u.hp === 0 ? 'fallen' : ''}"><img src="${characterImage(u)}" alt="" width="48" height="48"><span><strong>${esc(u.name)}</strong><small><span>${u.hp === 0 ? '倒下' : `HP ${u.hp}/${u.maxHp}`}</span><span>甲 ${u.armor}/${u.maxArmor}</span><span>MP ${u.mp}/${u.maxMp}</span></small></span>${u.heroId ? '' : '<i>缔约</i>'}</button>`;
    }
    private openEquipment() {
        const dialog = this.root.querySelector<HTMLDialogElement>('#exp-equipment-dialog');
        if (!dialog || dialog.open || this.run.stage === 'battle') return;
        this.renderEquipment(); dialog.showModal();
    }
    private closeEquipment() {
        this.root.querySelector<HTMLDialogElement>('#exp-equipment-dialog')?.close();
        this.inventory?.dispose(); this.inventory = undefined; this.render();
        this.root.querySelector<HTMLButtonElement>('[data-exp-action="equipment"]')?.focus({ preventScroll: true });
    }
    private renderEquipment() {
        const restoreOwnerFocus = document.activeElement?.matches('[data-equipment-owner]');
        this.inventory?.dispose();
        const r = this.run, u = r.party.find(t => t.id === this.ownerId) || r.party[0]; this.ownerId = u.id;
        const host = this.root.querySelector<HTMLElement>('#exp-equipment-content'); if (!host) return;
        host.innerHTML = '<header class="exp-equipment-header"><h2 id="exp-equipment-title">装备与物资</h2><select data-equipment-owner aria-label="选择整备队员">' + r.party.map(t => '<option value="' + esc(t.id) + '" ' + (u.id === t.id ? 'selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select><button data-exp-action="equipment-close" class="icon-button" aria-label="关闭装备与物资">' + icon('close', 20) + '</button></header><div class="exp-equipment-body">' + this.resources(u) + '<div id="camp-inventory"></div><p class="camp-count"></p><button data-exp-action="sell-valuables" class="button secondary" ' + (!r.stock.some(id=>EQUIPMENT[id]?.slot==='valuable')?'disabled':'') + ' '+(!this.options.base&&!(r.stage==='node'&&r.nodes.find(n=>n.id===r.current)?.kind==='shop')?'hidden':'')+'>出售换金杂物</button><p class="stock-notice" role="status">' + esc(r.message) + '</p></div>';
        const pool = [...r.stock, ...carriedItems(u)];
        this.inventory = new EquipmentInventory(host.querySelector('#camp-inventory')!, {
            stockLimit: r.stockLimit, stockCounts: Object.fromEntries(r.stock.map(id => [id, r.stock.filter(item => item === id).length])),
            attributes: u.progression.attributes, equipment: u.equipment, artifacts: u.artifacts,
            items: Object.values(EQUIPMENT).filter(item => pool.includes(item.id)), editable: !['overcrowded','loot'].includes(r.stage)
        }, change => {
            try {
                this.run = equipMember(this.run, u.id, change.equipment, change.artifacts); this.notice = ''; this.options.onChange?.(clone(this.run));
                const current = this.run.party.find(t => t.id === u.id)!; host.querySelector('.exp-resource-summary')!.outerHTML = this.resources(current);
                host.querySelector('.camp-count')!.textContent = '行囊 ' + change.artifacts.length + ' / ' + bagCapacity(change.equipment) + '　物资库 ' + this.run.stock.length + '件';
                return true;
            } catch (error) { this.notice = error instanceof Error ? error.message : '装备失败'; return false; }
        });
        host.querySelector('.camp-count')!.textContent = '行囊 ' + u.artifacts.length + ' / ' + bagCapacity(u.equipment) + '　物资库 ' + r.stock.length + '件';
        if (restoreOwnerFocus) host.querySelector<HTMLSelectElement>('[data-equipment-owner]')?.focus({ preventScroll: true });
    }
    private openPacking() {
        this.transfer?.dispose(); let packed = packedSupplies(this.run), remaining = [...this.run.stock];
        for(const id of packed){const i=remaining.indexOf(id);if(i>=0)remaining.splice(i,1);}
        const dialog=this.root.querySelector<HTMLDialogElement>('#base-packing-dialog')!;
        const gold=dialog.querySelector<HTMLInputElement>('[data-packed-gold]')!;gold.max=String(this.run.gold);gold.value=String(Math.min(this.run.gold,this.run.packedGold??80));
        this.transfer=new StockTransfer(dialog.querySelector('#packing-transfer')!,{left:remaining,right:packed,leftTitle:'基地物资库',rightTitle:'随队物资',rightLimit:storageCapacity(this.run.storageLevel)},(side,id,count)=>{
            const moved=transferStock(side==='left'?remaining:packed,side==='left'?packed:remaining,id,count,side==='left'?storageCapacity(this.run.storageLevel):undefined);
            if(side==='left'){remaining=moved.source;packed=moved.target;}else{packed=moved.source;remaining=moved.target;}
            this.run.packedStock=[...packed];this.options.onChange?.(clone(this.run));
            return {left:remaining,right:packed,leftTitle:'基地物资库',rightTitle:'随队物资',rightLimit:storageCapacity(this.run.storageLevel)};
        }); dialog.showModal();
    }
    private renderTraining() {
        const dialog=this.root.querySelector<HTMLDialogElement>('#base-training-dialog');if(!dialog)return;
        const u=this.run.party.find(t=>t.id===this.ownerId)||this.run.party[0];
        dialog.innerHTML='<header class="exp-equipment-header"><h2>精华培养</h2><select data-training-owner aria-label="选择培养队员">'+this.run.party.map(t=>'<option value="'+t.id+'" '+(t.id===u.id?'selected':'')+'>'+esc(t.name)+'</option>').join('')+'</select><button class="icon-button" data-exp-action="train-close" aria-label="关闭培养">'+icon('close')+'</button></header><div class="training-body"><div class="training-wallet">'+icon('coin',18)+' '+this.run.gold+' 金币</div><div class="training-stats">'+PRIMARY_STATS.map(stat=>{
            const offer=trainingOffer(u,stat.key),owned=this.run.stock.filter(id=>id===offer.id).length,reason=offer.error||(owned<offer.count?'精华不足':this.run.gold<offer.gold?'金币不足':'');
            return '<div class="training-row"><div><strong>'+stat.name+' <b>'+u.progression.attributes[stat.key]+'</b></strong><small>'+stat.benefit+' / 已培养 '+(u.progression.essenceGains?.[stat.key]||0)+'/10</small></div><span>'+itemIcon(offer.id,20)+'<span>'+EQUIPMENT[offer.id].name+' '+owned+'/'+offer.count+'<small>'+offer.gold+' 金币</small></span></span><button class="button secondary" data-exp-action="train" data-id="'+stat.key+'" '+(reason?'disabled':'')+' title="'+esc(reason||'裸属性永久+1')+'">'+(reason||'+1')+'</button></div>';
        }).join('')+'</div><p class="training-rule">普通精华用于1–19，凝练精华用于20–49，纯粹精华用于50–79点裸属性。每项最多培养10次。</p><p class="stock-notice" role="status">'+esc(this.notice||this.run.message)+'</p></div>';
    }
    private renderBasePanel() {
        const dialog=this.root.querySelector<HTMLDialogElement>('#base-panel-dialog');if(!dialog||!this.basePanel)return;
        const u=this.run.party.find(t=>t.id===this.ownerId)||this.run.party[0];dialog.dataset.panel=this.basePanel;
        const title=this.basePanel==='roster'?'公会队员':this.basePanel==='departure'?'选择远征':'基地后勤';
        const canUse=(id:string)=>this.run.stock.includes(id)&&['route','node'].includes(this.run.stage);
        const content=this.basePanel==='roster'?'<div class="exp-members">'+this.run.party.map(t=>this.member(t)).join('')+'</div>'+this.loadout(u,canUse):this.departure();
        dialog.innerHTML='<header class="exp-equipment-header"><h2 id="base-panel-title">'+title+'</h2><button data-exp-action="base-panel-close" class="icon-button" aria-label="关闭'+title+'">'+icon('close',20)+'</button></header><div class="exp-equipment-body">'+content+'</div>';
    }
    private resources(u: Unit): string {
        return '<div class="exp-resource-summary"><span>HP <b>' + u.hp + ' / ' + u.maxHp + '</b></span><span>MP <b>' + u.mp + ' / ' + u.maxMp + '</b></span><span>护甲 <b>' + u.armor + ' / ' + u.maxArmor + '</b></span></div>';
    }
    private recoveryButtons(u: Unit, canUse: (id: string) => boolean): string {
        return ['potion', 'ether', 'repair-kit', 'repair-kit-large'].filter(id => id === 'potion' || id === 'ether' || canUse(id)).map(id => {
            const reason = restorationError(u, id), label = id === 'repair-kit' ? '修理+20' : id === 'repair-kit-large' ? '修理+40' : EQUIPMENT[id].name;
            return '<button data-exp-action="camp-item" data-id="' + id + '|' + u.id + '" class="button secondary ' + (reason ? 'is-unavailable' : '') + '" ' + (!canUse(id) ? 'disabled' : '') + ' aria-disabled="' + !!reason + '" title="' + esc(reason || consumableDescription(EQUIPMENT[id])) + '">' + itemIcon(id,18) + ' ' + label + '</button>';
        }).join('');
    }
    private loadout(u: Unit, canUse: (id: string) => boolean): string {
        return '<section class="exp-loadout"><div class="exp-section-heading"><h2>' + esc(u.name) + '</h2><label class="policy-control"><select data-exp-policy="' + u.id + '" ' + (!['route','node'].includes(this.run.stage)?'disabled':'') + ' aria-label="' + esc(u.name) + '的行动方针">' + Object.entries(POLICIES).map(([id, name]) => '<option value="' + id + '" ' + ((u.policy || 'damage') === id ? 'selected' : '') + '>' + name + '</option>').join('') + '</select></label></div>' + this.resources(u) +
            '<dl class="exp-gear-summary">' + (['weapon', 'armor', 'backpack'] as const).map(slot => {
                const id = u.equipment[slot] || (slot === 'backpack' ? 'travel-bag' : '');
                return '<div><dt>' + ({ weapon: '武器', armor: '防具', backpack: '行囊' }[slot]) + '</dt><dd>' + esc(EQUIPMENT[id]?.name || '未装备') + '</dd></div>';
            }).join('') + '</dl><div class="exp-bag-summary"><span>行囊法宝 <b>' + u.artifacts.length + ' / ' + bagCapacity(u.equipment) + '</b></span><ul>' + u.artifacts.map(id => '<li>' + esc(EQUIPMENT[id].name) + '</li>').join('') + '</ul></div>' +
            '<div class="camp-actions"><button data-exp-action="equipment" class="button secondary" ' + (['overcrowded','loot'].includes(this.run.stage)?'disabled':'') + '>' + icon('bag', 16) + ' 装备与物资</button>' +
            (u.hp === 0 ? '<button data-exp-action="camp-item" data-id="revival-stone|' + u.id + '" class="button secondary" ' + (canUse('revival-stone') ? '' : 'disabled') + '>' + itemIcon('revival-stone',18) + ' 复苏石</button>' :
                this.recoveryButtons(u, canUse)) +
            (!u.heroId && this.run.stage !== 'overcrowded' ? '<button data-exp-action="dismiss" data-id="' + u.id + '" class="text-button">遣散</button>' : '') + '</div>' + (this.notice ? '<p class="camp-feedback">' + esc(this.notice) + '</p>' : '') + '</section>';
    }
    private render() {
        const oldPan=this.root.querySelector<HTMLElement>('.base-panorama'),center=oldPan?(oldPan.scrollLeft+oldPan.clientWidth/2)/Math.max(1,oldPan.scrollWidth):.52;this.baseSceneCleanup?.();this.baseSceneCleanup=undefined;
        this.inventory?.dispose(); this.inventory = undefined; this.transfer?.dispose();this.transfer=undefined;
        if(this.options.base)this.options.onChange?.(clone(this.run));
        const r = this.run;
        if (r.stage === 'won' || r.stage === 'lost') {
            if(!this.resultReported){this.resultReported=true;this.options.onFinish?.(clone(r));}
            this.root.innerHTML = `<main class="expedition-screen expedition-result"><span class="exp-kicker">冒险者们</span><h1>${r.stage === 'won' ? '副本通关' : 'Game Over'}</h1><p>${esc(r.message)}</p><div class="exp-result-stats"><span>战斗胜利<strong>${r.battlesWon}</strong></span><span>剩余金币<strong>${r.gold}</strong></span><span>存活队员<strong>${r.party.filter(u => u.hp > 0).length} / ${r.party.length}</strong></span></div><button data-exp-action="restart" class="button primary">${this.onRestart ? '返回基地' : '重新选择队伍'} ${icon('arrow')}</button></main>`; return;
        }
        const u = r.party.find(t => t.id === this.ownerId) || r.party[0]; this.ownerId = u.id;
        const items=r.stock;
        const canUse = (id: string) => items.includes(id) && ['route', 'node'].includes(r.stage);
        this.root.innerHTML = (this.options.base ? renderBaseScene(r,this.ownerId,this.notice||r.message) : `<main class="expedition-screen ${this.options.base ? 'base-screen' : ''}" data-mobile-view="${this.mobileView}"><header class="exp-header"><div><span class="exp-kicker">冒险者们</span><h1>${this.options.base ? '冒险者基地' : getDungeon(r.dungeonId).name}</h1></div><div class="exp-resources"><span>${icon('shield', 16)} ${this.options.base ? r.party.length + '名队员' : r.party.length + ' / 10'}</span><span class="exp-gold">${r.gold} 金币</span><button data-exp-action="tips" class="text-button" aria-label="TIPS 游戏玩法提示">TIPS</button></div></header>
            <nav ${this.options.base ? 'hidden' : ''} class="exp-mobile-tabs" aria-label="远征视图"><button data-exp-action="view-route" aria-pressed="${this.mobileView === 'route'}">路线</button><button data-exp-action="view-party" aria-pressed="${this.mobileView === 'party'}">小队</button></nav>
            <div class="exp-notice" role="status">${esc(this.notice || r.message)}</div><div class="exp-layout">${this.options.base ? this.departure() : ''}<section class="exp-route" ${this.options.base ? 'hidden' : ''}><div class="exp-section-heading"><h2>探索路线</h2><span>${r.visited.length} / ${getDungeon(r.dungeonId).layers.length}</span></div>${this.route()}<div class="route-legend">${Object.entries(NODE_NAMES).map(([kind, name]) => `<span>${icon(nodeIcons[kind as NodeKind], 14)} ${name}</span>`).join('')}</div></section>
            <section class="exp-camp">${this.nodeContent()}${r.nextEnemyHp<1 ? '<p class="scout-notice">侦察就绪：下一场敌人以85%生命入场</p>' : ''}<section class="exp-party" ${r.stage==='loot'?'hidden':''}><div class="exp-section-heading"><h2>${this.options.base ? '基地队员' : '远征小队'}</h2><span>${r.party.filter(t => t.hp > 0).length}人可出战</span></div><div class="exp-members">${r.party.map(t => this.member(t)).join('')}</div></section>${r.stage==='loot'?'':this.loadout(u, canUse)}</section></div></main>`) + `
            <dialog id="exp-equipment-dialog" class="exp-equipment-dialog" aria-labelledby="exp-equipment-title"><div id="exp-equipment-content"></div></dialog><dialog id="exp-tips-dialog" class="exp-equipment-dialog exp-tips-dialog" aria-labelledby="exp-tips-title"><header class="exp-equipment-header"><h2 id="exp-tips-title">TIPS</h2><button data-exp-action="tips-close" class="icon-button" aria-label="关闭玩法提示">${icon('close',20)}</button></header><div class="exp-equipment-body">${gameTipsHtml()}</div></dialog>`;
        this.root.insertAdjacentHTML('beforeend','<dialog id="loot-leave-dialog" class="exp-equipment-dialog confirm-loot-dialog"><h2>结束搜刮？</h2><p>未收纳的战利品和移出的物资会留在原地，无法找回。</p><div class="dialog-actions"><button class="button secondary" data-exp-action="loot-stay">继续整理</button><button class="button primary" data-exp-action="loot-finish">放弃剩余物品</button></div></dialog>'+(this.options.base?'<dialog id="base-training-dialog" class="exp-equipment-dialog training-dialog" aria-label="精华培养"></dialog><dialog id="base-packing-dialog" class="exp-equipment-dialog packing-dialog" aria-label="出发物资"><header class="exp-equipment-header"><h2>出发物资</h2><button data-exp-action="pack-close" class="icon-button" aria-label="完成打包">'+icon('close')+'</button></header><div class="exp-equipment-body"><label class="packing-gold">随队金币 <input type="number" data-packed-gold min="0" step="1" aria-label="随队金币"><span>其余金币留在基地</span></label><div id="packing-transfer"></div><button data-exp-action="pack-close" class="button primary full">完成打包</button></div></dialog>':''));
        if(this.options.base){
            this.root.insertAdjacentHTML('beforeend','<dialog id="base-panel-dialog" class="exp-equipment-dialog base-panel-dialog" aria-labelledby="base-panel-title"></dialog>');
            this.baseSceneCleanup=bindBaseScene(this.root,center);
            const panel=this.root.querySelector<HTMLDialogElement>('#base-panel-dialog')!;
            panel.addEventListener('cancel',event=>{event.preventDefault();this.action('base-panel-close');});
            panel.addEventListener('click',event=>{if(event.target===panel)this.action('base-panel-close');});
            if(this.basePanel){this.renderBasePanel();panel.showModal();}
        }
        const lootHost=this.root.querySelector<HTMLElement>('#loot-transfer');if(lootHost&&r.lastLoot){this.transfer=new StockTransfer(lootHost,{left:r.lastLoot.items,right:r.stock,leftTitle:'战利品',rightTitle:'团队物资库',rightLimit:r.stockLimit||storageCapacity(r.storageLevel)},(side,id,count)=>{
            this.run=moveLootItem(this.run,id,side==='left'?'loot':'stock',count);return{left:this.run.lastLoot!.items,right:this.run.stock,leftTitle:'战利品',rightTitle:'团队物资库',rightLimit:this.run.stockLimit||storageCapacity(this.run.storageLevel)};
        });}
        const dialog = this.root.querySelector<HTMLDialogElement>('#exp-equipment-dialog')!;
        const tips = this.root.querySelector<HTMLDialogElement>('#exp-tips-dialog')!;
        this.root.querySelector('#base-packing-dialog')?.addEventListener('cancel',event=>{event.preventDefault();this.action('pack-close');});
        this.root.querySelector('#base-training-dialog')?.addEventListener('cancel',event=>{event.preventDefault();this.action('train-close');});
        tips.addEventListener('click', event => { if (event.target === tips) tips.close(); });
        dialog.addEventListener('cancel', event => { event.preventDefault(); this.closeEquipment(); });
        dialog.addEventListener('click', event => { if (event.target === dialog) this.closeEquipment(); });
    }
}
