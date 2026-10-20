import * as THREE from 'three';
import {createView,box} from './view.mjs';
import {experienceUrl} from './navigation.mjs';
import {createChamberPlayer} from './chamberPlayer.mjs';
import {setupInput} from '../player/input.mjs';
import {createGameMenu} from '../ui/gameMenu.js';

// Standalone room: shared controls, without the main world, body, sky or GLBs.
const view=createView('Sala sotterranea');
const {scene,camera,ui}=view;
const room=new THREE.Group();room.name='EmptyMinigameRoom';scene.add(room);
box(room,[8.2,.16,8.2],[0,-.08,0],0x65706c);
box(room,[8.2,.16,8.2],[0,3.5,0],0x364b4a);
for(const x of [-4,4])box(room,[.16,3.5,8.2],[x,1.75,0],0x76847b);
for(const z of [-4,4])box(room,[8.2,3.5,.16],[0,1.75,z],0x879087);
for(const x of [-3.89,3.89]){
  const trim=box(room,[.025,.05,7.8],[x,.12,0],0xf5d599);trim.material.emissive.setHex(0xa18446);
}
for(const z of [-3.89,3.89]){
  const trim=box(room,[7.8,.05,.025],[0,.12,z],0xf5d599);trim.material.emissive.setHex(0xa18446);
}
const ceiling=box(room,[2.4,.02,.35],[0,3.39,0],0xffefc8);ceiling.material.emissive.setHex(0xf6dfb0);
// A marked lift landing is architectural; the rest of the room is deliberately empty.
box(room,[1.5,.025,1.5],[0,.015,2.5],0x414d49);
box(room,[1.5,2.8,.03],[0,1.4,3.89],0x343f3b);
for(const x of [-.8,.8])box(room,[.045,2.85,.04],[x,1.425,3.86],0xa3926b,.5);
window.__APP={inputBlocked:false};
const {player,colliders}=createChamberPlayer(camera,room);
ui.innerHTML='<div class="dim-menu"><span class="hud-brand">ANIMAL HOUSE</span><button class="menu-toggle" type="button" aria-label="Apri menu">Menu <kbd>Esc</kbd></button></div><button class="chamber-return" type="button" data-up>Risali nella cabina ↑</button>';
function up(){const url=experienceUrl(location.href);url.searchParams.set('boothReturn','1');location.replace(url);}
ui.querySelector('[data-up]').onclick=up;
setupInput(view.renderer.domElement,null,player);
const touchInteract=ui.querySelector('.touch-interact');
touchInteract.textContent='Risali nella cabina';touchInteract.setAttribute('aria-label','Risali nella cabina');
createGameMenu(ui,player,ui.querySelector('.menu-toggle'),{
  description:'Sala informazioni',
});
document.addEventListener('keydown',event=>{
  if(event.code==='KeyE'&&!event.repeat&&!window.__APP.inputBlocked)up();
});
view.setUpdate(dt=>{
  if(!window.__APP.inputBlocked&&!document.hidden)player.update(dt,colliders);
  view.diagnostics({phase:'ready',worldLoaded:false,position:player.getPosition().toArray(),
    yaw:player.yaw,pitch:player.pitch,controls:'shared',speed:player.speed,runMultiplier:player.runMult,
    inputBlocked:window.__APP.inputBlocked});
});
