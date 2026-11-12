import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import asteroidUrl from './assets/models/asteroid-v05.glb?url';
import { insideHouse, prepareAsteroid } from './rooms/asteroid.mjs';
import { addAsteroidSurfaceDetail } from './rooms/asteroidSurfaceDetail.mjs';
import { createArrival as createBaseArrival, ARRIVAL_DURATION } from './arrival.mjs';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Player } from './player/movement.js';
import { createFirstPersonBody } from './player/firstPersonBody.mjs';
import { CollisionWorld } from './player/collisionWorld.mjs';
import { setupInput } from './player/input.mjs';
import { createGarden } from './rooms/garden.js';
import { createInterior } from './rooms/interior.mjs';
import { FLOOR_Y, FLOOR_NAMES, HOUSE_X, HOUSE_Z, BASE_HOUSE_X, BASE_HOUSE_Z, WORLD_SCALE, EYE_HEIGHT, ENTRY, nearestFloor } from './rooms/layout.mjs';
import { createWorkInProgressNotice } from './ui/gameMenu.js';
import { RoomLabel } from './ui/roomLabel.js';
import { gameSoundtrack } from './music/soundtrack.mjs';
import { createArrivalFlight } from './ui/arrivalFlight.mjs';
import { COASTER_FIREWORKS, createArrivalFireworks, createArrivalFlares, createCoasterFireworks } from './arrivalFireworks.mjs';
import { createElevator, elevatorLandingAt } from './rooms/elevator.mjs';
import arrivalVideoUrl from '../../assets/video/sfondo.mp4?url';
import arrivalLogoUrl from '../../assets/images/logo2.png?url';
import { entryHeightAt } from './rooms/entry.mjs';
import { createSpaceSky } from './spaceSky.mjs';
import { createPondLayout, SECOND_POND_FOOTPRINT } from './rooms/pondLayout.mjs';
import { addDeepPond } from './rooms/deepPond.mjs';
import { terrainHeight } from './rooms/terrainDetail.mjs';
import { createWorldZones } from './world/zones.mjs';
import { registerWorldContent } from './world/content.mjs';
import { LYNX_TEMPLE_REVIEW_POINTS } from './rooms/lynxTempleLayout.mjs';
import { createLollipopPickup } from './player/lollipopPickup.mjs';
import { createTapGesture } from './player/tapGesture.mjs';
import { createIntercomCall } from './rooms/intercomLayout.mjs';
import { renderIntercomSurroundings } from './rooms/intercomBackground.mjs';
import { addAsteroidCoaster } from './rooms/asteroidCoaster.mjs';
import { addAsteroidAtmosphere } from './rooms/asteroidAtmosphere.mjs';
import { COASTER_DURATION } from './rooms/coasterLayout.mjs';
import { addScimmiaNpc } from './rooms/scimmiaNpc.mjs';
import { createConnectedPondSwimming } from './player/connectedPonds.mjs';
import { coasterVisualQuality } from './rooms/coasterQuality.mjs';
import { createCoasterLook } from './player/coasterLook.mjs';
import { addLandingMug } from './rooms/landingMug.mjs';
import { MUSIC_MONOLITH_PLACEMENT } from './rooms/arrivalLayout.mjs';
import { boothReachable, boothContainsVisitor, contactBoothApproach, CONTACT_BOOTH } from './rooms/contactBoothLayout.mjs';
import { experienceUrl, saveReturnState, takeReturnState } from './contact/navigation.mjs';
import './contact/contact.css';
import {WALKING_DEFAULTS} from './player/walkingDefaults.mjs';



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
const flight = createArrivalFlight();
let fireworks, flares, fireworksBounds, fireworksMode;
let atmosphere, atmospherePreview = null, atmosphereLandedAt = null;
const reducedEffects = matchMedia('(prefers-reduced-motion: reduce)');
function stopFlightEffects() {
  flight.stop();
  fireworks?.dispose();
  flares?.dispose();
  fireworks = undefined;
  flares = undefined;
  fireworksMode = undefined;
}
const soundtrack = gameSoundtrack();
if (new URLSearchParams(location.search).has('boothReturn')) soundtrack.restore();
const splashVideo = splash.querySelector('video');
splashVideo.muted = true;
splashVideo.play().catch(() => { /* Opaque background also covers autoplay restrictions. */ });
const loadProgress = splash.querySelector('progress');
THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => {
  loadProgress.value = Math.max(loadProgress.value, Math.min(90, loaded / total * 90));
};

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
function renderIntercomBackground(viewCamera) {
  renderIntercomSurroundings({ renderer, camera: viewCamera, scene, sky: spaceSky,
    entries: worldZones.entries, hidden: [playerBody.root, garden.userData.intercom?.root] });
}
function renderWorld(now = performance.now()) {
  renderer.info.reset();
  garden.userData.intercom?.render(renderer, camera, now * .001,
    { enabled: arrivalReady && !bootingScene && !landingIntro && !document.hidden && !player.swimming,
      renderBackground: renderIntercomBackground });
  // Count the optional tiny water pass together with the world rendering budget.
  for (const pond of garden.userData.ponds ?? []) pond.update(now * .001, camera, renderer.domElement.height, !bootingScene);
  const coaster = garden.userData.coaster;
  if (coaster?.containsWater(camera.position)) {
    coaster.updateUnderwater(); renderer.render(coaster.submergedScene, camera);
    return;
  }
  renderer.setClearColor(0x071025, 1);
  renderer.clear();
  spaceSky.render(renderer, camera);
  renderer.clearDepth();
  renderer.render(scene, camera);
}
// Rooms (each returns a Group)
const worldZones = createWorldZones();
const garden = createGarden({ prepareVisual: model => renderer.compileAsync(model, camera, scene) }); world.add(garden);
const basement = createInterior(0); world.add(basement);
const kitchen = createInterior(2); world.add(kitchen);
const upperGallery = createInterior(3); world.add(upperGallery);
const living = createInterior(1); world.add(living);
const observatory = createInterior(4); world.add(observatory);
const elevator = createElevator(); world.add(elevator);



// Terrain carries its baked palette; garden props share its height profile.
let asteroidTerrain = null;
let asteroidSurfaceDetail;
let scimmia;
let scimmiaReviewFollow = false;
const asteroidReady = new GLTFLoader().loadAsync(asteroidUrl).then(gltf => {
  const pondLayout = createPondLayout(gltf.scene, { heightAt: terrainHeight });
  const secondPondLayout = createPondLayout(gltf.scene, { heightAt: terrainHeight, footprint: SECOND_POND_FOOTPRINT });
  const pondLayouts = [pondLayout, secondPondLayout];
  asteroidTerrain = prepareAsteroid(gltf.scene, garden.userData.groundMaterial, { pondLayouts });
  world.add(asteroidTerrain.model);
  asteroidSurfaceDetail = addAsteroidSurfaceDetail(asteroidTerrain);
  const ponds = [addDeepPond(garden, pondLayout, renderer),
    addDeepPond(garden, secondPondLayout, renderer, { name: 'DeepGardenPondExit', key: 'secondPond' })];
  garden.userData.ponds = ponds;
  garden.userData.coaster = addAsteroidCoaster(garden, asteroidTerrain, ponds);
  player.pondSwimming = createConnectedPondSwimming(pondLayouts);
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

// Model promises must resolve before collision data is built. The renderer may
// subsequently merge meshes without changing this compact spatial index.
let colliders = new CollisionWorld();
function buildCollisionWorld() {
  world.updateMatrixWorld(true);
  const exterior = garden.userData.exteriorHome;
  player.firePoles = (exterior.userData.towerFloorRefinement?.towers ?? []).map(tower => {
    const bottom = new THREE.Vector3(tower.center[0], tower.poleBottom, tower.center[1]).applyMatrix4(exterior.matrixWorld);
    const top = new THREE.Vector3(tower.center[0], tower.levels.at(-1), tower.center[1]).applyMatrix4(exterior.matrixWorld);
    return { x: bottom.x, z: bottom.z, bottom: bottom.y, top: top.y };
  });
  colliders = new CollisionWorld();
  if (garden.userData.collisionSource) {
    colliders.addSource(garden.userData.collisionSource, exterior.matrixWorld);
    delete garden.userData.collisionSource;
  } else colliders.addRoot(exterior);
  for (const room of [basement, kitchen, living, upperGallery, observatory]) colliders.addRoot(room);
  for (const name of ['ContactBooth', 'AsteroidSurfaceDetails', 'NaturalRocks', 'NaturalTrees', 'RoundStoneLandscape', 'BlenderSoccerPitch', 'LandingBeehive', 'LollipopBasket', 'MusicMonolith', 'ChocolateTritonFountain', 'DeepGardenPond', 'DeepGardenPondExit', 'AsteroidCoaster', 'GardenStage', 'LynxTemple']) {
    const root = garden.getObjectByName(name);
    if (root) colliders.addRoot(root);
  }
  colliders.addRoot(elevator);
  for (const pivot of garden.userData.entryDoor?.pivots ?? []) {
    colliders.addDynamicRoot(pivot, { filter: node => /WalnutLeaf/.test(node.name) });
  }
  if (elevator.userData.cabin) colliders.addDynamicRoot(elevator.userData.cabin);
  if (elevator.userData.landingGates) colliders.addDynamicRoot(elevator.userData.landingGates);
  if(garden.userData.contactBooth?.userData.door)colliders.addDynamicRoot(garden.userData.contactBooth.userData.door.pivot,
    {filter:node=>node.userData.boothDoorPhysics===true});
  colliders.build();
  window.__APP.collisionWorld = colliders;
}

// Player controller (first-person)
// Camera remains the authoritative player position; the visual body follows it.
const player = new Player(camera, null, { ...WALKING_DEFAULTS,
  respawnPosition: new THREE.Vector3(0,EYE_HEIGHT,14*WORLD_SCALE),
  groundHeightAt: (x, z, feet) => {
    const entryHeight = entryHeightAt(x, z, feet);
    if (entryHeight != null) return entryHeight;
    const accessHeight = garden.userData.access?.heightAt(x,z,feet);
    if (accessHeight != null) return accessHeight;
    const height = asteroidTerrain?.heightAt(x / WORLD_SCALE, z / WORLD_SCALE);
    return height == null ? null : height * WORLD_SCALE;
  } });
const playerBody = createFirstPersonBody(scene, player);
addLandingMug(garden);
const coasterLook=createCoasterLook();
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
setupInput(renderer.domElement, controls, player, {
  canLook:()=>!document.hidden&&(!window.__APP.inputBlocked||(garden.userData.coaster?.ride.active&&!coasterBoarding)),
  rotateView:(dx,dy)=>garden.userData.coaster?.ride.active?coasterLook.rotate(dx,dy):player.rotateView(dx,dy),
});

// UI label
const roomLabel = new RoomLabel(document.getElementById('ui-root'));

// Stairs interaction UI
const uiRoot = document.getElementById('ui-root');

const noticeButton = createWorkInProgressNotice(uiRoot, player);
const elevatorHint = document.createElement('button');
elevatorHint.type = 'button';
elevatorHint.setAttribute('aria-label', 'Usa l’ascensore');
elevatorHint.className = 'elevator-hint';
elevatorHint.innerHTML = '<span class="elevator-hint__desktop">Usa l’ascensore · E</span><span class="elevator-hint__mobile">Usa l’ascensore</span>';
elevatorHint.addEventListener('click', () => showStairsMenu());
elevatorHint.style.display = 'none';
uiRoot.appendChild(elevatorHint);
const mobileControls = document.querySelector('.mobile-controls');
if (mobileControls) mobileControls.style.display = 'none';

const activePointers = new Set();
const sceneTap = createTapGesture();
let intercomCalling = false;
function interactionBlocked() {
  return !arrivalReady || bootingScene || Boolean(landingIntro) || Boolean(elevatorTravel)
    || garden.userData.coaster?.ride.active || intercomCalling || Boolean(window.__APP?.inputBlocked) || document.hidden || player.swimming;
}
let enteringBooth = false;
const boothButton = document.createElement('button');
boothButton.type = 'button'; boothButton.className = 'intercom-pickup'; boothButton.hidden = true;
boothButton.textContent = 'Entra nella cabina · E'; boothButton.dataset.testid = 'booth-enter'; uiRoot.append(boothButton);
function boothAvailable() {
  return !boothContainsVisitor(garden.userData.contactBooth,player.getPosition()) && !enteringBooth && boothReachable(garden.userData.contactBooth,player.getPosition(),interactionBlocked(),
    (from,to)=>colliders.hasLineOfSight(from,to));
}
function standInsideBooth() {
  const booth=garden.userData.contactBooth;
  booth.userData.door?.open({immediate:true});
  player.setPosition(booth.localToWorld(new THREE.Vector3(0,.16+EYE_HEIGHT/CONTACT_BOOTH.scale,.60)));
  player.velocity.set(0,0,0);
  facePlayerAt(booth.localToWorld(new THREE.Vector3(0,1.07,-.62)));
}
function enterContactBooth() {
  if(activePointers.size)return false;
  const booth=garden.userData.contactBooth,door=booth?.userData.door;
  if(door&&!door.isOpen&&door.available(booth,player.getPosition(),interactionBlocked(),(from,to)=>colliders.hasLineOfSight(from,to))){
    door.open();return true;
  }
  if(!boothAvailable()||!door?.passable)return false;
  standInsideBooth();return true;
}
boothButton.addEventListener('click',enterContactBooth);
const boothMessage=document.createElement('dialog');boothMessage.className='contact-dialog booth-message';
boothMessage.setAttribute('aria-labelledby','booth-message-title');
boothMessage.innerHTML='<form method="dialog"><h2 id="booth-message-title">MESSAGGIO</h2><label for="booth-message-text">Il tuo messaggio</label><textarea id="booth-message-text" rows="5" maxlength="4000"></textarea><small>Invio email non ancora attivo.</small><div class="contact-dialog-actions"><button type="submit">Chiudi</button><button type="button" disabled>Invia</button></div></form>';
uiRoot.append(boothMessage);
const boothControlButtons=['MESSAGGIO','SALA INFORMAZIONI'].map((name,index)=>{
  const button=document.createElement('button');button.type='button';button.className='booth-control-hit';button.hidden=true;
  button.setAttribute('aria-label',name);button.dataset.testid=`booth-control-${index+1}`;
  button.onclick=()=>activateBoothControl(index);uiRoot.append(button);return button;
});
boothMessage.addEventListener('close',()=>{
  window.__APP.inputBlocked=false;window.dispatchEvent(new Event('clearinput'));boothControlButtons[0].focus();
});
function boothControlAvailable(index) {
  if(enteringBooth||interactionBlocked()||!boothContainsVisitor(garden.userData.contactBooth,player.getPosition()))return false;
  const button=garden.userData.contactBooth?.userData.controls?.buttons[index];if(!button)return false;
  const target=button.getWorldPosition(new THREE.Vector3());
  return player.getPosition().distanceTo(target)<3 && colliders.hasLineOfSight(player.getPosition(),target);
}
function preferredBoothControl(){
  const buttons=garden.userData.contactBooth?.userData.controls?.buttons;if(!buttons)return -1;
  const forward=camera.getWorldDirection(new THREE.Vector3());let selected=-1,best=.8;
  buttons.forEach((button,index)=>{
    if(!boothControlAvailable(index))return;
    const score=button.getWorldPosition(new THREE.Vector3()).sub(player.getPosition()).normalize().dot(forward);
    if(score>best){best=score;selected=index;}
  });return selected;
}
function activateBoothControl(index) {
  if(activePointers.size||!boothControlAvailable(index))return false;
  if(index===0){
    window.__APP.inputBlocked=true;window.dispatchEvent(new Event('clearinput'));player.velocity.set(0,0,0);
    boothMessage.showModal();boothMessage.querySelector('textarea').focus();return true;
  }
  enteringBooth=true;
  saveReturnState(sessionStorage,{position:player.getPosition().toArray(),yaw:player.yaw,pitch:player.pitch,
    lollipop:playerBody.equipment.equipped,mug:playerBody.mugEquipment.equipped,jetpack:player.jetpackEnabled,
    boothDoorOpen:garden.userData.contactBooth.userData.door.isOpen});
  window.__APP.inputBlocked=true;window.dispatchEvent(new Event('clearinput'));
  // Only button two leaves the world and loads the isolated descent/minigame.
  soundtrack.handoff();
  const url=experienceUrl(location.href,'contact');url.searchParams.set('travel','down');location.assign(url);
  return true;
}
function updateBoothControls(){
  const buttons=garden.userData.contactBooth?.userData.controls?.buttons;
  const inside=boothContainsVisitor(garden.userData.contactBooth,player.getPosition());
  const fov=inside?Math.max(75,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.PI/6)/camera.aspect))):75;
  if(Math.abs(camera.fov-fov)>.01){camera.fov=fov;camera.updateProjectionMatrix();}
  camera.updateMatrixWorld();
  boothControlButtons.forEach((element,index)=>{
    if(!buttons||!boothControlAvailable(index)){element.hidden=true;return;}
    const point=buttons[index].getWorldPosition(new THREE.Vector3()).project(camera);
    element.hidden=Math.abs(point.x)>1||Math.abs(point.y)>1||point.z< -1||point.z>1;
    element.style.left=`${(point.x*.5+.5)*innerWidth}px`;element.style.top=`${(-point.y*.5+.5)*innerHeight}px`;
  });
}
const coasterDialog=document.createElement('dialog');coasterDialog.className='game-menu';
coasterDialog.setAttribute('aria-labelledby','coaster-question');
coasterDialog.innerHTML='<h2 id="coaster-question">Vuoi fare un giro?</h2><p>Si scende alla fine, quando torniamo sull’asteroide.</p><button class="resume-button" type="button" data-ride="yes">Sì, partiamo!</button><button class="resume-button" type="button" data-ride="no">Non ora</button>';
uiRoot.append(coasterDialog);
let coasterBoarding=null,currentCoasterFrame=null,coasterHadJetpack=false;
let coasterReviewProbe=false;
const rideQuality={active:false,grassDensity:1,maxDetail:Infinity};
const coasterCameraFlip=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
function coasterAvailable(hitPoint=null) {
  const coaster=garden.userData.coaster;
  if(!coaster||interactionBlocked())return false;
  const eye=player.getPosition();coaster.board.updateWorldMatrix(true,true);
  const targets=hitPoint?[hitPoint]:coaster.board.children.map(car=>car.localToWorld(new THREE.Vector3(0,1.2,0)));
  return targets.some(target=>eye.distanceTo(target)<7&&colliders.hasLineOfSight(eye,target));
}
function requestCoasterRide(hitPoint=null){
  if(activePointers.size||!coasterAvailable(hitPoint))return false;
  window.__APP.inputBlocked=true;window.dispatchEvent(new Event('clearinput'));player.velocity.set(0,0,0);
  coasterDialog.showModal();return true;
}
function closeCoasterQuestion(){
  coasterDialog.close();window.__APP.inputBlocked=false;window.dispatchEvent(new Event('clearinput'));
}
function startCoaster() {
  const coaster=garden.userData.coaster;
  if(activePointers.size||interactionBlocked()||!coaster?.ride.start())return false;
  coasterReviewProbe=false;
  coaster.setBoard(coaster.route.frameAt(0));
  coasterLook.reset();playerBody.mugEquipment.setSuppressed(true);playerBody.equipment.setSuppressed(true);
  coasterHadJetpack=player.jetpackEnabled;player.disableJetpack();player.pondSwimming?.reset(player);
  coasterBoarding={elapsed:0,position:player.getPosition(),quaternion:camera.quaternion.clone()};
  window.__APP.inputBlocked=true;window.dispatchEvent(new Event('clearinput'));player.velocity.set(0,0,0);
  setGameplayControlsVisible(false);return true;
}
function stopCoaster() {
  const coaster=garden.userData.coaster;if(!coaster?.ride.stop())return;
  stopFlightEffects();
  coasterBoarding=null;currentCoasterFrame=null;coaster.setBoard(coaster.route.frameAt(0));
  coasterLook.reset();playerBody.mugEquipment.setSuppressed(false);playerBody.equipment.setSuppressed(false);
  player.setPosition(coaster.exitPosition);player.velocity.set(0,0,0);player.yaw=Math.PI;player.pitch=0;player.updateCamera();
  if(coasterHadJetpack)player.enableJetpack();window.__APP.inputBlocked=false;window.dispatchEvent(new Event('clearinput'));
  setGameplayControlsVisible(true);
}
function updateCoasterFireworks(progress, review = false) {
  const {start,end} = COASTER_FIREWORKS;
  if (progress < start || progress >= end || (!review && reducedEffects.matches)) {
    if (fireworksMode === 'coaster') stopFlightEffects();
    return;
  }
  const ride = garden.userData.coaster.ride;
  if (!fireworks) {
    fireworks = createCoasterFireworks(scene, {
      bounds:fireworksBounds, duration:(end-start)*COASTER_DURATION, aspect:camera.aspect,
      sample: t => {
        const frame = ride.sample(THREE.MathUtils.lerp(start,end,t));
        return {position:frame.eye,forward:frame.forward,up:frame.up};
      },
    });
    fireworksMode = 'coaster';
  }
  const visible = !document.hidden && !garden.userData.coaster.containsWater(camera.position);
  fireworks.update((progress-start)*COASTER_DURATION,renderer.domElement.height,visible);
}
function updateCoaster(dt) {
  const coaster=garden.userData.coaster;
  if(coasterBoarding) {
    coasterBoarding.elapsed+=document.hidden?0:dt;
    const frame=coaster.ride.sample(0),blend=THREE.MathUtils.smoothstep(coasterBoarding.elapsed,0,.9);
    camera.position.lerpVectors(coasterBoarding.position,frame.eye,blend);
    camera.quaternion.slerpQuaternions(coasterBoarding.quaternion,frame.quaternion.clone().multiply(coasterCameraFlip),blend);
    if(blend===1)coasterBoarding=null;
    currentCoasterFrame=frame;camera.updateMatrixWorld(true);return;
  }
  const frame=coaster.ride.update(document.hidden?0:dt);currentCoasterFrame=frame;
  if(frame.finished){stopCoaster();return;}
  coaster.setBoard(frame);camera.position.copy(frame.eye);camera.quaternion.copy(frame.quaternion).multiply(coasterCameraFlip);
  coasterLook.apply(camera.quaternion);
  player.colliderSphere.center.copy(frame.eye);player.yaw=Math.atan2(frame.forward.x,frame.forward.z);player.pitch=Math.asin(frame.forward.y);
  camera.updateMatrixWorld(true);
  updateCoasterFireworks(frame.progress);
}
coasterDialog.querySelector('[data-ride="yes"]').addEventListener('click',()=>{closeCoasterQuestion();startCoaster();});
coasterDialog.querySelector('[data-ride="no"]').addEventListener('click',closeCoasterQuestion);
coasterDialog.addEventListener('cancel',event=>{event.preventDefault();closeCoasterQuestion();});
const intercomButton = document.createElement('button');
intercomButton.type = 'button'; intercomButton.className = 'intercom-pickup'; intercomButton.hidden = true;
intercomButton.dataset.testid = 'intercom-ring'; intercomButton.innerHTML = 'Suona il videocitofono <kbd>E</kbd>';
intercomButton.setAttribute('aria-label', 'Suona il videocitofono'); uiRoot.append(intercomButton);
const intercomOverlay = document.createElement('section'); intercomOverlay.className = 'intercom-call'; intercomOverlay.hidden = true;
intercomOverlay.setAttribute('role', 'status'); intercomOverlay.setAttribute('aria-live', 'polite');
intercomOverlay.innerHTML = '<div><span class="intercom-call__signal" aria-hidden="true">◉</span><p>Chiamata in corso…</p><small>Il video sarà disponibile qui.</small><div class="intercom-call__progress"></div></div>';
uiRoot.append(intercomOverlay);
const intercomCall = createIntercomCall({
  getTarget: () => garden.userData.entryDoor?.isOpen ? null : garden.userData.intercom?.target,
  isBlocked: interactionBlocked,
  hasLineOfSight: (from, to) => colliders.hasLineOfSight(from, to),
  onStart: () => {
    intercomCalling = true; window.__APP.inputBlocked = true;
    window.dispatchEvent(new Event('clearinput')); player.velocity.set(0, 0, 0);
    intercomOverlay.hidden = false; intercomButton.hidden = true;
  },
  onOpen: () => garden.userData.entryDoor?.requestOpen(),
  onFinish: () => {
    intercomCalling = false; window.__APP.inputBlocked = false; intercomOverlay.hidden = true;
    window.dispatchEvent(new Event('clearinput')); roomLabel.show('Porta aperta', 2500);
  },
});
function ringIntercom() {
  return !activePointers.size && intercomCall.ring(player.getPosition(), performance.now() * .001);
}
intercomButton.addEventListener('click', ringIntercom);
const lollipopPickup = createLollipopPickup({
  equipment: playerBody.equipment,
  getBasket: () => garden.userData.lollipopBasket,
  getEye: () => player.getPosition(),
  isBlocked: interactionBlocked,
  hasLineOfSight: (from, to) => colliders.hasLineOfSight(from, to),
});
const lollipopButton = document.createElement('button');
lollipopButton.type = 'button'; lollipopButton.className = 'lollipop-pickup';
lollipopButton.dataset.testid = 'lollipop-pickup'; lollipopButton.hidden = true;
lollipopButton.innerHTML = 'Prendi un leccalecca <kbd>E</kbd>';
lollipopButton.setAttribute('aria-label', 'Prendi un leccalecca dal cesto');
uiRoot.append(lollipopButton);
function collectLollipop(hitPoint = null) {
  if (activePointers.size || !lollipopPickup.collect(hitPoint)) return false;
  lollipopButton.hidden = true;
  roomLabel.show('Leccalecca raccolto', 3200);
  return true;
}
lollipopButton.addEventListener('click', () => collectLollipop());
const mugPickup=createLollipopPickup({equipment:playerBody.mugEquipment,getBasket:()=>garden.userData.mug,
  getEye:()=>player.getPosition(),isBlocked:interactionBlocked,targetHeight:.2,
  hasLineOfSight:(from,to)=>colliders.hasLineOfSight(from,to)});
const mugButton=document.createElement('button');mugButton.type='button';mugButton.className='lollipop-pickup';
mugButton.hidden=true;mugButton.textContent='Prendi la tazza · E';mugButton.setAttribute('aria-label','Prendi la tazza');uiRoot.append(mugButton);
function collectMug(hitPoint=null){
  if(activePointers.size||!mugPickup.collect(hitPoint))return false;
  garden.userData.mug.visible=false;mugButton.hidden=true;roomLabel.show('Tazza raccolta',2500);return true;
}
mugButton.addEventListener('click',()=>collectMug());
const musicCenter = new THREE.Vector3();
const musicNormal = new THREE.Vector3();
const musicOffset = new THREE.Vector3();
function availableMusicScreen() {
  const screen = garden.userData.musicMonolithScreen;
  if (!screen || interactionBlocked()) return null;
  const eye = player.getPosition();
  screen.getWorldPosition(musicCenter);
  musicOffset.subVectors(eye, musicCenter);
  if (musicOffset.lengthSq() > 3.25 ** 2) return null;
  screen.getWorldDirection(musicNormal);
  return musicNormal.dot(musicOffset) > 0 && colliders.hasLineOfSight(eye, musicCenter) ? screen : null;
}
function useMusicControl(action = 'toggle') {
  if (activePointers.size || !availableMusicScreen()) return false;
  soundtrack[action]();
  return true;
}
function updateLollipopHint() {
  const door=garden.userData.contactBooth?.userData.door;
  const canOpenDoor=door&&!door.isOpen&&door.available(garden.userData.contactBooth,player.getPosition(),interactionBlocked(),(from,to)=>colliders.hasLineOfSight(from,to));
  const nearBooth = Boolean(canOpenDoor||(door?.isOpen&&boothAvailable())); boothButton.hidden = !nearBooth;
  boothButton.textContent=canOpenDoor?'Apri la porta della cabina · E':door&&!door.passable?'Apertura della porta…':'Entra nella cabina · E';
  boothButton.disabled=nearBooth&&!canOpenDoor&&!door?.passable;
  updateBoothControls();
  const available = lollipopPickup.available();
  const intercomAvailable = intercomCall.available(player.getPosition());
  intercomButton.hidden = !intercomAvailable;
  const mugAvailable = mugPickup.available();
  lollipopButton.hidden = !available;
  mugButton.hidden = !mugAvailable || available;
  lollipopButton.dataset.equipped = String(playerBody.equipment.equipped);
  lollipopButton.dataset.available = String(available);
  const touchInteract = mobileControls?.querySelector('.touch-interact');
  if (touchInteract) {
    const boothChoice=preferredBoothControl();
    touchInteract.textContent = boothChoice===0 ? 'MESSAGGIO' : boothChoice===1 ? 'SALA INFORMAZIONI' : canOpenDoor ? 'Apri la cabina' : nearBooth ? 'Entra nella cabina' : intercomAvailable ? 'Suona citofono' : available ? 'Prendi leccalecca' : mugAvailable ? 'Prendi la tazza' : 'Scale ↑↓';
    touchInteract.setAttribute('aria-label',touchInteract.textContent);
  }
}

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
  scimmia?.preload();
  soundtrack.play();
  if (!reducedEffects.matches) {
    flight.start();
    fireworks = createArrivalFireworks(scene, {
      bounds:fireworksBounds, duration:ARRIVAL_DURATION/1000, aspect:camera.aspect,
      sample: progress => {
        const frame = arrival.sample(progress);
        return {position:frame.position,forward:frame.focus.sub(frame.position).normalize()};
      },
    });
    fireworksMode = 'arrival';
    flares = createArrivalFlares(camera,ARRIVAL_DURATION/1000,new THREE.Vector3(HOUSE_X,8,HOUSE_Z));
  }
  splash.classList.add('arrival-splash--hidden');
  window.setTimeout(() => { splashVideo.pause(); splashVideo.removeAttribute('src'); splashVideo.load(); splash.remove(); }, 850);
  bootingScene = false;
  landingIntro = {
    startedAt: performance.now(),
    duration: ARRIVAL_DURATION,
  };
}

function setGameplayControlsVisible(visible) {
  noticeButton.hidden = !visible;
  if (mobileControls) mobileControls.style.display = visible ? 'flex' : 'none';
}

const startButton = splash.querySelector('.arrival-splash__start');
startButton.addEventListener('click', beginLanding);
// Required terrain/architecture/collisions and the small visual baseline only.
// Higher visual tiers are independent of this gate and can fail without blocking play.
Promise.all([playerBody.ready, asteroidReady, garden.userData.exteriorReady, garden.userData.surfaceDetailsReady, garden.userData.landscapeReady, garden.userData.beehiveReady, garden.userData.chocolateFountainReady, garden.userData.stageReady, garden.userData.lynxTempleReady, garden.userData.lollipopBasketReady, garden.userData.contactBoothReady, garden.userData.musicMonolithReady]).then(async () => {
  soundtrack.observe(garden.userData.musicMonolithControls.setState);
  const rocks = garden.getObjectByName('NaturalRocks');
  rocks?.updateWorldMatrix(true,false);
  const rockBounds = rocks?.userData.placementBounds?.map(box => box.clone().applyMatrix4(rocks.matrixWorld)) ?? [];
  scimmia = addScimmiaNpc(garden, garden.userData.coaster.supports, asteroidTerrain.heightAt, rockBounds);
  atmosphere = addAsteroidAtmosphere(world,(x,z) => {
    const localX=x/WORLD_SCALE, localZ=z/WORLD_SCALE;
    if (garden.userData.ponds.some(pond => pond.layout.contains(localX,localZ))) return null;
    const y = asteroidTerrain.heightAt(localX,localZ);
    return y === null ? null : y*WORLD_SCALE;
  },garden.userData.coaster.supports);
  registerWorldContent(worldZones, world, { asteroid: asteroidTerrain.model, elevator });
  garden.userData.intercom?.attachBody(playerBody.root);
  buildCollisionWorld();
  fireworksBounds = new THREE.Box3().setFromObject(asteroidTerrain.model)
    .union(new THREE.Box3().setFromObject(garden.userData.exteriorHome));
  garden.userData.optimizeStaticGarden();
  worldZones.refreshBounds();
  loadProgress.value = 94;
  // Compile materials behind the opaque video before allowing the first flight.
  await Promise.all([renderer.compileAsync(scene, camera), renderer.compileAsync(spaceSky.scene, spaceSky.camera),
    renderer.compileAsync(garden.userData.pond.submergedScene, camera),
    renderer.compileAsync(garden.userData.coaster.submergedScene, camera)]);
  renderWorld();
  loadProgress.value = 100;
  await new Promise(resolve => window.setTimeout(resolve, 250));
  arrivalReady = true;
  startButton.disabled = false;
  startButton.hidden = false;
  loadProgress.hidden = true;
  splash.classList.add('arrival-splash--ready');
  if (new URLSearchParams(location.search).has('boothReturn')) {
    const saved = takeReturnState(sessionStorage);
    const booth = garden.userData.contactBooth;
    const fallback = contactBoothApproach(booth,1.5,EYE_HEIGHT);
    if(saved?.boothDoorOpen)booth.userData.door.open({immediate:true});
    splashVideo.pause(); splash.remove(); bootingScene=false; landingIntro=null; landingStarted=true;
    const savedEye = saved && new THREE.Vector3(...saved.position);
    const nearBooth = savedEye && savedEye.distanceTo(fallback) < 10;
    player.setPosition(nearBooth ? savedEye : fallback);
    player.yaw=nearBooth ? saved.yaw : booth.rotation.y+Math.PI;
    player.pitch=nearBooth ? saved.pitch : 0; player.velocity.set(0,0,0); player.updateCamera();
    if(saved?.lollipop)playerBody.equipment.collect();
    if(saved?.mug){playerBody.mugEquipment.collect();garden.userData.mug.visible=false;}
    if(saved?.jetpack)activateJetpack();
    window.__APP.inputBlocked=false; window.dispatchEvent(new Event('clearinput')); setGameplayControlsVisible(true);
    const clean = new URL(location.href); clean.searchParams.delete('boothReturn'); history.replaceState(null,'',clean);
  }
  if(new URLSearchParams(location.search).has('boothEnter')){
    splashVideo.pause();splash.remove();bootingScene=false;landingIntro=null;landingStarted=true;
    standInsideBooth();window.__APP.inputBlocked=false;window.dispatchEvent(new Event('clearinput'));setGameplayControlsVisible(true);
    const clean=new URL(location.href);clean.searchParams.delete('boothEnter');history.replaceState(null,'',clean);
  }
  openInitialReview?.();
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

function canUseElevator() {
  return !interactionBlocked() && elevatorLandingAt(player.getPosition()) !== null;
}
function updateElevatorHint() {
  const active = !menuOpen && canUseElevator();
  elevatorHint.style.display = active ? 'block' : 'none';
}

function showStairsMenu(){
  if (!canUseElevator()) return;
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

  elevatorTravel = {
    ...elevator.userData.createTravel(idx, target, pos),
    startedAt: performance.now(),
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

function handleSceneInteraction(clientX, clientY) {
  if (interactionBlocked() || activePointers.size) return;

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  camera.updateMatrixWorld();
  raycaster.setFromCamera(pointer, camera);
  const musicControls = garden.userData.musicMonolithControls;
  if (musicControls && raycaster.intersectObject(musicControls.change, false).length
      && useMusicControl('switchAlbum')) return;
  const musicHit = musicControls && raycaster.intersectObject(musicControls.mesh, false)[0];
  const musicAction = musicHit?.uv && musicControls.actionAt(musicHit.uv.x);
  if (musicAction && useMusicControl(musicAction)) return;
  const boothControls=garden.userData.contactBooth?.userData.controls?.buttons??[];
  for(let index=0;index<boothControls.length;index++){
    if(raycaster.intersectObject(boothControls[index],true).length&&activateBoothControl(index))return;
  }
  const boothHit = garden.userData.contactBooth && raycaster.intersectObject(garden.userData.contactBooth,true)[0];
  if (boothHit && enterContactBooth()) return;
  const coaster=garden.userData.coaster;
  const wagonHit=coaster&&raycaster.intersectObject(coaster.board,true)[0];
  if(wagonHit&&requestCoasterRide(wagonHit.point))return;
  const mugHit=garden.userData.mug?.visible&&raycaster.intersectObject(garden.userData.mug,true)[0];
  if(mugHit&&collectMug(mugHit.point))return;
  if (garden.userData.intercom && raycaster.intersectObject(garden.userData.intercom.root, true).length && ringIntercom()) return;
  const basketHit = garden.userData.lollipopBasket
    && raycaster.intersectObject(garden.userData.lollipopBasket, true)[0];
  if (basketHit && collectLollipop(basketHit.point)) return;
  if (garden.userData.jetpack?.visible
    && raycaster.intersectObject(garden.userData.jetpack, true).length > 0) {
    activateJetpack();
    return;
  }
  const elevatorHit = raycaster.intersectObject(elevator, true).some(hit => hit.object.userData.isElevatorSelector && hit.distance < 3.0);

  if (elevatorHit && canUseElevator()) {
    showStairsMenu();
  }
}

document.addEventListener('pointerdown', event => {
  activePointers.add(event.pointerId);
  if (activePointers.size > 1) sceneTap.cancel();
}, true);
for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, event => activePointers.delete(event.pointerId), true);
renderer.domElement.addEventListener('pointerdown', event => sceneTap.start(event,
  { blocked: interactionBlocked(), otherPointers: activePointers.size - 1 }));
renderer.domElement.addEventListener('pointermove', event => sceneTap.move(event));
renderer.domElement.addEventListener('pointerup', event => {
  const tap = sceneTap.end(event, { blocked: interactionBlocked() || activePointers.size > 0 });
  if (tap) handleSceneInteraction(tap.x, tap.y);
});
renderer.domElement.addEventListener('pointercancel', () => sceneTap.cancel());
window.addEventListener('clearinput', () => { sceneTap.cancel(); activePointers.clear(); });
window.addEventListener('blur', () => { sceneTap.cancel(); activePointers.clear(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { sceneTap.cancel(); activePointers.clear(); } });

document.addEventListener('keydown',event=>{
  if(event.code==='Escape'&&garden.userData.coaster?.ride.active){event.preventDefault();return;}
  if (event.code !== 'KeyE' || event.repeat || interactionBlocked()
    || event.target?.closest?.('input,select,textarea,[contenteditable="true"]')) return;
  const boothChoice=preferredBoothControl();
  if ((event.isTrusted && useMusicControl()) || (boothChoice>=0&&activateBoothControl(boothChoice)) || enterContactBooth() || requestCoasterRide() || ringIntercom() || collectLollipop() || collectMug()) { event.preventDefault(); return; }
  if (canUseElevator()) { event.preventDefault(); showStairsMenu(); }
});
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

// RAF can stop in a hidden tab while asset promises still settle. Clear demand
// immediately so a completed tier cannot enqueue finer detail in the background.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  const seconds = performance.now() * .001;
  for (const visual of garden.userData.visualLods) {
    visual.update(seconds, camera, renderer.domElement.height, { enabled: false });
  }
});

// Animation loop
let last = performance.now();
let wasOnFirePole = false;
let wasSwimming = false;
let worldPageActive = true;
addEventListener('pagehide',()=>{
  worldPageActive=false;
  stopFlightEffects();
  scimmia?.dispose();
  atmosphere?.dispose();
  asteroidSurfaceDetail?.dispose();
  // Also release GPU resources if the browser retains this page in its history cache.
  const geometries=new Set(),materials=new Set(),textures=new Set();
  for(const root of [scene,spaceSky.scene])root.traverse(node=>{
    if(node.geometry)geometries.add(node.geometry);
    for(const mat of (Array.isArray(node.material)?node.material:[node.material]))if(mat){
      materials.add(mat);for(const value of Object.values(mat))if(value?.isTexture)textures.add(value);
    }
  });
  for(const geometry of geometries)geometry.dispose();
  for(const material of materials)material.dispose();
  for(const texture of textures)texture.dispose();
  renderer.dispose();renderer.forceContextLoss();
},{once:true});
addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
const frameStats = { frames: 0, elapsed: 0, render: 0, fps: 0, renderMs: 0 };
function animate(){
    if(!worldPageActive)return;
    try{
      const now = performance.now();
      const elapsed = (now-last)/1000; last = now;
      const dt = Math.min(elapsed, 0.05);
      intercomCall.update(now * .001);
      if (garden.userData.updateEntryDoor) garden.userData.updateEntryDoor(player.getPosition(), dt);
      if(garden.userData.contactBooth?.userData.door){
        const booth=garden.userData.contactBooth;
        booth.userData.door.update(dt,{root:booth,eye:player.getPosition(),inside:boothContainsVisitor(booth,player.getPosition())});
      }
      updateElevatorHint();

      // Static collision data is shared; door/cabin transforms update on demand.
      if (bootingScene) {
        player.velocity.set(0, 0, 0);
      } else if (landingIntro) {
        const progress = Math.min(1, (now - landingIntro.startedAt) / landingIntro.duration);
        const frame = arrival.sample(progress);
        player.setPosition(frame.position);
        player.velocity.set(0, 0, 0);
        facePlayerAt(frame.focus);
        if (progress === 1) {
          stopFlightEffects();
          landingIntro = null;
          atmosphereLandedAt = now;
          scimmia?.start();
          window.__APP.inputBlocked = false;
          setGameplayControlsVisible(true);
        } else {
          flight.update(now, progress);
          fireworks?.update(progress * landingIntro.duration / 1000, renderer.domElement.height);
          flares?.update(progress * landingIntro.duration / 1000);
        }
      } else if (garden.userData.coaster?.ride.active) {
        updateCoaster(dt);
      } else if (elevatorTravel) {
        const progress = Math.min(1, (now - elevatorTravel.startedAt) / elevatorTravel.duration);
        const frame = elevatorTravel.sample(progress);
        player.setPosition(frame.position);
        const cabin = elevator.userData.cabin;
        if (cabin) cabin.position.y = frame.cabinY;
        elevator.userData.updateGates?.();
        player.velocity.set(0, 0, 0);

        if (progress === 1) {
          elevatorTravel = null;
          window.__APP.inputBlocked = false;
          lastStairsToggle = performance.now();
        }
      } else {
        if (!window.__APP.inputBlocked) player.update(dt, colliders);
      }
      // Cabin controls are real scene geometry; walking inside keeps this world active.
      for(const pond of garden.userData.ponds??[])pond.updateView(camera);
      const underwater = garden.userData.coaster?.containsWater(camera.position) ?? false;
      rideQuality.active=Boolean(garden.userData.coaster?.ride.active||coasterReviewProbe);
      const ground=asteroidTerrain?.heightAt(camera.position.x/WORLD_SCALE,camera.position.z/WORLD_SCALE)??null;
      coasterVisualQuality(rideQuality.active,camera.position,ground===null?null:ground*WORLD_SCALE,rideQuality);
      updateLollipopHint();
      // No culling before collision capture; the zones own rendering visibility only.
      if (arrivalReady) worldZones.update(camera, { enabled: !underwater && !document.hidden });
      for (const visual of garden.userData.visualLods) {
        visual.update(now * .001, camera, renderer.domElement.height,
          { enabled: arrivalReady && !bootingScene && !underwater && !document.hidden,maxDetail:rideQuality.maxDetail });
      }
      if (!underwater) {
        spaceSky.update(now);
        garden.userData.animateGrass?.(now * .001);
        garden.userData.animateJetpack?.(now * .001);
        garden.userData.animateBees?.(now * .001);
      }
      playerBody.update(dt, !bootingScene && !landingIntro && !underwater && !coasterBoarding && !scimmiaReviewFollow,Boolean(garden.userData.coaster?.ride.active));
      if(garden.userData.coaster?.ride.active&&currentCoasterFrame&&!coasterBoarding&&!underwater){
        playerBody.root.position.copy(currentCoasterFrame.feet).addScaledVector(currentCoasterFrame.forward,-.291);
        playerBody.root.quaternion.copy(currentCoasterFrame.quaternion);
        playerBody.poseForCoaster();
      }
      if (player.swimming && !wasSwimming) roomLabel.show('NUOTO — guarda nella direzione e avanza · Spazio sali · C scendi', 6500);
      wasSwimming = Boolean(player.swimming);
      if (player.attachedPole && !wasOnFirePole) roomLabel.show('PALO — W/S o ↑/↓ sali e scendi · A/D o ←/→ per uscire', 5500);
      wasOnFirePole = Boolean(player.attachedPole);

      const renderStart = performance.now();
      asteroidSurfaceDetail?.update(now*.001,camera,{
        enabled:!bootingScene && !landingIntro && !underwater && !document.hidden && !rideQuality.active
          && !insideHouse(camera.position.x/WORLD_SCALE,camera.position.z/WORLD_SCALE),
        ground,
      });
      const landedSeconds = atmosphereLandedAt === null ? null : (now-atmosphereLandedAt)*.001;
      const daylight = landingIntro ? 0 : (landedSeconds === null || atmospherePreview)
        ? 1 : THREE.MathUtils.smoothstep(landedSeconds,0,3.5);
      ambient.intensity = THREE.MathUtils.lerp(.17,.62,daylight);
      dir.intensity = THREE.MathUtils.lerp(.23,.8,daylight);
      atmosphere?.update(atmospherePreview?.time ?? landedSeconds ?? now*.001,camera,{
        enabled: !bootingScene && !landingIntro && !underwater && !document.hidden
          && (atmospherePreview !== null || !reducedEffects.matches)
          && (rideQuality.active || !insideHouse(camera.position.x/WORLD_SCALE,camera.position.z/WORLD_SCALE)),
        smokeRange:rideQuality.active ? 175 : 240,
        previewTarget:atmospherePreview?.target,
      });
      scimmia?.update(Math.min(elapsed,.25),camera,{
        enabled: !bootingScene && !landingIntro && !underwater && !document.hidden && !rideQuality.active,
        follow: scimmiaReviewFollow ? followScimmiaForReview : undefined,
      });
      // Decide fountain detail using this frame's camera, after movement/arrival.
      garden.userData.animateChocolate?.(now * .001, camera, renderer.domElement.height, !bootingScene && !underwater);
      // Grass installs its detail callback after its asynchronous assets load.
      // Keep the arrival loop alive while that optional visual layer is pending.
      if (!underwater) garden.userData.updateGrassDetail?.(camera.position.x / WORLD_SCALE, camera.position.y / WORLD_SCALE, camera.position.z / WORLD_SCALE,rideQuality.grassDensity,rideQuality.active);
      // The opaque loading screen needs only its video, not a second full GPU scene.
      if (!bootingScene) {
        if (!underwater) garden.userData.updateStaticDetails?.(camera, renderer.domElement.height);
        renderWorld(now);
      }
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
  worldZones,
  visualLods: garden.userData.visualLods,
  lollipop: { equipment: playerBody.equipment, pickup: lollipopPickup },
  openStairsMenu: showStairsMenu,
  closeStairsMenu: closeStairsMenu,
  elevator,
};

let openInitialReview = null;
const scimmiaReviewEye = new THREE.Vector3();
const scimmiaReviewTarget = new THREE.Vector3();
const scimmiaReviewOffset = new THREE.Vector3(2.7,1.82,3.55);
function followScimmiaForReview(position) {
  player.setPosition(scimmiaReviewEye.copy(position).add(scimmiaReviewOffset));
  facePlayerAt(scimmiaReviewTarget.set(position.x,position.y+.81,position.z));
}
// Local architectural review, excluded from the normal game experience.
const reviewParams = new URLSearchParams(location.search);
if (['127.0.0.1','localhost'].includes(location.hostname) && reviewParams.has('review')) {
  const review=document.createElement('details');
  review.hidden = !reviewParams.has('panel');
  review.addEventListener('click',event=>{if(event.target.tagName==='BUTTON'){stopFlightEffects();coasterReviewProbe=false;scimmiaReviewFollow=false;atmospherePreview=null;scimmia?.review();if(garden.userData.coaster?.ride.active)stopCoaster();}},true);
  review.style.cssText='position:fixed;left:12px;top:12px;z-index:20000;background:#162329;color:#fff;padding:10px;max-width:min(420px,90vw);max-height:calc(100dvh - 40px);overflow:auto;border:1px solid #897e61;border-radius:6px';
  const reviewTitle=document.createElement('summary');reviewTitle.textContent='Visita un ambiente · '+WORLD_SCALE+'×';reviewTitle.style.cssText='cursor:pointer;font-size:12px';review.append(reviewTitle);
  const monolith = MUSIC_MONOLITH_PLACEMENT;
  const approachDistance = 2.1 / WORLD_SCALE;
  const reviewPoints=[...FLOOR_NAMES.map((name,i)=>({name,y:FLOOR_Y[i],x:.5,z:2.4})),
    {name:'Monolite musicale', y:terrainHeight(monolith.x, monolith.z) * WORLD_SCALE,
      x:monolith.x - BASE_HOUSE_X + Math.sin(monolith.yaw) * approachDistance,
      z:monolith.z - BASE_HOUSE_Z + Math.cos(monolith.yaw) * approachDistance,
      yaw:monolith.yaw + Math.PI},
    {name:'Veranda',y:.441*WORLD_SCALE,x:-10.5,z:1.2},
    {name:'Voliera',y:9.962*WORLD_SCALE,x:-10,z:.3},
    {name:'Veranda · raccordo',y:.15*WORLD_SCALE,x:-8,z:6.5,yaw:2.8,pitch:.22,hold:true},
    {name:'Angolo casa · terreno',y:0,x:7.5,z:6.5,yaw:-2.4,pitch:.12,hold:true},
    {name:'Vialetto · pietre',y:0,x:-1.65,z:28.5,pitch:-.48,hold:true},
    {name:'Voliera · chioma',y:11*WORLD_SCALE,x:-10,z:.3,yaw:-Math.PI/2,pitch:.4,hold:true},
    {name:'Ascensore · cabina',y:FLOOR_Y[0],x:.3,z:.85,yaw:3.48,pitch:.08,hold:false},
    {name:'Torre destra',y:9.845*WORLD_SCALE,x:14.3,z:.95,yaw:2.567,pitch:-.3},
    {name:'Torre sinistra',y:17.233*WORLD_SCALE,x:-13.05,z:5.35,yaw:2.567,pitch:-.3},
    {name:'Torre destra · foro',y:14.135561*WORLD_SCALE,x:14.3,z:.95,yaw:2.567,pitch:-.4},
    {name:'Torre sinistra · foro',y:19.59305*WORLD_SCALE,x:-13.05,z:5.35,yaw:2.567,pitch:-.4},
    {name:'Suolo e crateri',y:32*WORLD_SCALE,x:-30,z:48,pitch:-.55,hold:true},
    {name:'UFO',y:6*WORLD_SCALE,x:-30.65,z:-3.43,pitch:-.42,hold:true},
    {name:'Tastiera',y:0,x:-4.85,z:15.2,pitch:-.3,hold:true},
    {name:'Punchball',y:2.5*WORLD_SCALE,x:5.35,z:28.57,pitch:-.25,hold:true},
    {name:'Facciata · prestazioni',y:1,x:0,z:12,pitch:.18,hold:true},
    {name:'Ingresso · scale esterne',y:0,x:-.98,z:11.5,pitch:.15,hold:false},
    {name:'Poster sinistro',y:1*WORLD_SCALE,x:3.6,z:22.57,pitch:0,yaw:Math.PI/2,hold:true},
    {name:'Poster destro',y:1*WORLD_SCALE,x:7.1,z:22.57,pitch:0,yaw:-Math.PI/2,hold:true}];
  reviewPoints.forEach(({name,y,x,z,pitch=0,yaw=Math.PI,hold=false})=>{
    const button=document.createElement('button');button.textContent=name;button.style.cssText='background:#263431;color:#fff;border:1px solid #897e61;padding:8px;cursor:pointer';
    button.onclick=()=>{review.open=false;splashVideo.pause();splash.remove();bootingScene=false;landingIntro=null;elevatorTravel=null;window.__APP.inputBlocked=hold;setGameplayControlsVisible(true);player.setPosition(new THREE.Vector3(HOUSE_X+x * WORLD_SCALE,y+EYE_HEIGHT,HOUSE_Z+z * WORLD_SCALE));player.velocity.set(0,0,0);player.yaw=yaw;player.pitch=pitch;player.updateCamera();};review.append(button);
    if(name==='Ascensore · cabina'&&new URLSearchParams(location.search).get('view')==='elevator')openInitialReview=button.onclick;
    if(name==='Monolite musicale'&&new URLSearchParams(location.search).get('view')==='monolith')openInitialReview=button.onclick;
  });
  const stats=document.createElement('span');review.append(stats);document.body.append(review);
  for (const [label,view,eye,target] of [
    ['Terreno · panoramica','terrain',[355,245,350],[0,-48,0]],
    ['Terreno · cratere UFO','terrain-ufo',[-179,13,-107],[-145,-4,-75]],
  ]) {
    const button = document.createElement('button');
    button.textContent = label;
    button.onclick = () => {
      if (!arrivalReady) return;
      review.open=false; splashVideo.pause(); splash.remove(); bootingScene=false;
      landingIntro=null; elevatorTravel=null;
      window.__APP.inputBlocked=true; setGameplayControlsVisible(true);
      player.setPosition(new THREE.Vector3(...eye)); player.velocity.set(0,0,0);
      facePlayerAt(new THREE.Vector3(...target));
    };
    review.insertBefore(button,stats);
    if (new URLSearchParams(location.search).get('view')===view) openInitialReview=button.onclick;
  }
  for (const [label,view,time,eye,target] of [
    ['Fari e fumo · arrivo','atmosphere',38,[2,12,214],[7,13,84]],
    ['Fari e fumo · casa','atmosphere-house',40,[2,32,157],[7,50,6]],
    ['Fumo · retro','atmosphere-back',51,[-38,27,-156],[8,20,-9]],
  ]) {
    const button = document.createElement('button'); button.textContent = label;
    button.onclick = () => {
      if (!arrivalReady) return;
      review.open=false; splashVideo.pause(); splash.remove(); bootingScene=false;
      landingIntro=null; elevatorTravel=null; atmospherePreview={time,target:new THREE.Vector3(...target)};
      window.__APP.inputBlocked=true; setGameplayControlsVisible(true);
      player.setPosition(new THREE.Vector3(...eye)); player.velocity.set(0,0,0);
      facePlayerAt(atmospherePreview.target);
    };
    review.insertBefore(button,stats);
    if (new URLSearchParams(location.search).get('view') === view) openInitialReview=button.onclick;
  }
  const scimmiaReview = document.createElement('button');
  scimmiaReview.textContent = 'Scimmia · percorso';
  scimmiaReview.onclick = () => {
    if (!arrivalReady || !scimmia) return;
    review.open = false;
    splashVideo.pause(); splash.remove(); bootingScene = false; landingIntro = null;
    window.__APP.inputBlocked = true;
    setGameplayControlsVisible(true);
    scimmiaReviewFollow = true;
    scimmia.start({ restart: true });
    window.__APP.reviewScimmia = options => scimmia.review(options);
  };
  review.insertBefore(scimmiaReview,stats);
  if (new URLSearchParams(location.search).get('view') === 'monkey') openInitialReview = scimmiaReview.onclick;
  const boothReview = document.createElement('button'); boothReview.textContent='Cabina · ingresso';
  boothReview.style.cssText='background:#263431;color:#fff;border:1px solid #897e61;padding:8px;cursor:pointer';
  boothReview.onclick=()=>{
    const booth=garden.userData.contactBooth;if(!booth?.userData.ready||!arrivalReady)return;
    review.open=false;splashVideo.pause();splash.remove();bootingScene=false;landingIntro=null;elevatorTravel=null;
    window.__APP.inputBlocked=false;window.dispatchEvent(new Event('clearinput'));setGameplayControlsVisible(true);
    player.setPosition(contactBoothApproach(booth,2.5,EYE_HEIGHT));player.velocity.set(0,0,0);
    facePlayerAt(contactBoothApproach(booth,0,EYE_HEIGHT));
  };
  review.insertBefore(boothReview,stats);
  if(new URLSearchParams(location.search).get('view')==='booth')openInitialReview=()=>boothReview.click();
  const boothControlsReview=document.createElement('button');boothControlsReview.textContent='Cabina · pulsanti';
  boothControlsReview.style.cssText=boothReview.style.cssText;
  boothControlsReview.onclick=()=>{
    if(!arrivalReady)return;review.open=false;splashVideo.pause();splash.remove();bootingScene=false;landingIntro=null;elevatorTravel=null;
    window.__APP.inputBlocked=false;window.dispatchEvent(new Event('clearinput'));setGameplayControlsVisible(true);standInsideBooth();
  };
  review.insertBefore(boothControlsReview,stats);
  if(new URLSearchParams(location.search).get('view')==='booth-controls')openInitialReview=()=>boothControlsReview.click();
  const intercomReview = document.createElement('button'); intercomReview.textContent = 'Ingresso · videocitofono';
  intercomReview.style.cssText = 'background:#263431;color:#fff;border:1px solid #897e61;padding:8px;cursor:pointer';
  intercomReview.onclick = () => {
    const panel = garden.userData.intercom?.root;
    if (!panel || !arrivalReady || intercomCalling) return;
    panel.updateWorldMatrix(true, false); review.open = false;
    splashVideo.pause(); splash.remove(); bootingScene = false; landingIntro = null; elevatorTravel = null;
    window.__APP.inputBlocked = false; window.dispatchEvent(new Event('clearinput')); setGameplayControlsVisible(true);
    player.setPosition(panel.localToWorld(new THREE.Vector3(-.35, EYE_HEIGHT, 1.6))); player.velocity.set(0, 0, 0);
    facePlayerAt(garden.userData.intercom.target);
  };
  review.insertBefore(intercomReview, stats);
  if (new URLSearchParams(location.search).get('view') === 'intercom') openInitialReview = intercomReview.onclick;
  const mugReview=document.createElement('button');mugReview.textContent='Tazza · raccolta';
  mugReview.onclick=()=>{
    if(!arrivalReady)return;stopCoaster();review.open=false;splashVideo.pause();splash.remove();bootingScene=false;landingIntro=null;
    window.__APP.inputBlocked=false;window.dispatchEvent(new Event('clearinput'));setGameplayControlsVisible(true);
    const target=garden.userData.mug.getWorldPosition(new THREE.Vector3());
    player.setPosition(target.clone().add(new THREE.Vector3(0,EYE_HEIGHT+.02,1.2)));player.velocity.set(0,0,0);facePlayerAt(target);
  };review.insertBefore(mugReview,stats);
  const fireworksReviewProgress = .607;
  const fireworksReviewU = fireworksReviewProgress**2*(3-2*fireworksReviewProgress);
  for(const [name,u] of [['Giostra · partenza',null],['Giostra · 1%',.000298],['Giostra · 3%',.002646],['Giostra · 5%',.00725],['Giostra · casa vicina',.784],['Giostra · ingresso lago',.84375],['Giostra · nello spazio',.4],['Giostra · fuochi',fireworksReviewU],['Giostra · tunnel',.875],['Giostra · secondo laghetto',.89]]) {
    const button=document.createElement('button');button.textContent=name;
    button.style.cssText='background:#263431;color:#fff;border:1px solid #897e61;padding:8px;cursor:pointer';
    button.onclick=()=>{
      const coaster=garden.userData.coaster;if(!coaster||!arrivalReady||intercomCalling)return;
      stopCoaster();review.open=false;splashVideo.pause();splash.remove();bootingScene=false;landingIntro=null;elevatorTravel=null;
      window.__APP.inputBlocked=u!==null;window.dispatchEvent(new Event('clearinput'));setGameplayControlsVisible(true);
      player.velocity.set(0,0,0);
      if(u===null){player.setPosition(coaster.exitPosition);facePlayerAt(coaster.station);}
      else{const frame=coaster.route.frameAt(u);player.setPosition(frame.eye);player.yaw=Math.atan2(frame.forward.x,frame.forward.z);player.pitch=Math.asin(frame.forward.y);player.updateCamera();}
      coasterReviewProbe=u!==null;
      if(u!==null)updateCoasterFireworks(.5-Math.sin(Math.asin(1-2*u)/3),true);
    };
    review.insertBefore(button,stats);
    if(u===null&&new URLSearchParams(location.search).get('view')==='coaster')openInitialReview=button.onclick;
    if(name==='Giostra · casa vicina'&&new URLSearchParams(location.search).get('view')==='coaster-house')openInitialReview=button.onclick;
    if(name==='Giostra · ingresso lago'&&new URLSearchParams(location.search).get('view')==='coaster-lake')openInitialReview=button.onclick;
    if(u===fireworksReviewU&&new URLSearchParams(location.search).get('view')==='coaster-fireworks')openInitialReview=button.onclick;
  }
  for (const [name, position, target] of [
    ['Cesto · raccolta', [0, 2.02, 2.2], [0, .85, 0]],
    ['Leccalecca · in mano', [0, 2.02, 2.2], [0, .5, -2]],
  ]) {
    const button = document.createElement('button'); button.textContent = name;
    button.style.cssText = 'background:#263431;color:#fff;border:1px solid #897e61;padding:8px;cursor:pointer';
    button.onclick = () => {
      const basket = garden.userData.lollipopBasket;
      if (!basket?.userData.ready || !arrivalReady) return;
      basket.updateWorldMatrix(true, false);
      review.open = false; splashVideo.pause(); splash.remove(); bootingScene = false;
      landingIntro = null; elevatorTravel = null; window.__APP.inputBlocked = false;
      window.dispatchEvent(new Event('clearinput'));
      setGameplayControlsVisible(true);
      player.setPosition(basket.localToWorld(new THREE.Vector3(...position))); player.velocity.set(0, 0, 0);
      facePlayerAt(basket.localToWorld(new THREE.Vector3(...target)));
    };
    review.insertBefore(button, stats);
  }
  for (const { name, position, target, hold } of LYNX_TEMPLE_REVIEW_POINTS) {
    const button = document.createElement('button'); button.textContent = name;
    button.style.cssText = 'background:#263431;color:#fff;border:1px solid #897e61;padding:8px;cursor:pointer';
    button.onclick = () => {
      const temple = garden.userData.lynxTemple;
      if (!temple?.userData.ready || !arrivalReady) return;
      temple.updateWorldMatrix(true, false);
      const eye = temple.localToWorld(new THREE.Vector3(...position));
      const focus = temple.localToWorld(new THREE.Vector3(...target));
      review.open = false; splashVideo.pause(); splash.remove(); bootingScene = false;
      landingIntro = null; elevatorTravel = null; window.__APP.inputBlocked = hold;
      setGameplayControlsVisible(true); player.setPosition(eye); player.velocity.set(0, 0, 0);
      facePlayerAt(focus);
    };
    review.insertBefore(button, stats);
    if (position[0]===11 && reviewParams.get('view')==='temple') openInitialReview=button.onclick;
    if (!hold && reviewParams.get('view')==='temple-entry') openInitialReview=button.onclick;
  }
  for (const [name, position, target, hold] of [
    ['Palco · vista frontale', [18, 10, 30], [0, 5, 0], true],
    ['Palco · verso la casa', [0, 6, -18], [0, 6, 25], true],
    ['Palco · bordo asteroide', [-24, 24, -18], [0, 2.4, 0], true],
    ['Palco · scala sinistra', [-7.95, EYE_HEIGHT + .02, 11], [-7.95, EYE_HEIGHT, 4], false],
    ['Palco · scala destra', [7.95, EYE_HEIGHT + .02, 11], [7.95, EYE_HEIGHT, 4], false],
  ]) {
    const button = document.createElement('button'); button.textContent = name;
    button.style.cssText = 'background:#263431;color:#fff;border:1px solid #897e61;padding:8px;cursor:pointer';
    button.onclick = () => {
      const stage = garden.userData.stage;
      if (!stage || !arrivalReady) return;
      stage.updateWorldMatrix(true, false);
      const eye = stage.localToWorld(new THREE.Vector3(...position));
      const focus = stage.localToWorld(new THREE.Vector3(...target));
      review.open = false; splashVideo.pause(); splash.remove(); bootingScene = false;
      landingIntro = null; elevatorTravel = null; window.__APP.inputBlocked = hold;
      setGameplayControlsVisible(true); player.setPosition(eye); player.velocity.set(0, 0, 0);
      facePlayerAt(focus);
    };
    review.insertBefore(button, stats);
  }
  for (const [name, asset, distance, elevation, away] of [
    ['Fontana · vicino', 'chocolateFountain', 11, 3, false],
    ['Fontana · media distanza', 'chocolateFountain', 42, 3, false],
    ['Fontana · lontano', 'chocolateFountain', 90, 3, false],
    ['Fontana · fuori campo', 'chocolateFountain', 11, 3, true],
    ['Alveare · vicino', 'beehive', 3, 1.35, false],
    ['Alveare · media distanza', 'beehive', 12, 1.35, false],
    ['Alveare · lontano', 'beehive', 40, 1.35, false],
    ['Alveare · fuori campo', 'beehive', 3, 1.35, true],
  ]) {
    const button = document.createElement('button');
    button.textContent = name;
    button.style.cssText = 'background:#263431;color:#fff;border:1px solid #897e61;padding:8px;cursor:pointer';
    button.onclick = () => {
      const prop = garden.userData[asset];
      if (!prop) return;
      const position = prop.getWorldPosition(new THREE.Vector3());
      position.y += elevation; position.z += distance;
      review.open = false; splashVideo.pause(); splash.remove(); bootingScene = false;
      landingIntro = null; elevatorTravel = null; window.__APP.inputBlocked = true;
      setGameplayControlsVisible(true); player.setPosition(position); player.velocity.set(0, 0, 0);
      player.yaw = away ? 0 : Math.PI; player.pitch = 0; player.updateCamera();
    };
    review.insertBefore(button, stats);
    if (asset==='chocolateFountain' && distance===11 && !away && reviewParams.get('view')==='fountain')
      openInitialReview=button.onclick;
  }
  const fountainStats = document.createElement('span'); review.append(fountainStats);
  const worldStats = document.createElement('span'); review.append(worldStats);
  worldStats.dataset.testid = 'world-diagnostics';
  setInterval(() => {
    const entries = worldZones.entries;
    const visuals = garden.userData.visualLods.map(visual => `${visual.assetId}: ${visual.state.activeLevel ?? 'caricamento'}`);
    worldStats.textContent = ` · Zone/contenuti ${entries.filter(entry => entry.root.visible).length}/${entries.length} · LOD ${visuals.join(' / ')}`;
    // Readable diagnostics for browser QA; no scene objects or circular references.
    worldStats.dataset.state = JSON.stringify({
      ready: arrivalReady,
      soundtrack: soundtrack.state,
      landing: Boolean(landingIntro),
      fireworks: fireworksMode ?? null,
      flares: Boolean(flares),
      atmosphere: atmosphere?.state,
      groundDetail: asteroidSurfaceDetail?.state,
      contactBooth: { available:boothAvailable(),inside:boothContainsVisitor(garden.userData.contactBooth,player.getPosition()),
        doorOpen:garden.userData.contactBooth?.userData.door?.isOpen??false,
        controls:boothControlButtons.map((button,index)=>({label:button.getAttribute('aria-label'),available:boothControlAvailable(index)})),
        ready:garden.userData.contactBooth?.userData.ready===true },
      playerPosition: player.getPosition().toArray(),
      scimmia: scimmia?.state,
      elevator: { available: canUseElevator(), landing: elevatorLandingAt(player.getPosition()),
        travelling: Boolean(elevatorTravel), cabinY: elevator.userData.cabin.position.y * WORLD_SCALE,
        cabinHeight: elevator.userData.cabinHeight * WORLD_SCALE },
      coaster: garden.userData.coaster ? { active: garden.userData.coaster.ride.active,
        progress: garden.userData.coaster.ride.progress, length: garden.userData.coaster.route.length,
        available: coasterAvailable(), underwater: garden.userData.coaster.containsWater(camera.position),
        station: garden.userData.coaster.station.toArray() } : null,
      rideLook:{yaw:coasterLook.yaw,pitch:coasterLook.pitch,direction:camera.getWorldDirection(new THREE.Vector3()).toArray(),bodyUp:new THREE.Vector3(0,1,0).applyQuaternion(playerBody.root.quaternion).toArray()},
      mug:{equipped:playerBody.mugEquipment.equipped,available:mugPickup.available(),groundVisible:garden.userData.mug?.visible},
      intercom: garden.userData.intercom ? { phase: intercomCall.phase,
        available: intercomCall.available(player.getPosition()), doorOpen: garden.userData.entryDoor.isOpen,
        angles: garden.userData.entryDoor.pivots.map(pivot => pivot.rotation.y),
        lens: garden.userData.intercom.lensWorldPosition.toArray(), frames: garden.userData.intercom.frames } : null,
      lollipop: { equipped: playerBody.equipment.equipped, available: lollipopPickup.available(),
        basketReady: garden.userData.lollipopBasket?.userData.ready === true },
      lynxTemple: garden.userData.lynxTemple ? {
        ready: garden.userData.lynxTemple.userData.ready === true,
        position: garden.userData.lynxTemple.getWorldPosition(new THREE.Vector3()).toArray(),
      } : null,
      stage: garden.userData.stage ? { ready: true,
        position: garden.userData.stage.getWorldPosition(new THREE.Vector3()).toArray(),
        edgeClearanceMeters: garden.userData.stage.userData.edgeClearanceMeters } : null,
      zones: worldZones.stats,
      collisionTriangles: colliders.stats.triangles,
      geometryCount: renderer.info.memory.geometries,
      textureCount: renderer.info.memory.textures,
      performance:{fps:frameStats.fps,renderMs:frameStats.renderMs,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles},
      fountainAnimation:garden.userData.chocolateFountain?.userData.animation,
      rideQuality,
      visuals: garden.userData.visualLods.map(({ assetId, state }) => ({
        assetId, active: state.activeLevel, target: state.targetLevel, pixels: state.projectedPixels,
        levels: state.levels.map(({ id, status, attempts, error }) => ({ id, status, attempts, error: error?.message ?? null })),
      })),
    });
  }, 1000);
  for (const [name, distance, elevation, away, swim] of [
    ['Laghetto · riva', 15, 3.3, false], ['Laghetto · dall’alto', 8, 27, false],
    ['Laghetto · lontano', 160, 12, false], ['Laghetto · fuori campo', 15, 3.3, true],
    ['Laghetto · nuota', 0, -3, false, true], ['Laghetto · profondità', 0, -48, false, true],
  ]) {
    const button = document.createElement('button'); button.textContent = name;
    button.style.cssText = 'background:#263431;color:#fff;border:1px solid #897e61;padding:8px;cursor:pointer';
    button.onclick = () => {
      const pond = garden.userData.pond;
      if (!pond) return;
      const center = new THREE.Vector3(pond.layout.x, pond.layout.waterY, pond.layout.z).multiplyScalar(WORLD_SCALE);
      const position = center.clone().add(new THREE.Vector3(0, elevation, distance));
      review.open = false; splashVideo.pause(); splash.remove(); bootingScene = false;
      landingIntro = null; elevatorTravel = null; window.__APP.inputBlocked = swim ? false : true;
      setGameplayControlsVisible(true); player.setPosition(position); player.velocity.set(0, 0, 0);
      player.yaw = away ? 0 : Math.PI; player.pitch = swim ? -.15 : away ? 0 : -Math.atan2(elevation, distance);
      player.updateCamera();
    };
    review.insertBefore(button, stats);
  }
  const pondStats = document.createElement('span'); review.append(pondStats);
  setInterval(() => {
    const pond = garden.userData.pond?.state;
    if (pond) pondStats.textContent = ` · Laghetto L${pond.quality.level} / budget ${pond.quality.budgetLevel}`
      + ` · sim ${pond.simulation.passes} · buffer ${pond.simulation.size}² / ${pond.simulation.bytes / 1024} KiB`
      + ` · acqua ${pond.surfaceTriangles} tri · profondità ${pond.depthMetres.toFixed(1)} m`
      + ` · immerso ${pond.underwater ? pond.submersion.toFixed(1) + ' m' : 'no'} · nuoto ${player.swimming ? 'sì' : 'no'}`;
  }, 1000);
  setInterval(() => {
    const animation = garden.userData.chocolateFountain?.userData.animation;
    if (animation) fountainStats.textContent = ` · Fontana L${animation.level} / budget ${animation.budgetLevel} · aggiornamenti ${animation.updates}`;
  }, 1000);
  setInterval(()=>{stats.textContent=`${frameStats.fps.toFixed(0)} FPS · render CPU ${frameStats.renderMs.toFixed(1)} ms · Draw ${renderer.info.render.calls} · ${(renderer.info.render.triangles/1000).toFixed(0)}k triangoli · chiamate risparmiate ${garden.userData.exteriorHome?.userData.drawCallsSaved ?? 0}`;},1000);
}
