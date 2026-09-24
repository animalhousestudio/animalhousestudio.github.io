const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
function edit(file,fn){const p=path.join(root,file);fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')));}
edit('src/main.js',s=>{
 s=s.replace("import { applyCurvedExterior } from './rooms/curvedExterior.mjs';","import { createInterior } from './rooms/interior.mjs';\nimport { FLOOR_Y, FLOOR_NAMES, HOUSE_X, HOUSE_Z, EYE_HEIGHT, ENTRY, nearestFloor } from './rooms/layout.mjs';\nimport { createGameMenu } from './ui/gameMenu.js';");
 s=s.replace('const FLOOR_Y = [-6.6, 1.26, 8.4, 17.04, 22.44];','');
 for(const [fn,i]of [['createBasement',0],['createLivingRoom',1],['createKitchen',2],['createUpperGallery',3],['createObservatory',4]]) {
   s=s.replace(new RegExp(`import \\{ ${fn} \\} from [^;]+;\\n`),'');s=s.replace(`${fn}()`,`createInterior(${i})`);
 }
 s=s.replace('const stairs = createSpiralStairs(); scene.add(stairs);','const stairs = createSpiralStairs(); stairs.position.set(HOUSE_X,0,HOUSE_Z); scene.add(stairs);');
 s=s.replace(/garden.userData.exteriorReady.then\(\(exterior\) => \{[\s\S]*?\n\}\);/,'');
 s=s.replaceAll('player.colliderRadius + 0.02','EYE_HEIGHT + 0.02');
 s=s.replace('<h1>casa in 3D</h1>','<h1>Una casa tra le stelle</h1>');
 s=s.replace(/dimMenu.innerHTML = `[\s\S]*?`;/,"dimMenu.innerHTML = '<span class=\"hud-brand\">ANIMAL HOUSE</span><button class=\"menu-toggle\" type=\"button\" aria-label=\"Apri menu\">Menu <kbd>Esc</kbd></button>'; ");
 s=s.replace("desktopHints.innerHTML = '<span>Guardati attorno con il tasto destro</span><span>Avanza con Spazio</span>';","desktopHints.innerHTML = '<span><kbd>W A S D</kbd> Muoviti · <kbd>Shift</kbd> Corri</span><span>Tasto destro per guardarti attorno · <kbd>E</kbd> Scale</span>';\nconst gameMenu = createGameMenu(uiRoot, player, dimMenu.querySelector('button')); ");
 s=s.replace("  else activateJetpack();","  else if (garden.userData.jetpack) activateJetpack();");
 s=s.replace('new THREE.Vector3(position.x, 0.86, position.z - 0.5)','new THREE.Vector3(ENTRY.x, EYE_HEIGHT + .8, ENTRY.z + 1.1)');
 s=s.replace('new THREE.Vector3(position.x, 1.61, 8.85)','new THREE.Vector3(ENTRY.x, FLOOR_Y[1] + EYE_HEIGHT, ENTRY.z - .6)');
 s=s.replace('Math.abs(position.x) < 2.15','Math.abs(position.x - ENTRY.x) < .85').replace('position.z > 9.35','position.z > ENTRY.z + .7').replace('position.z < 11.8','position.z < ENTRY.z + 2.5').replace('position.y < 1.31','position.y < EYE_HEIGHT + .6');
 s=s.replace('&#9650;</button>','Sali ↑</button>').replace('&#9660;</button>','Scendi ↓</button>');
 s=s.replace('<div class="stairs-inner">','<div class="stairs-title">Scegli il piano</div><div class="stairs-inner">');
 s=s.replace('  stairsMenu.style.display = \'block\';',`  const floor=nearestFloor(player.getPosition().y);
  stairUpBtn.disabled=floor===FLOOR_Y.length-1;stairDownBtn.disabled=floor===0;
  stairUpBtn.textContent=floor<FLOOR_Y.length-1 ? FLOOR_NAMES[floor+1]+' ↑' : 'Ultimo piano';
  stairDownBtn.textContent=floor>0 ? FLOOR_NAMES[floor-1]+' ↓' : 'Piano più basso';
  window.dispatchEvent(new Event('clearinput'));
  stairsMenu.style.display = 'block';`);
 s=s.replace(/Math.abs\(pos.y - FLOOR_Y\[i\]\)/g,'Math.abs(pos.y - EYE_HEIGHT - FLOOR_Y[i])');
 s=s.replaceAll('FLOOR_Y[idx] + 0.5','FLOOR_Y[idx] + EYE_HEIGHT').replaceAll('FLOOR_Y[target] + 0.5','FLOOR_Y[target] + EYE_HEIGHT');
 // Use the same unobstructed stair shaft in both directions.
 s=s.replace(/  \/\/ Special short exit[\s\S]*?  const radius = INTERNAL_STAIR_TRAVEL_RADIUS;/,'  const radius = INTERNAL_STAIR_TRAVEL_RADIUS;');
 s=s.replace('cz + 2.8','cz + 2.4');
 s=s.replace('!hit.object.userData.isStairsBound','!hit.object.userData.isStairsBound && hit.distance < 5');
 s=s.replace('        else player.update(dt, colliders);','        else if (!window.__APP.inputBlocked) player.update(dt, colliders);');
 s=s.replace("      if (cur) camera.userData.currentRoom = cur.userData.roomName;","      if (cur) camera.userData.currentRoom = cur.userData.roomName;");
 s=s.replace('function detectCurrentRoom(pos){',`document.addEventListener('keydown',event=>{
  if(event.code==='KeyE'&&!event.repeat&&!window.__APP.inputBlocked&&Math.hypot(player.camera.position.x-HOUSE_X,player.camera.position.z-HOUSE_Z)<4)showStairsMenu();
});
function detectCurrentRoom(pos){
  if(Math.abs(pos.x-HOUSE_X)<7.4&&Math.abs(pos.z-HOUSE_Z)<5.4&&pos.y>FLOOR_Y[0])return [basement,living,kitchen,upperGallery,observatory][nearestFloor(pos.y)];
  return garden;
}
function legacyDetectCurrentRoom(pos){`);
 s=s.replace('  inputBlocked: bootingScene || Boolean(landingIntro),','  inputBlocked: bootingScene || Boolean(landingIntro),\n  renderer,');
 return s;
});
edit('src/rooms/garden.js',s=>s.replace('mansion-v02.glb','mansion-v04.glb').replace("import * as THREE from 'three';","import * as THREE from 'three';\nimport { instanceStaticMeshes } from './optimize.mjs';")
 .replace('    g.userData.exteriorHome = exterior;','    instanceStaticMeshes(exterior);\n    g.userData.exteriorHome = exterior;')
 .replace('if (Math.abs(x) < 9.4 && Math.abs(z) < 9.4) return false;','if (x > -7.4 && x < 10.8 && z > -7.3 && z < 7.3) return false;\n    if (x > -11.4 && x < -5.5 && z > -1.5 && z < 4.6) return false;'));
edit('src/rooms/asteroid.mjs',s=>s.replaceAll('-7.35','-5.9').replaceAll('10.65','9.2').replaceAll('-9.37','-6.12').replaceAll('8.23','4.98').replace('opening-v1','opening-v4'));
edit('src/rooms/stairs.js',s=>s.replace("import * as THREE from 'three';","import * as THREE from 'three';\nimport { FLOOR_Y } from './layout.mjs';")
 .replace('[-6.6, 1.26, 8.4, 17.04, 22.44]','FLOOR_Y').replace('color: 0x715bb5','color: 0x765638').replace('emissiveIntensity: 0.35','emissiveIntensity: 0')
 .replace('const stepsPerFloor = 32;','const stepsPerFloor = 32;\n  const stepGeometry = new THREE.BoxGeometry(0.78, 0.1, 0.32);').replace('new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.1, 0.32), stepMat)','new THREE.Mesh(stepGeometry, stepMat)')
 .replace('22.52','FLOOR_Y.at(-1) + .04').replace('22.9','FLOOR_Y.at(-1) + .42').replaceAll('0, 5.22, 0','0, (FLOOR_Y[0]+FLOOR_Y.at(-1))/2, 0').replace('  g.add(returnMarker);','  // The landing is the return target; no floating marker.'));
edit('src/player/movement.js',s=>s.replace("import * as THREE from 'three';","import * as THREE from 'three';\nimport { EYE_HEIGHT } from '../rooms/layout.mjs';")
 .replaceAll('this.camera.position.y - this.colliderRadius','this.camera.position.y - EYE_HEIGHT').replaceAll('nextPos.y - this.colliderRadius','nextPos.y - EYE_HEIGHT').replaceAll('box.max.y + this.colliderRadius','box.max.y + EYE_HEIGHT').replaceAll('groundY + this.colliderRadius','groundY + EYE_HEIGHT')
 .replace('this.camera.position.set(0, 0.5, 10)','this.camera.position.set(0, EYE_HEIGHT, 14)')
 .replace('const rightVec = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));','const rightVec = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));'));
