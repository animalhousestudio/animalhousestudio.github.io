import * as THREE from 'three';
import { addFluffyGrass } from './fluffyGrass.mjs';
import { addRoundStoneLandscape } from './roundStoneLandscape.mjs';
import { addAsteroidProps } from './asteroidProps.mjs';
import { addNaturalRocks } from './naturalRocks.mjs';
import { addNaturalTrees } from './naturalTrees.mjs';
import { PITCH_PLACEMENT, PITCH_CLEARANCE, gardenRockPlacements } from './rockLayout.mjs';
import { instanceStaticMeshes, batchStaticArchitecture } from './optimize.mjs';
import { fitStairOpenings } from './stairFloor.mjs';
import { prepareAccess } from './access.mjs';
import { captureCollisionSource } from '../player/collisionWorld.mjs';
import { prepareEntryDoor, prepareEntrySteps } from './entry.mjs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import exteriorHomeV04Url from '../assets/models/mansion-v04.glb?url';
import exteriorHomeV05Url from '../assets/models/mansion-v05.glb?url';
import exteriorHomeV06Url from '../assets/models/mansion-v06.glb?url';
import exteriorHomeV07Url from '../assets/models/mansion-v07.glb?url';
import exteriorHomeV08Url from '../assets/models/mansion-v08.glb?url';
import exteriorHomeV09Url from '../assets/models/mansion-v09.glb?url';
import exteriorHomeV10Url from '../assets/models/mansion-v10.glb?url';
import entryStepsUrl from '../assets/models/entry-stairs.glb?url';
import soccerPitchUrl from '../assets/models/soccer-pitch.glb?url';

// ---------------------------------------------------------------------------
// Lightweight grass texture beneath the authored instanced blades.
// ---------------------------------------------------------------------------

function makeCanvas(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d') };
}

function tile(texture, repeatX, repeatY) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.needsUpdate = true;
  return texture;
}

// Deterministic pseudo-random so textures look the same on every reload,
// matching the existing grass-instancing approach in this file.
function rand(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

// Mottled green base with darker patches and lighter blade-tip flecks.
function createGrassTexture() {
  const { canvas, ctx } = makeCanvas(128);
  ctx.fillStyle = '#3a7d2e';
  ctx.fillRect(0, 0, 128, 128);

  // Soft darker clumps (shadowed patches under foliage).
  for (let i = 0; i < 40; i++) {
    const x = rand(i * 3.1) * 128;
    const y = rand(i * 5.7) * 128;
    const r = 6 + rand(i * 7.3) * 14;
    const shade = 20 + rand(i * 9.1) * 25;
    ctx.fillStyle = `rgba(${20 + shade * 0.3},${60 - shade * 0.4},${25},${0.18 + rand(i * 2.2) * 0.14})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, rand(i) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine bright flecks to sell individual blades at a distance.
  for (let i = 0; i < 260; i++) {
    const x = rand(i * 4.3 + 1) * 128;
    const y = rand(i * 6.9 + 1) * 128;
    const l = 1.5 + rand(i * 1.7) * 2.5;
    const green = 120 + rand(i * 3.3) * 90;
    ctx.strokeStyle = `rgba(70,${green},60,${0.25 + rand(i * 8.8) * 0.3})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand(i * 2.1) - 0.5) * 2, y - l);
    ctx.stroke();
  }

  return tile(new THREE.CanvasTexture(canvas), 14, 14);
}

export function createGarden(){
  const g = new THREE.Group(); g.name = 'Garden'; g.userData.roomName = 'Giardino';
  const requestedMansion = new URLSearchParams(location.search).get('mansion');
  const mansionVersion = ['v04', 'v05', 'v06', 'v07', 'v08', 'v09', 'v10'].includes(requestedMansion) ? requestedMansion : 'v10';
  const mansionUrl = { v04: exteriorHomeV04Url, v05: exteriorHomeV05Url, v06: exteriorHomeV06Url, v07: exteriorHomeV07Url, v08: exteriorHomeV08Url, v09: exteriorHomeV09Url, v10: exteriorHomeV10Url }[mansionVersion];
  g.userData.surfaceDetailsReady = addAsteroidProps(g);
  g.userData.surfaceDetailsReady.catch(err => console.error('Unable to load asteroid props', err));
  g.userData.optimizeStaticGarden = () => {
    const baseline = ['127.0.0.1', 'localhost'].includes(location.hostname) && new URLSearchParams(location.search).has('baseline');
    if (!baseline) batchStaticArchitecture(g, 12, [g.userData.exteriorHome, g.getObjectByName('AsteroidSurfaceDetails')]);
  };

  g.userData.exteriorReady = Promise.all([
    new GLTFLoader().loadAsync(mansionUrl),
    new GLTFLoader().loadAsync(entryStepsUrl),
  ]).then(([gltf, entry]) => {
    const exterior = gltf.scene;
    exterior.name = 'ExteriorHome';
    // Blender's Z-up export maps its front door to +Z in this scene.
    exterior.position.set(1.65, 0, -0.57);
    exterior.traverse((child) => {
      if(child.isMesh){
        const materials=Array.isArray(child.material)?child.material:[child.material];
        for(const mat of materials){
          if(/Glass|Amber_Window/i.test(mat.name)&&!/Trim/i.test(mat.name)){
            mat.transparent=true;mat.opacity=.28;mat.depthWrite=false;mat.side=THREE.DoubleSide;
            mat.roughness=.18;mat.metalness=.06;mat.forceSinglePass=true;mat.needsUpdate=true;
          }
        }
      }
      if (child.name === 'EXT_DoorFrameTop'
        || child.name === 'EXT_DoorFrame_-0.88'
        || child.name === 'EXT_DoorFrame_0.88'
        || child.name === 'EXT_EntryDoorLeaf'
        || child.name === 'EXT_EntryDoorKnob') {
        child.visible = false;
      }
      // The playable cabin is created at runtime so it follows the controller.
      if (mansionVersion !== 'v04' && child.name.startsWith('M05_Elevator_Cabin')) {
        child.visible = false;
      }
      if (!child.isMesh) return;
      const isGlass = (Array.isArray(child.material) ? child.material : [child.material]).every(mat => mat.transparent);
      child.castShadow = !isGlass;
      child.receiveShadow = true;
      child.userData.collidable = false;
      if (/^M09_HouseTree_.*_Leaves$/.test(child.name)) {
        child.userData.collisionDisabled = true;
        child.material.transparent = false; child.material.alphaTest = Math.max(.45, child.material.alphaTest);
        child.material.depthWrite = true; child.material.side = THREE.DoubleSide;
      }
      if(child.name==='M01_Reuse_ObsDome_Curved'){
        child.material.opacity=.18;child.material.roughness=.16;
        child.material.metalness=.08;child.material.forceSinglePass=true;
        child.castShadow=false;child.receiveShadow=false;
      }
    });
    prepareEntrySteps(exterior, entry.scene);
    const entryDoor = prepareEntryDoor(exterior);
    g.userData.entryDoor = entryDoor;
    g.userData.updateEntryDoor = entryDoor.update;
    const jetpack = exterior.getObjectByName('JETPACK_Pickup');
    if (jetpack) {
      const jetpackBaseY = jetpack.position.y;
      const jetpackHitTarget = new THREE.Mesh(
        new THREE.SphereGeometry(1.35, 12, 8),
        new THREE.MeshBasicMaterial({ transparent:true, opacity:0, depthWrite:false }),
      );
      jetpackHitTarget.name = 'JETPACK_HitTarget';
      jetpack.add(jetpackHitTarget);
      jetpack.traverse((child) => {
        if (!child.isMesh) return;
        child.userData.interactable = true;
      });
      g.userData.jetpack = jetpack;
      g.userData.animateJetpack = (seconds) => {
        jetpack.position.y = jetpackBaseY + Math.sin(seconds * 2.4) * 0.025;
      };
    }
    if (mansionVersion === 'v04') fitStairOpenings(exterior);
    g.userData.access = prepareAccess(exterior, { authoredThresholds: ['v07', 'v08', 'v09', 'v10'].includes(mansionVersion) });
    g.userData.collisionSource = captureCollisionSource(exterior);
    instanceStaticMeshes(exterior);
    const baseline = ['127.0.0.1', 'localhost'].includes(location.hostname) && new URLSearchParams(location.search).has('baseline');
    if (!baseline) batchStaticArchitecture(exterior);
    g.userData.exteriorHome = exterior;
    g.add(exterior);
    return exterior;
  });

  // Shared procedural textures, generated once per createGarden() call.
  const grassTexture = createGrassTexture();

  // Shared "keep clear" check - keeps grass blades, rocks and flowers out of
  // the house footprint, entrance, authored field and natural boulders.
  const isClearArea = (x, z) => {
    if (x > -7.9 && x < 11 && z > -9.8 && z < 8.7) return false;
    if (x > -15 && x < -5.5 && z > -4 && z < 4.6) return false;
    if (x > -1.7 && x < 3 && z > 3 && z < 10.5) return false;
    if (x > PITCH_CLEARANCE.minX && x < PITCH_CLEARANCE.maxX && z > PITCH_CLEARANCE.minZ && z < PITCH_CLEARANCE.maxZ) return false;
    if (gardenRockPlacements.some(p => Math.hypot(x - p.x, z - p.z) < p.size * .55)) return false;
    return true;
  };

  // Rich green grass ground with slight texture variation
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: grassTexture,
    roughness: 0.85,
    metalness: 0,
  });
  g.userData.groundMaterial = groundMat;
  g.userData.groundPanels = [];
  // Leave the enclosed house footprint empty. Without this cutout the garden
  // plane at y=0 is visible through the open spiral-stair shaft.
  const addGroundPanel = (width, depth, x, z) => {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(x, 0, z);
    ground.receiveShadow = true;
    ground.userData.collidable = true;
    g.userData.groundPanels.push(ground);
    g.add(ground);
  };
  const lawnMin = -26;
  const lawnMax = 26;
  // These boundaries derive from the exterior's translated foundation:
  // wide enough to hide every garden surface below the interior, yet still
  // inset from each external wall so the outside terrain remains continuous.
  const houseMinX = -7.35;
  const houseMaxX = 10.65;
  const houseMinZ = -9.37;
  const houseMaxZ = 8.23;
  addGroundPanel(52, lawnMax - houseMaxZ, 0, (lawnMax + houseMaxZ) / 2);
  addGroundPanel(52, houseMinZ - lawnMin, 0, (lawnMin + houseMinZ) / 2);
  addGroundPanel(houseMinX - lawnMin, houseMaxZ - houseMinZ, (lawnMin + houseMinX) / 2, (houseMinZ + houseMaxZ) / 2);
  addGroundPanel(lawnMax - houseMaxX, houseMaxZ - houseMinZ, (houseMaxX + lawnMax) / 2, (houseMinZ + houseMaxZ) / 2);

  addRoundStoneLandscape(g);
  const meadowReady = addFluffyGrass(g, isClearArea);

  // Load the authored field first so the rocks use its actual transformed bounds.
  g.userData.landscapeReady = new GLTFLoader().loadAsync(soccerPitchUrl).then(async ({ scene: pitch }) => {
    pitch.name = 'BlenderSoccerPitch';
    pitch.position.set(PITCH_PLACEMENT.x, PITCH_PLACEMENT.y, PITCH_PLACEMENT.z);
    pitch.rotation.y = PITCH_PLACEMENT.yaw;
    pitch.traverse(child => {
      if (!child.isMesh) return;
      child.castShadow = true; child.receiveShadow = true; child.userData.collidable = false;
    });
    const bounds = new THREE.Box3().setFromObject(pitch);
    const clearance = { minX: bounds.min.x - .75, maxX: bounds.max.x + .75,
      minZ: bounds.min.z - .75, maxZ: bounds.max.z + .75 };
    g.add(pitch);
    await addNaturalRocks(g, clearance);
    await addNaturalTrees(g, clearance);
    await meadowReady;
    return pitch;
  });
  g.userData.landscapeReady.catch(err => console.error('Unable to load field and natural rocks', err));
  return g;
}
