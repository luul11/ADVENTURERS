import type { Expedition } from '../battle/expedition';
import { storageCapacity, stockUsage } from '../battle/storage';
import { packedSupplies } from '../battle/base';
import { characterImage } from '../battle/characterArt';
import { escapeHtml as esc } from './itemPresentation';
import { icon } from './icons';
import './BaseScene.css';

/** 基地场景仅负责呈现，所有管理操作沿用ExpeditionApp和原规则。 */
export function renderBaseScene(run: Expedition, ownerId: string, notice: string): string {
    const alive=run.party.filter(u=>u.hp>0).length, slots=storageCapacity(run.storageLevel);
    const location=(action:string,name:string,glyph:string,x:number,y:number,meta='')=>'<button class="base-location" data-exp-action="'+action+'" style="--spot-x:'+x+'%;--spot-y:'+y+'%" aria-label="'+name+'"><span class="base-location-pin">'+icon(glyph,22)+'</span><span class="base-location-label">'+name+(meta?'<small>'+meta+'</small>':'')+'</span></button>';
    return '<main class="mercenary-base base-screen" aria-label="雇佣兵基地"><div class="base-panorama" tabindex="0" aria-label="基地全景，可左右拖动查看建筑"><div class="base-world"><img class="base-world-art" src="'+import.meta.env.BASE_URL+'assets/mercenary_base.webp" alt="石木公会大厅、物资仓库与工坊围成的佣兵驻地" draggable="false" fetchpriority="high" width="1672" height="941">'+
        location('base-roster','冒险者公会','shield',55,49)+location('equipment','物资仓库','bag',17,55,slots+'格随队容量')+location('train-open','精华工坊','essence',78,53)+location('pack-open','出发整备','scroll',51,74)+
        '</div></div><div class="base-vignette" aria-hidden="true"></div><header class="base-hud"><div class="base-wordmark">'+icon('shield',28)+'<div><span>冒险者们</span><h1>雇佣兵驻地</h1></div></div><div class="base-hud-resources"><span class="base-gold">'+icon('coin',18)+'<b>'+run.gold+'</b><span>金币</span></span><button data-exp-action="base-roster" class="base-resource-button" aria-label="管理队员">'+icon('shield',18)+'<b>'+alive+'/'+run.party.length+'</b><span>可出战</span></button><button class="base-help" data-exp-action="tips" aria-label="TIPS 游戏玩法提示">'+icon('help',20)+'</button></div></header>'+
        (notice?'<div class="base-notice" role="status">'+esc(notice)+'</div>':'')+
        '<div class="base-pan-controls"><button class="base-pan-button" data-exp-action="base-pan-left" aria-label="向左查看基地">'+icon('arrow',18)+'</button><button class="base-pan-button" data-exp-action="base-pan-right" aria-label="向右查看基地">'+icon('arrow',18)+'</button></div>'+
        '<footer class="base-command"><section class="base-companions" aria-label="基地队员"><button class="base-companions-title" data-exp-action="base-roster"><span>驻地队员</span><b>'+run.party.length+'</b></button><div class="base-companion-list">'+run.party.map(u=>'<button class="base-companion '+(u.id===ownerId?'selected ':'')+(u.hp===0?'fallen':'')+'" data-exp-action="member" data-id="'+u.id+'" title="'+esc(u.name)+(u.hp===0?'，已倒下':'')+'" aria-label="管理'+esc(u.name)+'"><img src="'+characterImage(u)+'" alt="" width="52" height="52">'+(u.hp===0?'<span aria-hidden="true">'+icon('revive',14)+'</span>':'')+'</button>').join('')+'</div></section>'+
        '<div class="base-command-row"><nav class="base-navigation" aria-label="基地管理"><button data-exp-action="base-roster">'+icon('shield',21)+'<span>队员</span></button><button data-exp-action="equipment">'+icon('bag',21)+'<span>物资</span></button><button data-exp-action="train-open">'+icon('essence',21)+'<span>培养</span></button><button data-exp-action="pack-open">'+icon('scroll',21)+'<span>打包</span></button><button data-exp-action="base-logistics">'+icon('gear',21)+'<span>后勤</span></button></nav><button class="base-departure-button" data-exp-action="base-departure"><span>出发远征<small>'+stockUsage(packedSupplies(run))+' / '+slots+'格物资</small></span>'+icon('arrow',22)+'</button></div></footer></main>';
}

/** 使用原生横向滚动，保留整幅底图；鼠标拖动和手机滑动都不裁掉建筑。 */
export function bindBaseScene(root: HTMLElement, initialCenter = .52): () => void {
    const pan=root.querySelector<HTMLElement>('.base-panorama');if(!pan)return()=>{};
    const events=new AbortController(),options={signal:events.signal};let center=initialCenter,down:{x:number;left:number}|null=null;
    const position=()=>{pan.scrollLeft=Math.max(0,center*pan.scrollWidth-pan.clientWidth/2);};position();
    pan.addEventListener('scroll',()=>{center=(pan.scrollLeft+pan.clientWidth/2)/Math.max(1,pan.scrollWidth);},options);
    pan.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0||(event.target as Element).closest('button'))return;down={x:event.clientX,left:pan.scrollLeft};pan.setPointerCapture(event.pointerId);pan.classList.add('is-panning');},options);
    pan.addEventListener('pointermove',event=>{if(down)pan.scrollLeft=down.left+down.x-event.clientX;},options);
    const release=()=>{down=null;pan.classList.remove('is-panning');};pan.addEventListener('pointerup',release,options);pan.addEventListener('pointercancel',release,options);
    const observer=new ResizeObserver(position);observer.observe(pan);
    return()=>{events.abort();observer.disconnect();};
}
