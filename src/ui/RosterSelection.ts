import { characterImage } from '../battle/characterArt';
import { DEFAULT_HERO_IDS, HERO_PRESETS } from '../battle/roster';
import { createBase } from '../battle/base';
import { EQUIPMENT, estimatedPower } from '../battle/progression';
import { Unit, skillById } from '../battle/engine';
import { icon } from './icons';
import { escapeHtml as esc } from './itemPresentation';
export class RosterSelection {
    private selected: Set<string>; private party: readonly Unit[];
    private key(u: Unit): string { return u.heroId || u.id; }
    constructor(private root: HTMLElement, onConfirm: (members: string[]) => void, options: { party?: readonly Unit[]; onBack?: () => void } = {}) {
        this.party = options.party || createBase().party;
        const alive = this.party.filter(u => u.hp > 0), defaults = alive.filter(u => DEFAULT_HERO_IDS.includes(u.heroId!));
        this.selected = new Set([...defaults, ...alive.filter(u => !defaults.includes(u))].slice(0,5).map(u => this.key(u)));
        root.innerHTML = '<main class="roster-screen"><header class="roster-header"><a class="wordmark" href="#" aria-label="冒险者们">'+icon('spark',22)+'<span>冒险者们<small>ADVENTURERS</small></span></a><h1>选择出战队员</h1>'+(options.onBack?'<button data-action="back-base" class="text-button">返回基地</button>':'')+'<output id="roster-count" aria-live="polite"></output></header><fieldset class="hero-grid"><legend class="sr-only">选择五名队员</legend>'+this.party.map(u=>{
            const id=this.key(u),preset=u.heroId?HERO_PRESETS[u.heroId]:undefined;
            return '<label class="hero-option" data-hero-card="'+esc(id)+'"><input type="checkbox" data-hero-id="'+esc(id)+'" aria-label="选择'+esc(u.name)+'"><div class="hero-art"><img src="'+characterImage(u,'idle')+'" alt="'+esc(u.name)+'的角色形象" width="256" height="256"></div><div class="hero-copy"><h2>'+esc(u.name)+'</h2><p class="hero-role">'+(u.hp===0?'倒下，需先复活':preset?(preset.gender==='male'?'男':'女')+' / '+preset.role:'契约伙伴')+'</p><dl class="hero-metrics"><div><dt>生命</dt><dd>'+u.hp+'/'+u.maxHp+'</dd></div><div><dt>护甲</dt><dd>'+u.armor+'/'+u.maxArmor+'</dd></div><div><dt>战力</dt><dd>'+estimatedPower(u)+'</dd></div></dl><p class="hero-equipment">'+esc(EQUIPMENT[u.equipment.weapon!]?.name||'未装备')+' / '+esc(EQUIPMENT[u.equipment.armor!]?.name||'未装备')+'</p><p class="hero-skills">'+u.skills.map(id=>'<span>'+esc(skillById(id)!.name)+'</span>').join('')+'</p></div></label>';
        }).join('')+'</fieldset><footer class="roster-footer"><div id="selected-heroes" class="selected-heroes" aria-label="已选队员"></div><button data-action="confirm-roster" class="button primary">进入副本 '+icon('arrow')+'</button></footer></main>';
        const change=(event:Event)=>{const input=event.target as HTMLInputElement,id=input.dataset.heroId;if(!input.matches('[data-hero-id]')||!id)return;
            const unit=this.party.find(u=>this.key(u)===id);if(!unit||unit.hp<=0){input.checked=false;return;}if(input.checked){if(this.selected.size===5){input.checked=false;return;}this.selected.add(id);}else this.selected.delete(id);this.update();};
        const click=(event:Event)=>{const target=event.target as HTMLElement;if(target.closest('[data-action="back-base"]')&&options.onBack){cleanup();options.onBack();return;}
            if(!target.closest('[data-action="confirm-roster"]')||this.selected.size!==5)return;cleanup();onConfirm([...this.selected]);};
        const cleanup=()=>{root.removeEventListener('change',change);root.removeEventListener('click',click);};
        root.addEventListener('change',change);root.addEventListener('click',click);this.update();
    }
    private update(){
        this.root.querySelector('#roster-count')!.textContent='已选 '+this.selected.size+' / 5';
        this.root.querySelectorAll<HTMLInputElement>('[data-hero-id]').forEach(input=>{const id=input.dataset.heroId!,unit=this.party.find(u=>this.key(u)===id)!,selected=this.selected.has(id);input.checked=selected;input.disabled=unit.hp<=0||(!selected&&this.selected.size===5);input.closest('.hero-option')!.classList.toggle('selected',selected);});
        this.root.querySelector<HTMLButtonElement>('[data-action="confirm-roster"]')!.disabled=this.selected.size!==5;
        this.root.querySelector('#selected-heroes')!.innerHTML=[...this.selected].map(id=>{const u=this.party.find(t=>this.key(t)===id)!;return '<img src="'+characterImage(u)+'" alt="'+esc(u.name)+'" title="'+esc(u.name)+'" width="40" height="40">';}).join('');
    }
}
