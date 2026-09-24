import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import asteroidUrl from './assets/models/asteroid.glb?url';
import { prepareAsteroid } from './rooms/asteroid.mjs';
import { createArrival as createBaseArrival, ARRIVAL_DURATION } from './arrival.mjs';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Player } from './player/movement.js';
import { setupInput } from './player/input.mjs';
import { createGarden } from './rooms/garden.js';
import { createInterior } from './rooms/interior.mjs';
import { FLOOR_Y, FLOOR_NAMES, HOUSE_X, HOUSE_Z, BASE_HOUSE_X, BASE_HOUSE_Z, WORLD_SCALE, EYE_HEIGHT, ENTRY, nearestFloor } from './rooms/layout.mjs';
import { createGameMenu } from './ui/gameMenu.js';
import { RoomLabel } from './ui/roomLabel.js';
import { createElevator } from './rooms/elevator.mjs';
import arrivalVideoUrl from '../../assets/video/sfondo.mp4?url';
import arrivalLogoUrl from '../../assets/images/logo2.png?url';
import { entryHeightAt } from './rooms/entry.mjs';
import { createSpaceSky } from './spaceSky.mjs';



// Scale the environment, leaving the human viewpoint and walking speed unchanged.
function createArrival(aspect, height) {
  const base = createBaseArrival(aspect, height / WORLD_SCALE);
  return { start: base.start.clone().multiplyScalar(WORLD_SCALE), end: base.end.clone().multiplyScalar(WORLD_SCALE),
    sample(t) { const frame=base.sample(t); frame.position.multiplyScalar(WORLD_SCALE); frame.focus.multiplyScalar(WORLD_SCALE); return frame; } };
}
// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x071025, 1); // deep navy instead of full black
document.body.appendChild(renderer.domElement);
window.__APP = { inputBlocked: true };

const splash = document.createElement('section');
splash.className = 'arrival-splash';
splash.innerHTML = `
  <video class="arrival-splash__video" autoplay muted loop playsinline preload="auto" aria-hidden="true" src="${arrivalVideoUrl}"></video>
  <div class="arrival-splash__content">
    <img class="arrival-splash__logo" src="${arrivalLogoUrl}" alt="Animal House" width="517" height="483">
    <div class="arrival-splash__action">
      <progress class="arrival-splash__progress" max="100" value="0" aria-label="Caricamento del mondo"></progress>
      <button class="arrival-splash__start" type="button" disabled hidden>ATTERRA</button>
    </div>
    <p class="arrival-splash__status" role="status" hidden></p>
  </div>
`;
document.body.appendChild(splash);
const splashVideo = splash.querySelector('video');
splashVideo.muted = true;
splashVideo.play().catch(() => { /* Opaque background also covers autoplay restrictions. */ });
const loadProgress = splash.querySelector('progress');
let resolveAssets;
const allAssetsReady = new Promise(resolve => { resolveAssets = resolve; });
THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => {
  loadProgress.value = Math.max(loadProgress.value, Math.min(90, loaded / total * 90));
};
THREE.DefaultLoadingManager.onLoad = () => resolveAssets();

// simple on-screen status for debugging
const statusEl = document.createElement('div'); statusEl.style.position='fixed'; statusEl.style.left='12px'; statusEl.style.top='12px'; statusEl.style.padding='6px 10px'; statusEl.style.background='rgba(0,0,0,0.7)'; statusEl.style.color='#9fd'; statusEl.style.zIndex='9999'; statusEl.style.fontFamily='monospace'; statusEl.textContent='Initializing...'; statusEl.style.display='none'; document.body.appendChild(statusEl);

window.addEventListener('error', (e)=>{ statusEl.style.display='block'; statusEl.style.background='rgba(80,0,0,0.9)'; statusEl.textContent = 'ERROR: ' + (e.message || e.error || e); console.error(e); });
window.addEventListener('unhandledrejection', (e)=>{ statusEl.style.display='block'; statusEl.style.background='rgba(80,0,0,0.9)'; statusEl.textContent = 'UNHANDLED REJECTION: ' + (e.reason && e.reason.message ? e.reason.message : e.reason); console.error(e); });

// Scene
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b1020, 0.00065 / WORLD_SCALE);
const world = new THREE.Group(); world.name="EnvironmentScaleTrial"; world.scale.setScalar(WORLD_SCALE); scene.add(world);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 4000);
// add camera into the scene so child lights follow it (helmet light)
scene.add(camera);
// helmet / visor light to hint at an astronaut POV
const helmetLight = new THREE.PointLight(0xfff0d6, 1.0, 6);
helmetLight.position.set(0,0.2,0.5);
camera.add(helmetLight);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.62);
scene.add(ambient);
const dir = new THREE.DirectionalLight(0xe8f3ff, 0.8);
dir.position.set(5,10,2);
scene.add(dir);

// Space is rendered first with a rotation-only camera: nothing in the sky can
// cross the asteroid during the approach or be reached with the jetpack.
const spaceSky = createSpaceSky();
renderer.autoClear = false;
renderer.info.autoReset = false;
function renderWorld() {
  renderer.info.reset();
  renderer.clear();
  spaceSky.render(renderer, camera);
  renderer.clearDepth();
  renderer.render(scene, camera);
}
// Rooms (each returns a Group)
const garden = createGarden(); world.add(garden);
const basement = createInterior(0); world.add(basement);
const kitchen = createInterior(2); world.add(kitchen);
const upperGallery = createInterior(3); world.add(upperGallery);
const living = createInterior(1); world.add(living);
const observatory = createInterior(4); world.add(observatory);
const elevator = createElevator(); world.add(elevator);



// Terrain and vegetation keep using the garden's shared material and instances.
let asteroidTerrain = null;
const asteroidReady = new GLTFLoader().loadAsync(asteroidUrl).then(gltf => {
  asteroidTerrain = prepareAsteroid(gltf.scene, garden.userData.groundMaterial);
  world.add(asteroidTerrain.model);
  garden.userData.groundPanels.forEach(panel => { panel.visible = false; });
  return asteroidTerrain;
});

// Warm point lights inside each room to give them some character/atmosphere
const roomLightSpots = [
  { y: FLOOR_Y[0] + 3.0, color: 0xffb27a, intensity: 1.1 }, // basement - dim amber
  { y: FLOOR_Y[1] + 3.0, color: 0xffe0b0, intensity: 1.3 }, // living room - cozy fireplace glow
  { y: FLOOR_Y[2] + 3.0, color: 0xfff2d0, intensity: 1.2 }, // kitchen - warm white
  { y: FLOOR_Y[3] + 2.8, color: 0xffdfbe, intensity: 1.2 }, // new upper gallery
  { y: FLOOR_Y[4] + 2.7, color: 0x9fc6ff, intensity: 1.0 }, // observatory - cool starlight blue
];
roomLightSpots.forEach(spot => {
  const light = new THREE.PointLight(spot.color, spot.intensity, 9, 2);
  light.position.set(0, spot.y, -2);
  scene.add(light);
});

const rooms = [garden, basement, kitchen, living, upperGallery, observatory];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Build colliders from meshes with userData.collidable === true
function collectColliders(){
  world.updateMatrixWorld(true);
  const colliders = [];
  rooms.forEach(r => {
    r.traverse(child => {
      if (child.userData && child.userData.collidable) {
        const box = new THREE.Box3().setFromObject(child);
        colliders.push(box);
      }
    });
  });
  return colliders;
}
let colliders = collectColliders();

// Player controller (first-person)
// Camera is the player position, no body object needed
const player = new Player(camera, null, { gravity: -6, speed:7.6, runMultiplier:1.5,
  respawnPosition: new THREE.Vector3(0,EYE_HEIGHT,14*WORLD_SCALE),
  horizontalBlocked: (from,to,radius) => (garden.userData.entryDoor?.blocked(from,to,radius) ?? false)
    || (garden.userData.access?.blocked(from,to,radius) ?? false),
  groundHeightAt: (x, z, feet) => {
    const entryHeight = entryHeightAt(x, z, feet);
    if (entryHeight != null) return entryHeight;
    const accessHeight = garden.userData.access?.heightAt(x,z,feet);
    if (accessHeight != null) return accessHeight;
    const height = asteroidTerrain?.heightAt(x / WORLD_SCALE, z / WORLD_SCALE);
    return height == null ? null : height * WORLD_SCALE;
  } });
// Wait in space until the visitor explicitly starts the arrival.
let arrival = createArrival(camera.aspect, EYE_HEIGHT + 0.02);
player.setPosition(arrival.start);
function facePlayerAt(target) {
  const direction = new THREE.Vector3().subVectors(target, player.getPosition()).normalize();
  player.yaw = Math.atan2(direction.x, direction.z);
  player.pitch = Math.asin(direction.y);
  player.updateCamera();
}
facePlayerAt(arrival.sample(0).focus);
let landingIntro = null;
let bootingScene = true;
let landingStarted = false;
let arrivalReady = false;

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
dimMenu.innerHTML = '<span class="hud-brand">ANIMAL HOUSE</span><button class="menu-toggle" type="button" aria-label="Apri menu">Menu <kbd>Esc</kbd></button>'; 
uiRoot.appendChild(dimMenu);
dimMenu.style.visibility = 'hidden';
const desktopHints = document.createElement('div');
desktopHints.className = 'desktop-hints';
desktopHints.innerHTML = '<span><kbd>W A S D</kbd> Muoviti · <kbd>Shift</kbd> Corri</span><span>Tasto destro per guardarti attorno · <kbd>E</kbd> Ascensore</span>';
const elevatorHint = document.createElement('div');
elevatorHint.className = 'elevator-hint';
elevatorHint.innerHTML = '<span class="elevator-hint__desktop">premi E per attivare l\'ascensore</span><span class="elevator-hint__mobile">tocca la piastra per scegliere il piano</span>';
elevatorHint.style.display = 'none';
const gameMenu = createGameMenu(uiRoot, player, dimMenu.querySelector('button')); 
uiRoot.appendChild(desktopHints);
uiRoot.appendChild(elevatorHint);
let desktopHintsShown = false;
const mobileControls = document.querySelector('.mobile-controls');
if (mobileControls) mobileControls.style.display = 'none';

function activateJetpack() {
  if (player.jetpackEnabled) return;
  player.enableJetpack();
  // The pickup is collected once. Subsequent flight changes use the compact
  // persistent mobile control rather than leaving a duplicate world object.
  if (garden.userData.jetpack) garden.userData.jetpack.visible = false;
  window.dispatchEvent(new Event('jetpackenabled'));
  roomLabel.show('JETPACK ATTIVO — Space/E su, C/Ctrl giu, Shift boost. X per spegnere', 5500);
}

function deactivateJetpack() {
  if (!player.jetpackEnabled) return;
  player.disableJetpack();
  window.dispatchEvent(new Event('jetpackdisabled'));
  roomLabel.show('JETPACK DISATTIVATO', 2200);
}

window.addEventListener('jetpacktoggle', () => {
  if (window.__APP.inputBlocked) return;
  if (player.jetpackEnabled) deactivateJetpack();
  else if (garden.userData.jetpack) activateJetpack();
});

function beginLanding() {
  if (landingStarted || !arrivalReady) return;
  landingStarted = true;
  splash.classList.add('arrival-splash--hidden');
  window.setTimeout(() => { splashVideo.pause(); splashVideo.removeAttribute('src'); splashVideo.load(); splash.remove(); }, 850);
  bootingScene = false;
  landingIntro = {
    startedAt: performance.now(),
    duration: ARRIVAL_DURATION,
  };
}

function setGameplayControlsVisible(visible) {
  dimMenu.style.visibility = visible ? 'visible' : 'hidden';
  if (mobileControls) mobileControls.style.display = visible ? 'flex' : 'none';
  if (visible && !desktopHintsShown) {
    desktopHintsShown = true;
    desktopHints.style.opacity = '1';
    window.setTimeout(() => { desktopHints.style.opacity = '0'; }, 6200);
  }
}

const startButton = splash.querySelector('.arrival-splash__start');
startButton.addEventListener('click', beginLanding);
Promise.all([asteroidReady, garden.userData.exteriorReady, garden.userData.surfaceDetailsReady, allAssetsReady]).then(async () => {
  garden.userData.optimizeStaticGarden();
  loadProgress.value = 94;
  // Compile materials behind the opaque video before allowing the first flight.
  await Promise.all([renderer.compileAsync(scene, camera), renderer.compileAsync(spaceSky.scene, spaceSky.camera)]);
  renderWorld();
  loadProgress.value = 100;
  await new Promise(resolve => window.setTimeout(resolve, 250));
  arrivalReady = true;
  startButton.disabled = false;
  startButton.hidden = false;
  loadProgress.hidden = true;
  splash.classList.add('arrival-splash--ready');
}).catch(error => {
  console.error('Arrival assets failed to load.', error);
  startButton.textContent = 'RIPROVA';
  startButton.disabled = false;
  startButton.hidden = false;
  loadProgress.hidden = true;
  startButton.addEventListener('click', () => window.location.reload(), { once: true });
  splash.querySelector('.arrival-splash__status').textContent = 'Caricamento non riuscito. Tocca Riprova.';
  splash.querySelector('.arrival-splash__status').hidden = false;
});

const stairsMenu = document.createElement('div'); stairsMenu.className = 'stairs-menu';
stairsMenu.style.display = 'none';
stairsMenu.innerHTML = `<div class="stairs-title">Ascensore · scegli il piano</div><div class="stairs-inner"><button id="st-up" class="stair-btn" aria-label="Su">Sali ↑</button><button id="st-down" class="stair-btn" aria-label="Giu">Scendi ↓</button></div>`;
uiRoot.appendChild(stairsMenu);
let menuOpen = false;
let elevatorTravel = null;

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
  const cabin = elevator.userData.cabin;
  if (!cabin) return;
  cabin.traverse(m => {
    if (m.isMesh && m.material){
      if (on){ m.material.emissive = new THREE.Color(0x3366ff); m.material.emissiveIntensity = 0.25; }
      else { m.material.emissive = new THREE.Color(0x000000); m.material.emissiveIntensity = 0; }
    }
  });
}

const ELEVATOR_HINT_DISTANCE = 1.65 * WORLD_SCALE;
function nearestElevatorSelectorDistance() {
  const position = player.getPosition();
  let best = Infinity;
  for (const selector of elevator.userData.selectors || []) {
    const worldPosition = new THREE.Vector3();
    selector.getWorldPosition(worldPosition);
    best = Math.min(best, position.distanceTo(worldPosition));
  }
  return best;
}
function updateElevatorHint() {
  const active = !bootingScene && !landingIntro && !menuOpen && !elevatorTravel
    && nearestElevatorSelectorDistance() <= ELEVATOR_HINT_DISTANCE;
  elevatorHint.style.display = active ? 'block' : 'none';
}

function showStairsMenu(){
  // prevent reopening during cooldown
  const now = performance.now();
  if (now - lastStairsToggle < STAIRS_COOLDOWN) return;
  const floor=nearestFloor(player.getPosition().y);
  stairUpBtn.disabled=floor===FLOOR_Y.length-1;stairDownBtn.disabled=floor===0;
  stairUpBtn.textContent=floor<FLOOR_Y.length-1 ? FLOOR_NAMES[floor+1]+' ↑' : 'Ultimo piano';
  stairDownBtn.textContent=floor>0 ? FLOOR_NAMES[floor-1]+' ↓' : 'Piano più basso';
  window.dispatchEvent(new Event('clearinput'));
  stairsMenu.style.display = 'block'; menuOpen = true; window.__APP.inputBlocked = true; // hide mobile controls
  elevatorHint.style.display = 'none';
  const mob = document.querySelector('.mobile-controls'); if (mob) mob.style.display = 'none';
  highlightSteps(true);
  lastStairsToggle = performance.now();
}
function closeStairsMenu(){
  stairsMenu.style.display = 'none'; menuOpen = false; window.__APP.inputBlocked = false; const mob = document.querySelector('.mobile-controls'); if (mob) mob.style.display = 'flex';
  highlightSteps(false);
  lastStairsToggle = performance.now();
}

function movePlayerFloor(dir){
  const pos = player.getPosition();
  // find nearest floor
  let idx = 0; let best = Infinity;
  for (let i=0;i<FLOOR_Y.length;i++){ const d = Math.abs(pos.y - EYE_HEIGHT - FLOOR_Y[i]); if (d < best){ best = d; idx = i; } }
  let target = Math.min(FLOOR_Y.length-1, Math.max(0, idx + dir));
  if (target === idx) {
    closeStairsMenu();
    return;
  }

  const cx = HOUSE_X, cz = HOUSE_Z;
  // Enter the transparent cabin, travel vertically, then step back onto the
  // landing. The cabin itself follows the same normalized progress.
  const points = [
    pos.clone(),
    new THREE.Vector3(cx, pos.y, cz),
    new THREE.Vector3(cx, FLOOR_Y[target] + EYE_HEIGHT, cz),
    new THREE.Vector3(cx, FLOOR_Y[target] + EYE_HEIGHT, cz + 2.4 * WORLD_SCALE),
  ];
  elevatorTravel = {
    curve: new THREE.CatmullRomCurve3(points),
    from: idx,
    to: target,
    startedAt: performance.now(),
    duration: 1600 + Math.abs(target - idx) * 650,
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

// Only tapping a stair reopens its travel menu. This prevents the menu
// from trapping the player after they deliberately walk away.
let lastRoomLabelClick = 0;
const ROOM_LABEL_COOLDOWN = 400; // ms - avoids rapid-fire re-triggering on repeated clicks

function handleSceneInteraction(clientX, clientY) {
  if (window.__APP && window.__APP.inputBlocked) return;
  if (elevatorTravel) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  camera.updateMatrixWorld();
  raycaster.setFromCamera(pointer, camera);
  if (garden.userData.jetpack
    && raycaster.intersectObject(garden.userData.jetpack, true).length > 0) {
    activateJetpack();
    return;
  }
  const elevatorHit = raycaster.intersectObject(elevator, true).some(hit => hit.object.userData.isElevatorSelector && hit.distance < 5 * WORLD_SCALE);

  if (elevatorHit) {
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
}

renderer.domElement.addEventListener('click', (event) => {
  handleSceneInteraction(event.clientX, event.clientY);
});

let sceneTouchStart = null;
renderer.domElement.addEventListener('touchstart', (event) => {
  const touch = event.changedTouches[0];
  if (!touch || event.touches.length !== 1) return;
  sceneTouchStart = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
}, { passive: true });

renderer.domElement.addEventListener('touchend', (event) => {
  if (!sceneTouchStart) return;
  const touch = [...event.changedTouches].find(({ identifier }) => identifier === sceneTouchStart.id);
  if (!touch) return;

  const movement = Math.hypot(touch.clientX - sceneTouchStart.x, touch.clientY - sceneTouchStart.y);
  sceneTouchStart = null;
  if (movement > 12) return;

  event.preventDefault();
  handleSceneInteraction(touch.clientX, touch.clientY);
}, { passive: false });

renderer.domElement.addEventListener('touchcancel', () => {
  sceneTouchStart = null;
});

document.addEventListener('keydown',event=>{
  if(event.code==='KeyE'&&!event.repeat&&!window.__APP.inputBlocked&&nearestElevatorSelectorDistance()<=ELEVATOR_HINT_DISTANCE)showStairsMenu();
});
function detectCurrentRoom(pos){
  if(Math.abs(pos.x-HOUSE_X)<7.4 * WORLD_SCALE&&Math.abs(pos.z-HOUSE_Z)<5.4 * WORLD_SCALE&&pos.y>FLOOR_Y[0])return [basement,living,kitchen,upperGallery,observatory][nearestFloor(pos.y)];
  return garden;
}
function legacyDetectCurrentRoom(pos){
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
  if (bootingScene) {
    arrival = createArrival(camera.aspect, EYE_HEIGHT + 0.02);
    player.setPosition(arrival.start);
    facePlayerAt(arrival.sample(0).focus);
  }
});

// Animation loop
let last = performance.now();
const frameStats = { frames: 0, elapsed: 0, render: 0, fps: 0, renderMs: 0 };
function animate(){
    try{
      const now = performance.now();
      const dt = Math.min((now-last)/1000, 0.05); last = now;
      spaceSky.update(now);
      if (garden.userData.animateGrass) garden.userData.animateGrass(now * 0.001);
      if (garden.userData.animateJetpack) garden.userData.animateJetpack(now * 0.001);
      if (garden.userData.updateEntryDoor) garden.userData.updateEntryDoor(player.getPosition(), dt);
      updateElevatorHint();

      // update colliders if objects moved (static for now)
      if (bootingScene) {
        player.velocity.set(0, 0, 0);
      } else if (landingIntro) {
        const progress = Math.min(1, (now - landingIntro.startedAt) / landingIntro.duration);
        const frame = arrival.sample(progress);
        player.setPosition(frame.position);
        player.velocity.set(0, 0, 0);
        facePlayerAt(frame.focus);
        if (progress === 1) {
          landingIntro = null;
          window.__APP.inputBlocked = false;
          setGameplayControlsVisible(true);
        }
      } else if (elevatorTravel) {
        const progress = Math.min(1, (now - elevatorTravel.startedAt) / elevatorTravel.duration);
        const eased = progress * progress * (3 - 2 * progress);
        player.setPosition(elevatorTravel.curve.getPointAt(eased));
        const cabin = elevator.userData.cabin;
        if (cabin) cabin.position.y = THREE.MathUtils.lerp(
          elevator.userData.stops[elevatorTravel.from] + 0.12,
          elevator.userData.stops[elevatorTravel.to] + 0.12,
          eased,
        );
        player.velocity.set(0, 0, 0);

        if (progress === 1) {
          elevatorTravel = null;
          window.__APP.inputBlocked = false;
          lastStairsToggle = performance.now();
        }
      } else {
        if (!window.__APP.inputBlocked) player.update(dt, colliders);
      }

      // optionally update which room we're in
      const cur = detectCurrentRoom(player.getPosition());
      if (cur) camera.userData.currentRoom = cur.userData.roomName;

      const renderStart = performance.now();
      garden.userData.updateGrassDetail(camera.position.x / WORLD_SCALE, camera.position.y / WORLD_SCALE, camera.position.z / WORLD_SCALE);
      // The opaque loading screen needs only its video, not a second full GPU scene.
      if (!bootingScene) renderWorld();
      frameStats.frames++; frameStats.elapsed += now - (frameStats.last || now); frameStats.last = now;
      frameStats.render += performance.now() - renderStart;
      if (frameStats.elapsed >= 1000) {
        frameStats.fps = frameStats.frames * 1000 / frameStats.elapsed;
        frameStats.renderMs = frameStats.render / frameStats.frames;
        frameStats.frames = 0; frameStats.elapsed = 0; frameStats.render = 0;
      }
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
window.__APP = {
  scene,
  camera,
  player,
  rooms,
  inputBlocked: bootingScene || Boolean(landingIntro),
  renderer,
  openStairsMenu: showStairsMenu,
  closeStairsMenu: closeStairsMenu,
  elevator,
};

// Local architectural review, excluded from the normal game experience.
if (['127.0.0.1','localhost'].includes(location.hostname) && new URLSearchParams(location.search).has('review')) {
  const review=document.createElement('details');
  review.style.cssText='position:fixed;left:12px;top:12px;z-index:20000;background:#162329;color:#fff;padding:10px;max-width:min(420px,90vw);border:1px solid #897e61;border-radius:6px';
  const reviewTitle=document.createElement('summary');reviewTitle.textContent='Visita un ambiente · '+WORLD_SCALE+'×';reviewTitle.style.cssText='cursor:pointer;font-size:12px';review.append(reviewTitle);
  const reviewPoints=[...FLOOR_NAMES.map((name,i)=>({name,y:FLOOR_Y[i],x:.5,z:2.4})),
    {name:'Veranda',y:.441*WORLD_SCALE,x:-10.5,z:1.2},
    {name:'Voliera',y:9.962*WORLD_SCALE,x:-10,z:.3},
    {name:'Torre destra',y:9.845*WORLD_SCALE,x:14,z:.1},
    {name:'Torre sinistra',y:17.233*WORLD_SCALE,x:-12.5,z:4.5},
    {name:'Suolo e crateri',y:32*WORLD_SCALE,x:-30,z:48,pitch:-.55,hold:true},
    {name:'UFO',y:6*WORLD_SCALE,x:-30.65,z:-3.43,pitch:-.42,hold:true},
    {name:'Tastiera',y:0,x:-4.85,z:15.2,pitch:-.3,hold:true},
    {name:'Punchball',y:2.5*WORLD_SCALE,x:5.35,z:28.57,pitch:-.25,hold:true},
    {name:'Facciata · prestazioni',y:1,x:0,z:12,pitch:.18,hold:true},
    {name:'Ingresso',y:0,x:-.98,z:11.5,pitch:.15,hold:false},
    {name:'Poster sinistro',y:1*WORLD_SCALE,x:3.6,z:22.57,pitch:0,yaw:Math.PI/2,hold:true},
    {name:'Poster destro',y:1*WORLD_SCALE,x:7.1,z:22.57,pitch:0,yaw:-Math.PI/2,hold:true}];
  reviewPoints.forEach(({name,y,x,z,pitch=0,yaw=Math.PI,hold=false})=>{
    const button=document.createElement('button');button.textContent=name;button.style.cssText='background:#263431;color:#fff;border:1px solid #897e61;padding:8px;cursor:pointer';
    button.onclick=()=>{review.open=false;splashVideo.pause();splash.remove();bootingScene=false;landingIntro=null;elevatorTravel=null;window.__APP.inputBlocked=hold;setGameplayControlsVisible(true);player.setPosition(new THREE.Vector3(HOUSE_X+x * WORLD_SCALE,y+EYE_HEIGHT,HOUSE_Z+z * WORLD_SCALE));player.velocity.set(0,0,0);player.yaw=yaw;player.pitch=pitch;player.updateCamera();};review.append(button);
  });
  const stats=document.createElement('span');review.append(stats);document.body.append(review);
  setInterval(()=>{stats.textContent=`${frameStats.fps.toFixed(0)} FPS · render CPU ${frameStats.renderMs.toFixed(1)} ms · Draw ${renderer.info.render.calls} · ${(renderer.info.render.triangles/1000).toFixed(0)}k triangoli · chiamate risparmiate ${garden.userData.exteriorHome?.userData.drawCallsSaved ?? 0}`;},1000);
}
