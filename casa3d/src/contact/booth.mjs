import {createView,createShaft} from './view.mjs';
import {experienceUrl} from './navigation.mjs';

// Loaded only after the information button leaves the world.
const view=createView('Discesa alla sala informazioni');
const shaft=createShaft(view.scene);shaft.visible=true;
view.camera.position.set(0,1.9,1.45);
view.ui.innerHTML='<p class="contact-status" role="status" aria-live="polite">Discesa…</p>';
const status=view.ui.querySelector('p');
const duration=matchMedia('(prefers-reduced-motion: reduce)').matches ? .25 : 3.2;
let elapsed=0;
view.setUpdate(dt=>{
  elapsed+=document.hidden?0:dt;
  const t=Math.min(1,elapsed/duration),smooth=t*t*(3-2*t);
  view.camera.position.y=1.9-10*smooth;
  status.textContent=`Discesa · ${Math.round(t*100)}%`;
  view.diagnostics({phase:'down',worldLoaded:false});
  if(t===1){location.replace(experienceUrl(location.href,'chamber'));view.setUpdate(()=>{});}
});
