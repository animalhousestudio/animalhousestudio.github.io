import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Player } from './player/movement.js';
import { setupInput } from './player/controls.js';
import { createObservatory } from './rooms/observatory.js';
import { createLivingRoom } from './rooms/livingRoom.js';
import { createKitchen } from './rooms/kitchen.js';
import { createBasement } from './rooms/basement.js';
import { createGarden } from './rooms/garden.js';
import { RoomLabel } from './ui/roomLabel.js';
import { createSpiralStairs } from './rooms/stairs.js';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x071025, 1); // deep navy instead of full black
document.body.appendChild(renderer.domElement);

// simple on-screen status for debugging
const statusEl = document.createElement('div'); statusEl.style.position='fixed'; statusEl.style.left='12px'; statusEl.style.top='12px'; statusEl.style.padding='6px 10px'; statusEl.style.background='rgba(0,0,0,0.7)'; statusEl.style.color='#9fd'; statusEl.style.zIndex='9999'; statusEl.style.fontFamily='monospace'; statusEl.textContent='Initializing...'; document.body.appendChild(statusEl);

window.addEventListener('error', (e)=>{ statusEl.style.background='rgba(80,0,0,0.9)'; statusEl.textContent = 'ERROR: ' + (e.message || e.error || e); console.error(e); });
window.addEventListener('unhandledrejection', (e)=>{ statusEl.style.background='rgba(80,0,0,0.9)'; statusEl.textContent = 'UNHANDLED REJECTION: ' + (e.reason && e.reason.message ? e.reason.message : e.reason); console.error(e); });

// Scene
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b1020, 0.02);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
// add camera into the scene so child lights follow it (helmet light)
scene.add(camera);
// helmet / visor light to hint at an astronaut POV
const helmetLight = new THREE.PointLight(0xfff0d6, 1.0, 6);
helmetLight.position.set(0,0.2,0.5);
camera.add(helmetLight);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambient);
const dir = new THREE.DirectionalLight(0xfff8e6, 0.6);
dir.position.set(5,10,2);
scene.add(dir);

// Layered procedural night sky. Every element is generated locally: no
// textures/assets are loaded, and each animation is lightweight enough for a
// browser scene.
const starsGeo = new THREE.BufferGeometry();
const starCount = 600;
const positions = new Float32Array(starCount * 3);
for (let i=0;i<starCount;i++){ const r = 40 + Math.random()*80; const theta = Math.random()*Math.PI*2; const phi = Math.acos((Math.random()*2)-1); positions[i*3] = r*Math.sin(phi)*Math.cos(theta); positions[i*3+1] = r*Math.sin(phi)*Math.sin(theta); positions[i*3+2] = r*Math.cos(phi); }
starsGeo.setAttribute('position', new THREE.BufferAttribute(positions,3));
const starsMat = new THREE.PointsMaterial({ color:0xeaf3ff, size:0.3, transparent:true, opacity:0.86, sizeAttenuation:true });
const starField = new THREE.Points(starsGeo, starsMat);
scene.add(starField);

const brightStarsGeo = new THREE.BufferGeometry();
const brightStarCount = 120;
const brightPositions = new Float32Array(brightStarCount * 3);
for (let i=0;i<brightStarCount;i++){ const r = 50 + Math.random()*75; const theta = Math.random()*Math.PI*2; const phi = Math.acos((Math.random()*2)-1); brightPositions[i*3] = r*Math.sin(phi)*Math.cos(theta); brightPositions[i*3+1] = r*Math.sin(phi)*Math.sin(theta); brightPositions[i*3+2] = r*Math.cos(phi); }
brightStarsGeo.setAttribute('position', new THREE.BufferAttribute(brightPositions,3));
const brightStarsMat = new THREE.PointsMaterial({ color:0xc7d8ff, size:0.58, transparent:true, opacity:0.72, sizeAttenuation:true });
const brightStarField = new THREE.Points(brightStarsGeo, brightStarsMat);
scene.add(brightStarField);

function createNebulaTexture(innerColor, outerColor){
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128,128,0,128,128,128);
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.45, outerColor);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0,0,256,256);
  return new THREE.CanvasTexture(canvas);
}
const nebulaGroup = new THREE.Group();
[
  { position:[-48,25,-62], scale:[35,18,1], inner:'rgba(125,75,195,0.25)', outer:'rgba(35,35,115,0.08)' },
  { position:[42,18,-60], scale:[28,14,1], inner:'rgba(54,122,178,0.20)', outer:'rgba(35,55,130,0.06)' },
].forEach(({position, scale, inner, outer}) => {
  const nebula = new THREE.Sprite(new THREE.SpriteMaterial({
    map:createNebulaTexture(inner, outer), transparent:true, depthWrite:false, opacity:0.8,
  }));
  nebula.position.set(...position);
  nebula.scale.set(...scale);
  nebulaGroup.add(nebula);
});
scene.add(nebulaGroup);

const shootingStarGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const shootingStarMat = new THREE.LineBasicMaterial({ color:0xe8f5ff, transparent:true, opacity:0 });
const shootingStar = new THREE.Line(shootingStarGeo, shootingStarMat);
shootingStar.frustumCulled = false;
scene.add(shootingStar);
let nextShootingStarAt = performance.now() + 5000 + Math.random() * 7000;
let shootingStarStartedAt = 0;

function updateSky(now){
  const time = now * 0.001;
  starsMat.opacity = 0.72 + Math.sin(time * 0.75) * 0.14;
  brightStarsMat.opacity = 0.52 + Math.sin(time * 1.15 + 1.7) * 0.24;
  nebulaGroup.rotation.y = time * 0.004;

  if (!shootingStarStartedAt && now >= nextShootingStarAt) {
    shootingStarStartedAt = now;
    const angle = Math.random() * Math.PI * 2;
    const height = 16 + Math.random() * 25;
    const start = new THREE.Vector3(Math.cos(angle) * 45, height, Math.sin(angle) * 45 - 42);
    const end = start.clone().add(new THREE.Vector3(7 + Math.random() * 5, -3 - Math.random() * 2, 5));
    shootingStarGeo.setFromPoints([start, end]);
    shootingStarMat.opacity = 0.95;
  }
  if (shootingStarStartedAt) {
    const progress = (now - shootingStarStartedAt) / 1000;
    shootingStarMat.opacity = Math.max(0, 0.95 * (1 - progress));
    if (progress >= 1) {
      shootingStarStartedAt = 0;
      nextShootingStarAt = now + 7000 + Math.random() * 11000;
    }
  }
}

// Large asteroid sphere for context (player stands on "surface" when standing on garden at y=0)
const asteroidGeo = new THREE.SphereGeometry(60, 32, 32);
const asteroidMat = new THREE.MeshStandardMaterial({ color: 0x314d31, roughness: 0.92, metalness: 0.02 });
const asteroid = new THREE.Mesh(asteroidGeo, asteroidMat);
asteroid.position.y = -60; // Center well below; garden surface y=0 sits on curved top
asteroid.receiveShadow = true;
scene.add(asteroid);

// Rooms (each returns a Group)
const garden = createGarden(); scene.add(garden);
const basement = createBasement(); scene.add(basement);
const kitchen = createKitchen(); scene.add(kitchen);
const living = createLivingRoom(); scene.add(living);
const observatory = createObservatory(); scene.add(observatory);
const stairs = createSpiralStairs(); scene.add(stairs);

// Warm point lights inside each room to give them some character/atmosphere
const roomLightSpots = [
  { y: -4.0 + 1.6, color: 0xffb27a, intensity: 1.1 }, // basement - dim amber
  { y: 0 + 1.8,     color: 0xffe0b0, intensity: 1.3 }, // living room - cozy fireplace glow
  { y: 2.8 + 1.8,   color: 0xfff2d0, intensity: 1.2 }, // kitchen - warm white
  { y: 6.4 + 2.2,   color: 0x9fc6ff, intensity: 1.0 }, // observatory - cool starlight blue
];
roomLightSpots.forEach(spot => {
  const light = new THREE.PointLight(spot.color, spot.intensity, 9, 2);
  light.position.set(0, spot.y, -2);
  scene.add(light);
});

const rooms = [garden, basement, kitchen, living, observatory];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Build colliders from meshes with userData.collidable === true
function collectColliders(){
  const colliders = [];
  rooms.forEach(r => {
    r.traverse(child => {
      if (child.userData && child.userData.collidable) {
        const box = new THREE.Box3().setFromObject(child);
        colliders.push(box);
      }
    });
  });
  // also include stairs collidable pieces (they're not in rooms array)
  stairs.traverse(c => { if (c.userData && c.userData.collidable){ colliders.push(new THREE.Box3().setFromObject(c)); } });
  return colliders;
}
let colliders = collectColliders();

// Player controller (first-person)
// Camera is the player position, no body object needed
const player = new Player(camera, null, { gravity: -6, speed:4.2, runMultiplier:1.9 });
// Start in garden, facing the house
const startPos = new THREE.Vector3(0, 0.5, 23);
player.setPosition(startPos);
// Compute yaw to face house center
const dx = 0 - startPos.x; 
const dz = 0 - startPos.z; 
player.yaw = Math.atan2(dx, dz);
player.pitch = 0;

// hook controls
const controls = null;
setupInput(renderer.domElement, controls, player);

// UI label
const roomLabel = new RoomLabel(document.getElementById('ui-root'));

// Stairs interaction UI
const uiRoot = document.getElementById('ui-root');

// Tiny top-right menu to switch dimensions. 3D is the current world;
// 2D links to the house index for now (animalhouselab.art), 1D also links
// there as a placeholder until a dedicated 1D view exists.
const dimMenu = document.createElement('div');
dimMenu.className = 'dim-menu';
dimMenu.innerHTML = `
  <a class="dim-link" href="https://animalhouselab.art" target="_self">1D</a>
  <span class="dim-sep">·</span>
  <a class="dim-link" href="https://animalhouselab.art" target="_self">2D</a>
  <span class="dim-sep">·</span>
  <span class="dim-link dim-active">3D</span>
`;
uiRoot.appendChild(dimMenu);

const stairsMenu = document.createElement('div'); stairsMenu.className = 'stairs-menu';
stairsMenu.style.display = 'none';
stairsMenu.innerHTML = `<div class="stairs-inner"><button id="st-up" class="stair-btn" aria-label="Su">&#9650;</button><button id="st-down" class="stair-btn" aria-label="Giu">&#9660;</button></div>`;
uiRoot.appendChild(stairsMenu);
let menuOpen = false;
let stairTravel = null;
// cooldown to avoid immediate re-open after closing or teleporting
let lastStairsToggle = 0;
const STAIRS_COOLDOWN = 700; // ms

// close menu on Escape, or drive it with the Up/Down arrow keys while open
document.addEventListener('keydown', (ev)=>{
  if (!menuOpen) return;
  if (ev.key === 'Escape') { closeStairsMenu(); return; }
  if (ev.code === 'ArrowUp') movePlayerFloor(1);
  else if (ev.code === 'ArrowDown') movePlayerFloor(-1);
});
document.addEventListener('pointerdown', (ev)=>{
  if (!menuOpen) return;
  if (!stairsMenu.contains(ev.target)) closeStairsMenu();
});

function highlightSteps(on){
  const stepsGroup = stairs.children.find(c => c.userData && c.userData.isStepsGroup);
  if (!stepsGroup) return;
  stepsGroup.traverse(m => {
    if (m.isMesh && m.material){
      if (on){ m.material.emissive = new THREE.Color(0x3366ff); m.material.emissiveIntensity = 0.25; }
      else { m.material.emissive = new THREE.Color(0x000000); m.material.emissiveIntensity = 0; }
    }
  });
}

function showStairsMenu(){
  // prevent reopening during cooldown
  const now = performance.now();
  if (now - lastStairsToggle < STAIRS_COOLDOWN) return;
  stairsMenu.style.display = 'block'; menuOpen = true; window.__APP.inputBlocked = true; // hide mobile controls
  const mob = document.querySelector('.mobile-controls'); if (mob) mob.style.display = 'none';
  highlightSteps(true);
  lastStairsToggle = performance.now();
}
function closeStairsMenu(){
  stairsMenu.style.display = 'none'; menuOpen = false; window.__APP.inputBlocked = false; const mob = document.querySelector('.mobile-controls'); if (mob) mob.style.display = 'flex';
  highlightSteps(false);
  lastStairsToggle = performance.now();
}

// floor Y positions (basement, living room, kitchen, observatory)
const FLOOR_Y = [-4.0, 0, 2.8, 6.4];

// Smoothly crossfade from the current camera position to a target position.
// Used for the external cave-to-basement entrance so it feels like appearing
// softly inside the room rather than clipping through the house.
let crossfade = null;
function doCaveEntrance(){
  if (crossfade || stairTravel) return;
  window.__APP.inputBlocked = true;
  const start = player.getPosition();
  const end = new THREE.Vector3(-4.5, FLOOR_Y[0] + 0.5, 1.0);
  crossfade = { start, end, startedAt: performance.now(), duration: 900 };
  lastStairsToggle = performance.now();
}

function movePlayerFloor(dir){
  const pos = player.getPosition();
  // find nearest floor
  let idx = 0; let best = Infinity;
  for (let i=0;i<FLOOR_Y.length;i++){ const d = Math.abs(pos.y - FLOOR_Y[i]); if (d < best){ best = d; idx = i; } }
  let target = Math.min(FLOOR_Y.length-1, Math.max(0, idx + dir));
  if (target === idx) {
    closeStairsMenu();
    return;
  }

  // Build a route rather than teleporting to the next floor.
  const bound = stairs.children.find(c=>c.userData && c.userData.isStairsBound);
  let cx = 0, cz = 0;
  if (bound){ const worldPos = new THREE.Vector3(); bound.getWorldPosition(worldPos); cx = worldPos.x; cz = worldPos.z; }
  const points = [pos.clone()];

  // Special short exit from the observatory: only a few steps toward the
  // centre, then straight down, so the top floor doesn't feel like a full
  // spiral descent (per user request).
  if (idx === FLOOR_Y.length - 1 && dir === -1) {
    points.push(new THREE.Vector3(cx, FLOOR_Y[idx] + 0.5, cz - 1.2));
    points.push(new THREE.Vector3(cx, FLOOR_Y[idx] - 0.2, cz));
    points.push(new THREE.Vector3(cx, FLOOR_Y[target] + 1.2, cz));
    points.push(new THREE.Vector3(cx, FLOOR_Y[target] + 0.5, cz + 1.8));
    stairTravel = {
      curve: new THREE.CatmullRomCurve3(points),
      startedAt: performance.now(),
      duration: 900,
    };
    lastStairsToggle = performance.now();
    closeStairsMenu();
    window.__APP.inputBlocked = true;
    player.setMoveState({ forward: false });
    return;
  }

  const radius = 1.45;
  const startAngle = Math.atan2(pos.z - cz, pos.x - cx);
  const turns = Math.max(1, Math.abs(target - idx)) * 1.15;

  // Move into the staircase before following its central spiral.
  points.push(new THREE.Vector3(
    cx + Math.cos(startAngle) * radius,
    pos.y,
    cz + Math.sin(startAngle) * radius
  ));
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    const angle = startAngle + dir * turns * Math.PI * 2 * t;
    points.push(new THREE.Vector3(
      cx + Math.cos(angle) * radius,
      THREE.MathUtils.lerp(FLOOR_Y[idx] + 0.5, FLOOR_Y[target] + 0.5, t),
      cz + Math.sin(angle) * radius
    ));
  }

  // The exit is deliberately outside the clickable landing, preventing any
  // accidental re-entry after the player reaches the new room.
  points.push(new THREE.Vector3(cx, FLOOR_Y[target] + 0.5, cz + 2.8));
  stairTravel = {
    curve: new THREE.CatmullRomCurve3(points),
    startedAt: performance.now(),
    duration: 1150 + Math.abs(FLOOR_Y[target] - FLOOR_Y[idx]) * 260,
  };

  lastStairsToggle = performance.now();
  closeStairsMenu();
  window.__APP.inputBlocked = true;
  player.setMoveState({ forward: false });
}

const stairUpBtn = stairsMenu.querySelector('#st-up');
const stairDownBtn = stairsMenu.querySelector('#st-down');
// touchstart + preventDefault gives reliable, instant taps on mobile (same
// pattern as the THRUST button); click covers desktop mouse users.
stairUpBtn.addEventListener('click', ()=> movePlayerFloor(1));
stairUpBtn.addEventListener('touchstart', (ev)=>{ ev.preventDefault(); movePlayerFloor(1); });
stairDownBtn.addEventListener('click', ()=> movePlayerFloor(-1));
stairDownBtn.addEventListener('touchstart', (ev)=>{ ev.preventDefault(); movePlayerFloor(-1); });

// Only clicking a stair reopens its travel menu. This prevents the menu
// from trapping the player after they deliberately walk away.
let lastRoomLabelClick = 0;
const ROOM_LABEL_COOLDOWN = 400; // ms - avoids rapid-fire re-triggering on repeated clicks

renderer.domElement.addEventListener('click', (e) => {
  if (stairTravel || crossfade) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  camera.updateMatrixWorld();
  raycaster.setFromCamera(pointer, camera);
  const basementEntrance = garden.userData.basementEntrance;
  if (basementEntrance) basementEntrance.updateMatrixWorld(true);
  const caveHits = basementEntrance ? raycaster.intersectObject(basementEntrance, true) : [];
  if (caveHits.length > 0) {
    // Fade the player out/in instead of using the normal stair animation,
    // which looks odd for an external cave hole (we'd have to travel through
    // the house vertically). We keep the camera direction and just teleport
    // smoothly to the basement floor.
    doCaveEntrance();
    return;
  }

  const stairHit = raycaster.intersectObject(stairs, true).some(hit =>
    !hit.object.userData.isStairsBound
  );

  if (stairHit) {
    // If we are already in the observatory, the player only has to go "down".
    // We skip the full menu and move straight down to keep the top floor exit
    // short and smooth (per user request, the observatory stair is just a few
    // steps at the center).
    const pos = player.getPosition();
    let idx = 0; let best = Infinity;
    for (let i=0;i<FLOOR_Y.length;i++){ const d = Math.abs(pos.y - FLOOR_Y[i]); if (d < best){ best = d; idx = i; } }
    if (idx === FLOOR_Y.length - 1) {
      movePlayerFloor(-1);
      return;
    }
    showStairsMenu();
    return;
  }

  // Raycast against the actual room contents (walls, furniture, floors) so
  // every generated piece is a genuine, working click target. Falls back to
  // the bounding-box check only when the click doesn't land on any mesh
  // (e.g. looking through a glass front into open space).
  const now2 = performance.now();
  if (now2 - lastRoomLabelClick < ROOM_LABEL_COOLDOWN) return;
  const current = detectRoomAtPointer();
  if (current) { roomLabel.show(current.userData.roomName); lastRoomLabelClick = now2; }
});

function detectCurrentRoom(pos){
  for (const r of rooms){
    const box = new THREE.Box3().setFromObject(r);
    if (box.containsPoint(pos)) return r;
  }
  return null;
}

// Resolves which room was actually clicked by raycasting against real
// geometry (walls, furniture, floors) first, then falling back to the
// player's current bounding-box room if the ray hits nothing (e.g. clicking
// through a glass front into open space beyond the house).
function detectRoomAtPointer(){
  const hits = raycaster.intersectObjects(rooms, true);
  if (hits.length > 0){
    let obj = hits[0].object;
    while (obj && !(obj.userData && obj.userData.roomName)) obj = obj.parent;
    if (obj) return obj;
  }
  return detectCurrentRoom(player.getPosition());
}

// check stairs contact in animation loop below

// Resize
window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
let last = performance.now();
function animate(){
    try{
      const now = performance.now();
      const dt = (now-last)/1000; last = now;
      updateSky(now);
      if (garden.userData.animateGrass) garden.userData.animateGrass(now * 0.001);

      // update colliders if objects moved (static for now)
      if (crossfade) {
        const progress = Math.min(1, (now - crossfade.startedAt) / crossfade.duration);
        const eased = progress * progress * (3 - 2 * progress);
        player.setPosition(new THREE.Vector3().lerpVectors(crossfade.start, crossfade.end, eased));
        player.velocity.set(0, 0, 0);
        if (progress === 1) {
          crossfade = null;
          window.__APP.inputBlocked = false;
          lastStairsToggle = performance.now();
        }
      } else if (stairTravel) {
        const progress = Math.min(1, (now - stairTravel.startedAt) / stairTravel.duration);
        const eased = progress * progress * (3 - 2 * progress);
        player.setPosition(stairTravel.curve.getPointAt(eased));
        player.velocity.set(0, 0, 0);

        if (progress === 1) {
          stairTravel = null;
          window.__APP.inputBlocked = false;
          lastStairsToggle = performance.now();
        }
      } else {
        player.update(dt, colliders);
      }

      // The entrance reacts to the approach from the garden. Door panels are
      // visual-only so their changing transform never leaves stale colliders.
      if (living.userData.setEntranceOpen) {
        const position = player.getPosition();
        const nearEntrance = Math.hypot(position.x, position.z - 9) < 5.5;
        living.userData.setEntranceOpen(nearEntrance);
      }

      // optionally update which room we're in
      const cur = detectCurrentRoom(player.getPosition());
      if (cur) camera.userData.currentRoom = cur.userData.roomName;

      renderer.render(scene, camera);
      statusEl.textContent = 'Running — pos: ' + player.getPosition().toArray().map(n=>n.toFixed(2)).join(',');
    } catch (err){
      console.error('Render error', err);
      statusEl.textContent = 'ERROR: ' + (err && err.message ? err.message : String(err));
      // stop animating to avoid flood
      return;
    }
    requestAnimationFrame(animate);
}
animate();

// expose for debugging
window.__APP = { scene, camera, player, rooms, openStairsMenu: showStairsMenu, closeStairsMenu: closeStairsMenu };
