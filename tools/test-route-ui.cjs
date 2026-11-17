const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const delay = ms => new Promise(r => setTimeout(r, ms));
async function main() {
 const target = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
 const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open',r,{once:true}));
 const pending = new Map(), errors = []; let seq=0, drag;
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Input.dragIntercepted')drag=m.params;if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const click=selector=>evaluate(`(()=>{let e=document.querySelector(${JSON.stringify(selector)});const base=document.querySelector('.mercenary-base');if(base){const query=${JSON.stringify(selector)},panel=query.includes('enter-dungeon')||query.includes('select-dungeon')?'base-departure':query.includes('upgrade-storage')?'base-logistics':query.includes('camp-item')?'base-roster':null;if(panel&&(!e||!e.getClientRects().length||e.closest('dialog')&&!e.closest('dialog').open)){base.querySelector('[data-exp-action=\"'+panel+'\"]').click();e=document.querySelector(query);}}if(!e||e.disabled)throw Error('Unavailable '+${JSON.stringify(selector)});e.click();return true;})()`);
 const wait=async expression=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await delay(100);}throw Error('Timed out '+expression+' '+JSON.stringify(await evaluate('({active:document.activeElement?.tagName,text:document.body.innerText.slice(0,600)})')));};
 const viewport=async(width,height)=>{await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await delay(250);};
 const out=path.resolve('.codex/ui-qa');fs.mkdirSync(out,{recursive:true});
 const snap=async name=>{const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));};
 const point=selector=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 const tap=async selector=>{const p=await point(selector);await call('Emulation.setTouchEmulationEnabled',{enabled:true});await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,radiusX:2,radiusY:2,force:1,id:1}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await call('Emulation.setTouchEmulationEnabled',{enabled:false});await delay(80);};
 const nativeDrag=async(id,zone)=>{const from=await point(`[data-item-id="${id}"]`),to=await point(`[data-dropzone="${zone}"]`);drag=null;await call('Input.setInterceptDrags',{enabled:true});await call('Input.dispatchMouseEvent',{type:'mouseMoved',...from});await call('Input.dispatchMouseEvent',{type:'mousePressed',...from,button:'left',buttons:1,clickCount:1});for(let i=1;i<=8;i++)await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8,button:'left',buttons:1});for(let i=0;i<30&&!drag;i++)await delay(30);assert.ok(drag,'Native drag starts');for(const type of ['dragEnter','dragOver','drop'])await call('Input.dispatchDragEvent',{type,...to,data:drag.data});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...to,button:'left',clickCount:1});await call('Input.setInterceptDrags',{enabled:false});};
 const enter=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus();true`);for(const type of ['keyDown','keyUp'])await call('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13});};
 const results={layouts:[],pointerClicks:[],modalChecks:[]};
 try {
  await call('Runtime.enable');await call('Page.enable');await call('Page.bringToFront');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.removeItem('adventurers-base-v1');localStorage.removeItem('adventurers-base-v2')}catch{} // isolate-base-save"});await call('Page.navigate',{url:'http://127.0.0.1:8080/'});await wait(`!!document.querySelector('[data-action="start-game"]')`);
  await evaluate(`(async()=>{const url=performance.getEntriesByType('resource').find(r=>r.name.includes('/src/ui/ExpeditionApp.ts')).name;const {ExpeditionApp}=await import(url);window.__ExpeditionApp=ExpeditionApp;const render=ExpeditionApp.prototype.render;ExpeditionApp.prototype.render=function(){window.__qa=this;return render.call(this);};return true;})()`);
  await click('[data-action="start-game"]');await click('[data-exp-action="enter-dungeon"]');await click('[data-action="confirm-roster"]');await wait('!!window.__qa');
  const reset=()=>evaluate(`(()=>{__qa.dispose();new __ExpeditionApp(document.getElementById('app'));scrollTo(0,0);return true;})()`);
  for (const [width,height] of [[1440,900],[1920,1080],[1024,768],[844,390],[320,680],[375,812],[390,844]]) {
   await viewport(width,height);await reset();await delay(100);
   const layout=await evaluate(`({width:innerWidth,height:innerHeight,pageHeight:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,cards:document.querySelectorAll('.inventory-card').length,routeHeight:document.querySelector('.exp-route').getBoundingClientRect().height})`);
   assert.equal(layout.overflow,false);assert.equal(layout.cards,0);if(width>=1024)assert.ok(layout.pageHeight<=height+1,JSON.stringify(layout));results.layouts.push(layout);await snap('compact-route-'+width);
   if(width<=650){await tap('[data-exp-action="view-party"]');assert.equal(await evaluate(`getComputedStyle(document.querySelector('.exp-route')).display`),'none');assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.exp-camp')).display`),'none');await snap('compact-party-'+width);}
   await click('[data-exp-action="equipment"]');await delay(260);assert.equal(await evaluate(`document.querySelector('#exp-equipment-dialog').open`),true);
   const modal=await evaluate(`(()=>{const d=document.querySelector('#exp-equipment-dialog'),r=d.getBoundingClientRect();return{width:innerWidth,bounds:[r.x,r.y,r.width,r.height],overflow:document.documentElement.scrollWidth>innerWidth+1,focusInside:d.contains(document.activeElement),hasInventory:!!d.querySelector('.inventory-grid')};})()`);
   assert.ok(modal.bounds[0]>=0&&modal.bounds[1]>=0&&modal.bounds[0]+modal.bounds[2]<=width+1&&modal.bounds[1]+modal.bounds[3]<=height+1,JSON.stringify(modal));assert.equal(modal.focusInside,true);assert.equal(modal.hasInventory,true);assert.equal(modal.overflow,false);results.modalChecks.push(modal);await snap('compact-equipment-'+width);
   await evaluate(`(()=>{const s=document.querySelector('[data-equipment-owner]');s.value=__qa.run.party[1].id;s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);assert.equal(await evaluate('__qa.ownerId'),await evaluate('__qa.run.party[1].id'));assert.equal(await evaluate(`document.activeElement.matches('[data-equipment-owner]')`),true);
   await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});assert.equal(await evaluate(`document.querySelector('#exp-equipment-dialog').open`),false);assert.equal(await evaluate('!!__qa.inventory'),false);assert.equal(await evaluate(`document.activeElement.dataset.expAction`),'equipment');
  }
  for (const [width,height] of [[1440,900],[390,844]]) {
   await viewport(width,height);
   for(const spot of ['icon','label','left','right','top']) {
    await reset();await delay(80);
    const hit=await evaluate(`(()=>{const b=document.querySelector('.route-node.available'),e=b.querySelector(${JSON.stringify(spot==='label'?'b':'span')}),r=e.getBoundingClientRect(),br=b.getBoundingClientRect();const spot=${JSON.stringify(spot)},p={x:r.x+r.width/2,y:r.y+r.height/2};if(spot==='left')p.x=r.left+5;if(spot==='right')p.x=r.right-5;if(spot==='top')p.y=r.top+5;return{...p,before:[br.x,br.y,br.width,br.height]};})()`);
    await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:hit.x,y:hit.y});await call('Input.dispatchMouseEvent',{type:'mousePressed',x:hit.x,y:hit.y,button:'left',buttons:1,clickCount:1});
    const pressed=await evaluate(`(()=>{const r=document.querySelector('.route-node.available').getBoundingClientRect();return[r.x,r.y,r.width,r.height]})()`);assert.deepEqual(pressed,hit.before,'Node must not jump on press');
    await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:hit.x,y:hit.y,button:'left',clickCount:1});await wait('!!__qa.battle?.loaded');
    assert.equal(await evaluate('__qa.run.visited.length'),1);assert.equal(await evaluate(`document.querySelectorAll('canvas').length`),1);results.pointerClicks.push({width,spot,entered:true});
   }
   await reset();const p=await point('.route-node.available span');await call('Emulation.setTouchEmulationEnabled',{enabled:true});await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await call('Emulation.setTouchEmulationEnabled',{enabled:false});await wait('!!__qa.battle?.loaded');results.pointerClicks.push({width,spot:'touch-icon',entered:true});
   await reset();await evaluate(`document.querySelector('.route-node.available').focus();true`);await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait('!!__qa.battle?.loaded');results.pointerClicks.push({width,spot:'keyboard',entered:true});
  }
  await viewport(1440,900);
  results.otherNodeClicks=[];
  for(const kind of ['rest','event','elite','shop','boss','extract']) {
   await reset();const id=await evaluate(`(()=>{const q=__qa,n=q.run.nodes.find(n=>n.kind===${JSON.stringify(kind)}),previous=q.run.nodes.find(p=>p.next.includes(n.id));q.run.current=previous.id;q.run.visited=[previous.id];q.render();return n.id;})()`);
   const p=await point('.route-node.available[data-id="'+id+'"] span');for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
   if(['elite','boss'].includes(kind))await wait('!!__qa.battle?.loaded');else assert.equal(await evaluate('__qa.run.stage'),kind==='extract'?'won':'node');
   assert.equal(await evaluate('__qa.run.visited.length'),2);results.otherNodeClicks.push({kind,entered:true});
  }
  await reset();await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await click('[data-exp-action="equipment"]');assert.equal(await evaluate(`getComputedStyle(document.querySelector('#exp-equipment-dialog')).animationName`),'none');await click('[data-exp-action="equipment-close"]');results.reducedMotion=true;
  await evaluate('__qa.dispose();true');await delay(120);results.runtimeErrors=errors;assert.equal(errors.length,0,JSON.stringify(errors));fs.writeFileSync(path.join(out,'compact-route-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));console.log('Compact route checks passed.');
 } finally {ws.close();await fetch('http://127.0.0.1:9333/json/close/'+target.id);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
