import * as THREE from 'three';
import './contact.css';

export function createView(title) {
  document.title = `${title} · Animal House`;
  document.body.classList.add('contact-experience');
  const renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setSize(innerWidth,innerHeight);
  renderer.setClearColor(0x121b1c); renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
  document.body.append(renderer.domElement);
  const scene=new THREE.Scene(); scene.background=new THREE.Color(0x121b1c);
  const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.04,35);
  scene.add(new THREE.HemisphereLight(0xfff4de,0x39464a,1.4));
  const lamp=new THREE.PointLight(0xffe6c4,5,12,2); lamp.position.set(0,2.6,.3); scene.add(lamp);
  const ui=document.getElementById('ui-root'); ui.className='contact-ui';
  let raf=0, stopped=false;
  const clock=new THREE.Clock(); let update=()=>{};
  function draw(){if(stopped)return;const dt=Math.min(clock.getDelta(),.05);update(dt);renderer.render(scene,camera);raf=requestAnimationFrame(draw);}
  function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
  addEventListener('resize',resize);
  addEventListener('pagehide',()=>{
    stopped=true;cancelAnimationFrame(raf);
    scene.traverse(ob=>{ob.geometry?.dispose();for(const mat of (Array.isArray(ob.material)?ob.material:[ob.material]))mat?.dispose();});
    renderer.dispose();renderer.forceContextLoss();
  },{once:true});
  addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
  draw();
  return {scene,camera,renderer,ui,setUpdate(fn){update=fn;},
    diagnostics(extra){document.body.dataset.experience=JSON.stringify({scene:title,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,...extra});}};
}
export function box(parent,size,position,color,metalness=0) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.65,metalness}));
  mesh.position.set(...position);parent.add(mesh);return mesh;
}
export function emergencyButton(parent,x,y) {
  const g=new THREE.Group();g.position.set(x,y,-.672);parent.add(g);
  box(g,[.29,.29,.065],[0,0,0],0xb7b2a1);
  box(g,[.30,.10,.075],[0,.10,.012],0xf9c900);
  box(g,[.30,.20,.025],[0,-.045,.045],0xf3c700);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(.119,32,16,0,Math.PI*2,0,Math.PI/2),
    new THREE.MeshStandardMaterial({color:0xed2029,roughness:.22,metalness:.14}));
  dome.rotation.x=Math.PI/2; dome.position.z=.055;g.add(dome);
  // Sphere top maps to +Z: its face points straight toward the visitor.
  for(const sx of [-1,1])for(const sy of [-1,1]){
    const screw=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.006,8),new THREE.MeshStandardMaterial({color:0x989993,metalness:.8,roughness:.3}));
    screw.rotation.x=Math.PI/2;screw.position.set(sx*.124,sy*.123,.061);g.add(screw);
  }
  return g;
}
export function createShaft(scene) {
  const shaft=new THREE.Group();shaft.visible=false;scene.add(shaft);
  box(shaft,[2.3,18,.14],[0,-5,-1],0x202b2d);
  for(const x of [-1.1,1.1])box(shaft,[.12,18,2.6],[x,-5,.2],0x162326);
  for(let y=-13;y<5;y+=1.2){
    box(shaft,[2.2,.035,.025],[0,y,-.9],0x8c7655);
    for(const x of [-.85,.85]){
      const strip=box(shaft,[.025,.3,.035],[x,y,-.88],0xf0cd81);
      strip.material.emissive.setHex(0xd1a75a);strip.material.emissiveIntensity=1.5;
    }
  }
  return shaft;
}
