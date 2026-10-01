export function movementStateFromKeys(keys, { blocked = false, swimming = false, jetpack = false } = {}) {
  const held = (...codes) => !blocked && codes.some(code => keys.has(code));
  const vertical = swimming || jetpack;
  return {
    forward: held('KeyW', 'ArrowUp') || (!vertical && held('Space')),
    back: held('KeyS', 'ArrowDown'), left: held('KeyA', 'ArrowLeft'), right: held('KeyD', 'ArrowRight'),
    run: held('ShiftLeft', 'ShiftRight'), up: vertical && held('Space', 'KeyR'),
    down: vertical && held('KeyC', 'ControlLeft', 'ControlRight'),
  };
}

export function setupInput(canvas, unused, player) {
  const keys=new Set();
  const movement=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyR','KeyC','ControlLeft','ControlRight','ShiftLeft','ShiftRight']);
  const blocked=()=>Boolean(window.__APP?.inputBlocked);
  function apply(){
    player.setMoveState(movementStateFromKeys(keys, { blocked: blocked(), swimming: player.swimming, jetpack: player.jetpackEnabled }));
  }
  let looking=false, lookId=null, moveId=null;
  function clear(){keys.clear();looking=false;lookId=null;moveId=null;canvas.style.cursor='default';apply();}
  window.addEventListener('clearinput',clear);
  window.addEventListener('blur',clear);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  window.addEventListener('keydown',e=>{
    if(e.target.closest('input,select,textarea'))return;
    if(movement.has(e.code)){e.preventDefault();keys.add(e.code);apply();}
  });
  window.addEventListener('keyup',e=>{keys.delete(e.code);apply();});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    if(blocked())return;
    if(e.pointerType==='mouse'&&e.button===2){looking=true;canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';}
    if(e.pointerType!=='mouse'&&e.clientX>innerWidth*.4){lookId=e.pointerId;canvas.setPointerCapture(e.pointerId);}
  });
  canvas.addEventListener('pointermove',e=>{
    if(!blocked()&&(looking||e.pointerId===lookId))player.rotateView(e.movementX,e.movementY);
  });
  const release=e=>{if(e.pointerId===lookId)lookId=null;if(e.button===2)looking=false;canvas.style.cursor='default';};
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',clear);canvas.addEventListener('lostpointercapture',release);
  const mobile=document.createElement('div');mobile.className='mobile-controls';
  mobile.innerHTML='<div class="move-pad" role="group" aria-label="Movimento"><span class="move-pad__thumb"></span></div><span class="look-hint">Trascina per guardare</span><button class="touch-interact" aria-label="Usa le scale">Scale ↑↓</button>';
  document.getElementById('ui-root').append(mobile);
  const pad=mobile.querySelector('.move-pad'),thumb=mobile.querySelector('span');
  function move(e){
    if(moveId!==e.pointerId||blocked())return;
    const r=pad.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;
    const length=Math.hypot(dx,dy),scale=Math.min(1,32/Math.max(1,length));
    thumb.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;
    for(const key of ['KeyW','KeyS','KeyA','KeyD'])keys.delete(key);
    if(dy<-10)keys.add('KeyW');if(dy>10)keys.add('KeyS');if(dx<-10)keys.add('KeyA');if(dx>10)keys.add('KeyD');apply();
  }
  pad.addEventListener('pointerdown',e=>{if(blocked())return;moveId=e.pointerId;pad.setPointerCapture(e.pointerId);move(e);});
  pad.addEventListener('pointermove',move);
  function releasePad(){clear();thumb.style.transform='translate(0,0)';}
  pad.addEventListener('pointerup',releasePad);pad.addEventListener('pointercancel',releasePad);pad.addEventListener('lostpointercapture',releasePad);
  mobile.querySelector('button').addEventListener('click',()=>document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE'})));
  const swimButtons = document.createElement('div');
  swimButtons.className = 'swim-controls';
  swimButtons.hidden = true;
  swimButtons.setAttribute('role', 'group');
  swimButtons.setAttribute('aria-label', 'Nuoto');
  swimButtons.innerHTML = '<button type="button" aria-label="Nuota verso la superficie">↑ Sali</button><button type="button" aria-label="Immergiti">↓ Scendi</button>';
  for (const [index, button] of [...swimButtons.children].entries()) {
    button.style.cssText = `position:fixed;right:max(28px,env(safe-area-inset-right));bottom:calc(max(28px,env(safe-area-inset-bottom)) + ${index ? 196 : 132}px);min-width:94px;min-height:52px;border:1px solid #a7d5dc;border-radius:9px;background:#102b35dd;color:#edfaff;pointer-events:auto;touch-action:none;font:inherit;`;
    const code = index ? 'KeyC' : 'Space';
    button.addEventListener('pointerdown', event => {
      if (blocked()) return;
      event.preventDefault(); button.setPointerCapture(event.pointerId); keys.add(code); apply();
    });
    const release = event => { event.preventDefault(); keys.delete(code); apply(); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }
  mobile.append(swimButtons);
  const previousSwimmingChange = player.onSwimmingChange;
  player.onSwimmingChange = state => {
    swimButtons.hidden = !state.active;
    mobile.querySelector('.look-hint').textContent = state.active ? 'Guarda e nuota · ↑↓ per la profondità' : 'Trascina per guardare';
    apply();
    previousSwimmingChange?.(state);
  };
  window.addEventListener('jetpackenabled', apply);
  window.addEventListener('jetpackdisabled', apply);
}
