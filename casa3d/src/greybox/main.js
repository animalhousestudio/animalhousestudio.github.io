import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import houseUrl from '../assets/models/house-greybox.glb?url';
import { setupInput } from '../player/input.mjs';
import { createSpaceSky } from '../spaceSky.mjs';
import { prepareHouse, FLOOR_LEVELS, FLOOR_LABELS } from './house.mjs';
import { GreyboxPlayer } from './player.mjs';
import './style.css';

document.title = 'Animal House · Prova della casa';
document.body.classList.add('greybox-playtest');
window.__APP = { inputBlocked: true };
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x111827);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.04, 120);
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xe3efff, 0xa4a39c, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(-12, 24, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 20, bottom: -16, near: 0.1, far: 65 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.02;
scene.add(sun);
// A camera light keeps the undecorated, windowless cellar inspectable.
const inspectionLight = new THREE.PointLight(0xffffff, 1.8, 8, 1.5);
camera.add(inspectionLight);
const sky = createSpaceSky();
const root = document.getElementById('ui-root');
const toolbar = document.createElement('div');
toolbar.className = 'greybox-toolbar';
toolbar.innerHTML = '<div><strong>ANIMAL HOUSE</strong><span>Prova della casa</span></div><div class="greybox-actions"><label for="greybox-fov">FOV</label><select id="greybox-fov" aria-label="Campo visivo verticale"><option value="70">70°</option><option value="65">65°</option><option value="60" selected>60°</option><option value="55">55°</option></select><button class="greybox-pause" type="button">Pausa / comandi</button></div>';
root.append(toolbar);
toolbar.querySelector('#greybox-fov').addEventListener('change', event => {
  camera.fov = Number(event.target.value);
  camera.updateProjectionMatrix();
});
const locationLabel = document.createElement('p');
locationLabel.className = 'greybox-location';
locationLabel.textContent = 'Carico la casa…';
root.append(locationLabel);
const help = document.createElement('p');
help.className = 'greybox-hints';
help.textContent = 'WASD / frecce · Tasto destro: guarda · Shift: corri · R: torna all’ingresso';
root.append(help);
const menu = document.createElement('dialog');
menu.className = 'game-menu';
menu.innerHTML = '<p class="menu-eyebrow">ANIMAL HOUSE · PROVA</p><h2>Esplora la casa.</h2><p>Cammina sulle scale per salire e scendere. La cantina si raggiunge dalla stessa scala.</p><div class="control-guide"><p>WASD o frecce: movimento · Shift: corsa</p><p>Tasto destro premuto: visuale · R: ritorno all’ingresso</p><p>Su touch: leva a sinistra e trascinamento a destra.</p><p>La serra si trova al livello 2; l’osservatorio al livello 3.</p></div><button class="resume-button" type="button">Riprendi</button><button class="greybox-reset" type="button">Torna all’ingresso</button>';
root.append(menu);
let player, house;
function closeMenu() {
  menu.close();
  window.__APP.inputBlocked = false;
  window.dispatchEvent(new Event('clearinput'));
}
function openMenu() {
  if (!player || window.__APP.inputBlocked) return;
  window.dispatchEvent(new Event('clearinput'));
  window.__APP.inputBlocked = true;
  menu.showModal();
}
toolbar.querySelector('.greybox-pause').addEventListener('click', openMenu);
menu.querySelector('.resume-button').addEventListener('click', closeMenu);
menu.querySelector('.greybox-reset').addEventListener('click', () => { player.reset(); closeMenu(); });
menu.addEventListener('cancel', event => { event.preventDefault(); closeMenu(); });
window.addEventListener('keydown', event => {
  if (event.code === 'Escape' && !menu.open) {
    event.preventDefault();
    openMenu();
  }
  if (event.code === 'KeyR' && player && !window.__APP.inputBlocked) {
    window.dispatchEvent(new Event('clearinput'));
    player.reset();
  }
});

async function loadHouse() {
try {
  const gltf = await new GLTFLoader().loadAsync(houseUrl);
  house = prepareHouse(gltf.scene);
  scene.add(house.model, house.ground);
  player = new GreyboxPlayer(camera, house.octree);
  setupInput(renderer.domElement, null, player);
  // This mode uses actual walking; no legacy floor-selection/spiral animation.
  root.querySelector('.touch-interact')?.remove();
  window.__APP.inputBlocked = false;
  if (new URLSearchParams(location.search).has('debug')) {
    window.__HOUSE_TEST = { player, house, scene, camera, renderer };
  }
} catch (error) {
  console.error('Caricamento del greybox non riuscito', error);
  locationLabel.textContent = 'Caricamento non riuscito. Ricarica la pagina per riprovare.';
  locationLabel.setAttribute('role', 'alert');
}
}
loadHouse();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  if (player && !window.__APP.inputBlocked) player.update(dt);
  if (player) {
    const p = player.getFeet();
    const inside = p.x > -11 && p.x < 10.75 && p.z > -7.2 && p.z < 11;
    const floor = FLOOR_LEVELS.reduce((best, y, i) => Math.abs(y - p.y) < Math.abs(FLOOR_LEVELS[best] - p.y) ? i : best, 0);
    locationLabel.textContent = inside ? FLOOR_LABELS[floor] : 'Esterno';
  }
  renderer.clear();
  sky.render(renderer, camera);
  renderer.clearDepth();
  renderer.render(scene, camera);
});
window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
