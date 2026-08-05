import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import alienGrassBloomUrl from '../assets/models/alien-grass-bloom.glb?url';
import alienRockOutcropUrl from '../assets/models/alien-rock-outcrop.glb?url';
import exteriorHomeUrl from '../assets/models/exterior-home.glb?url';
import grassBladeUrl from '../assets/models/grass-blade.glb?url';
import rocksUrl from '../assets/models/rocks.glb?url';
import soccerPitchUrl from '../assets/models/soccer-pitch.glb?url';

// ---------------------------------------------------------------------------
// Procedural 2D textures (canvas-generated, no external assets).
// Same technique already used for the nebula sprites in main.js: draw on an
// offscreen <canvas>, wrap it in a THREE.CanvasTexture, tile it with
// RepeatWrapping. This gives surfaces real visual variation (grass mottling,
// water ripples, bark grain, stone speckle, wood grain) without loading any
// image files or needing a 3D/2D artist.
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

// Radial-ish ripple rings over a deep teal base for pond + creek water.
function createWaterTexture() {
  const { canvas, ctx } = makeCanvas(128);
  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, '#1b7d94');
  grad.addColorStop(1, '#0e4f61');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 18; i++) {
    const x = rand(i * 3.7) * 128;
    const y = rand(i * 5.1) * 128;
    const r = 8 + rand(i * 2.6) * 26;
    ctx.strokeStyle = `rgba(200,235,245,${0.08 + rand(i * 4.4) * 0.1})`;
    ctx.lineWidth = 1 + rand(i * 1.3) * 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Subtle highlight streak, as if catching sky light.
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, 40, 128, 10);

  return tile(new THREE.CanvasTexture(canvas), 3, 3);
}

// Vertical fissured grain for tree trunks.
function createBarkTexture() {
  const { canvas, ctx } = makeCanvas(64);
  ctx.fillStyle = '#5a3a2a';
  ctx.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 22; i++) {
    const x = rand(i * 2.9) * 64;
    ctx.strokeStyle = `rgba(${30 + rand(i * 1.1) * 20},${18 + rand(i * 3.3) * 15},10,${0.3 + rand(i * 5.5) * 0.3})`;
    ctx.lineWidth = 1 + rand(i * 2.2) * 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    let cx = x;
    for (let y = 0; y <= 128; y += 16) {
      cx += (rand(i * 7 + y) - 0.5) * 6;
      ctx.lineTo(cx, y);
    }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 3);
  texture.needsUpdate = true;
  return texture;
}

// Speckled grey stone, used for path slabs and scattered rubble.
function createStoneTexture() {
  const { canvas, ctx } = makeCanvas(64);
  ctx.fillStyle = '#9b9b8b';
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 90; i++) {
    const x = rand(i * 3.4) * 64;
    const y = rand(i * 5.8) * 64;
    const r = 1 + rand(i * 2.1) * 2.5;
    const shade = rand(i * 6.6) > 0.5 ? '40,40,35' : '210,210,195';
    ctx.fillStyle = `rgba(${shade},${0.12 + rand(i * 1.4) * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return tile(new THREE.CanvasTexture(canvas), 1, 1);
}

// Horizontal grain for the wooden bench.
function createWoodTexture() {
  const { canvas, ctx } = makeCanvas(64);
  ctx.fillStyle = '#6b4a34';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 3) {
    ctx.strokeStyle = `rgba(40,25,15,${0.15 + rand(y * 0.7) * 0.2})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + (rand(y) - 0.5) * 1.5);
    ctx.lineTo(64, y + (rand(y * 2.1) - 0.5) * 1.5);
    ctx.stroke();
  }
  return tile(new THREE.CanvasTexture(canvas), 2, 1);
}

export function createGarden(){
  const g = new THREE.Group(); g.name = 'Garden'; g.userData.roomName = 'Giardino';

  new GLTFLoader().loadAsync(exteriorHomeUrl).then((gltf) => {
    const exterior = gltf.scene;
    exterior.name = 'ExteriorHome';
    // Blender's Z-up export maps its front door to +Z in this scene.
    exterior.position.set(1.65, 0, -0.57);
    exterior.traverse((child) => {
      if (child.name === 'EXT_DoorFrameTop'
        || child.name === 'EXT_DoorFrame_-0.88'
        || child.name === 'EXT_DoorFrame_0.88') {
        child.visible = false;
      }
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.userData.collidable = false;
    });
    g.userData.exteriorHome = exterior;
    g.add(exterior);
  }).catch((err) => {
    console.warn('Exterior home failed to load.', err);
  });

  // Shared procedural textures, generated once per createGarden() call.
  const grassTexture = createGrassTexture();
  const waterTexture = createWaterTexture();
  const barkTexture = createBarkTexture();
  const stoneTexture = createStoneTexture();
  const woodTexture = createWoodTexture();

  // Shared "keep clear" check - keeps grass blades, rocks and flowers out of
  // the house footprint, the pond and the field. Reused by the
  // grass instancing below and by the rock/flower placement further down,
  // so every decorative layer respects the same boundaries.
  const isClearArea = (x, z) => {
    if (Math.abs(x) < 9.4 && Math.abs(z) < 9.4) return false;
    if (Math.abs(x) < 2.1 && z > 3 && z < 17) return false;
    if (Math.hypot(x - 10, z - 10) < 3.9) return false;
    if (x > 10.5 && x < 20.4 && z > 9.2 && z < 18.4) return false;
    if (x > 10.4 && x < 21.6 && z > -10.8 && z < 7.8) return false;
    return true;
  };

  // Rich green grass ground with slight texture variation
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: grassTexture,
    roughness: 0.85,
    metalness: 0,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(52,52), groundMat);
  ground.rotation.x = -Math.PI/2; 
  ground.position.y = 0; 
  ground.receiveShadow = true; 
  ground.userData.collidable = true;
  g.add(ground);

  // The base lawn is deliberately kept as a reliable fallback. On capable
  // devices, a single InstancedMesh adds many low-cost blades over it; users
  // requesting reduced motion keep the original plain lawn instead.
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = typeof navigator !== 'undefined'
    && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const grassCounts = reducedMotion
    ? { primary: 0, alien: 0 }
    : (isMobile || cores <= 4
      ? { primary: 7500, alien: 3000 }
      : { primary: 24000, alien: 10000 });

  // Deterministic pseudo-random values prevent the lawn changing shape on
  // reload, while avoiding thousands of individual mesh allocations.
  const bladeNoise = (index, salt) => {
    const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  // Scatters a dense set of instances for a grass primitive. Multiple
  // primitives from the same GLB reuse the same seed, keeping a tuft's
  // materials locked together while rendering in separate draw groups.
  // The same seed also makes the fallback and sculpted primary grass occupy
  // identical positions, so their asynchronous swap never visibly pops.
  function buildGrassInstances(geometry, material, count, seedOffset = 0) {
    const grassBlades = new THREE.InstancedMesh(geometry, material, count);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const scale = new THREE.Vector3();
    let attempt = seedOffset;
    for (let i = 0; i < count; i++) {
      let x = 0;
      let z = 0;
      do {
        attempt += 1;
        x = -25.3 + bladeNoise(attempt, 1) * 50.6;
        z = -25.3 + bladeNoise(attempt, 2) * 50.6;
      } while (!isClearArea(x, z));
      position.set(x, 0.012, z);
      rotation.set(0, bladeNoise(attempt, 3) * Math.PI, (bladeNoise(attempt, 4) - 0.5) * 0.12);
      const height = 0.5 + bladeNoise(attempt, 5) * 0.4;
      scale.set(0.8 + bladeNoise(attempt, 6) * 0.55, height, 1);
      matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale);
      grassBlades.setMatrixAt(i, matrix);
    }
    grassBlades.instanceMatrix.needsUpdate = true;
    grassBlades.computeBoundingSphere();
    grassBlades.userData.collidable = false;
    grassBlades.name = 'InstancedGrassBlades';
    return grassBlades;
  }

  function applyWindToMaterial(material, windTime, bladeHeight, windWidth, windDepth) {
    material.side = THREE.DoubleSide;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uGrassWindTime = windTime;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nuniform float uGrassWindTime;',
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
          float grassHeight = clamp(transformed.y / ${bladeHeight.toFixed(3)}, 0.0, 1.0);
          float grassBend = grassHeight * grassHeight;
          float grassPhase = uGrassWindTime * 1.9
            + instanceMatrix[3][0] * 0.37
            + instanceMatrix[3][2] * 0.53;
          transformed.x += sin(grassPhase) * ${windWidth.toFixed(3)} * grassBend;
          transformed.z += cos(grassPhase * 0.8) * ${windDepth.toFixed(3)} * grassBend;`,
      );
    };
    material.customProgramCacheKey = () => `grass-wind-${bladeHeight}`;
    material.needsUpdate = true;
    return material;
  }

  function createWindMaterial({ bladeHeight, windWidth, windDepth, ...materialOptions }) {
    const windTime = { value: 0 };
    const material = applyWindToMaterial(
      new THREE.MeshStandardMaterial(materialOptions),
      windTime,
      bladeHeight,
      windWidth,
      windDepth,
    );
    return { material, windTime };
  }

  function createWindMaterials(materials, options, windTime = { value: 0 }) {
    const materialList = (Array.isArray(materials) ? materials : [materials])
      .map((material) => applyWindToMaterial(
        material.clone(),
        windTime,
        options.bladeHeight,
        options.windWidth,
        options.windDepth,
      ));
    return {
      material: Array.isArray(materials) ? materialList : materialList[0],
      windTime,
    };
  }

  if (grassCounts.primary > 0) {
    // Flat fallback: shown immediately so the lawn is never empty while the
    // sculpted model (a few KB, modeled in Blender - tapered, curved,
    // vertex-color gradient from dark base to light tip) fetches in the
    // background, and as a safety net if that fetch ever fails.
    const fallbackGeo = new THREE.PlaneGeometry(0.016, 0.08, 1, 2);
    fallbackGeo.translate(0, 0.04, 0);
    const fallbackWind = createWindMaterial({
      color: 0x4f9a3b,
      roughness: 0.92,
      side: THREE.DoubleSide,
      bladeHeight: 0.08,
      windWidth: 0.025,
      windDepth: 0.014,
    });
    const windTimes = [fallbackWind.windTime];
    let fallbackBlades = buildGrassInstances(
      fallbackGeo,
      fallbackWind.material,
      grassCounts.primary,
    );
    g.add(fallbackBlades);
    g.userData.animateGrass = (seconds) => {
      windTimes.forEach((windTime) => { windTime.value = seconds; });
    };

    function loadGrassTuft(url, count, seedOffset, windOptions) {
      return new GLTFLoader().loadAsync(url).then((gltf) => {
        const bladeMeshes = [];
        gltf.scene.traverse((child) => {
          if (child.isMesh) bladeMeshes.push(child);
        });
        if (bladeMeshes.length === 0) throw new Error('Grass GLB has no mesh');

        const windTime = { value: 0 };
        const tuftInstances = new THREE.Group();
        tuftInstances.name = 'InstancedGrassTuft';
        bladeMeshes.forEach((bladeMesh) => {
          const windMaterial = createWindMaterials(
            bladeMesh.material,
            windOptions,
            windTime,
          );
          tuftInstances.add(buildGrassInstances(
            bladeMesh.geometry,
            windMaterial.material,
            count,
            seedOffset,
          ));
        });
        return { tuftInstances, windTime };
      });
    }

    loadGrassTuft(grassBladeUrl, grassCounts.primary, 0, {
      bladeHeight: 0.182,
      windWidth: 0.045,
      windDepth: 0.025,
    }).then(({ tuftInstances, windTime }) => {
      g.remove(fallbackBlades);
      fallbackBlades.geometry.dispose();
      fallbackBlades.material.dispose();
      g.add(tuftInstances);
      windTimes[0] = windTime;
      fallbackBlades = null;
    }).catch((err) => {
      console.warn('Sculpted grass blade failed to load, keeping flat fallback.', err);
    });

    loadGrassTuft(alienGrassBloomUrl, grassCounts.alien, 100000, {
      bladeHeight: 0.222,
      windWidth: 0.065,
      windDepth: 0.038,
    }).then(({ tuftInstances, windTime }) => {
      tuftInstances.name = 'InstancedAlienGrassTuft';
      g.add(tuftInstances);
      windTimes.push(windTime);
    }).catch((err) => {
      console.warn('Alien grass tuft failed to load.', err);
    });

    // Wind is vertex-shader based, so roots remain fixed while every tuft
    // bends independently without per-frame instance-matrix updates.
  }

  // Layered vegetation helpers: each bush/tree is a small composition rather
  // than a single primitive, keeping the garden fuller without external art.
  const shrubMats = [
    new THREE.MeshStandardMaterial({ color: 0x285d38, roughness: 0.88 }),
    new THREE.MeshStandardMaterial({ color: 0x397742, roughness: 0.86 }),
    new THREE.MeshStandardMaterial({ color: 0x4b914d, roughness: 0.84 }),
  ];
  function addBush(x, z, scale = 1) {
    const bush = new THREE.Group();
    const clumps = [[0, 0, 0.52], [-0.38, 0.05, 0.38], [0.38, 0.02, 0.42], [0.06, 0.2, 0.36]];
    clumps.forEach(([bx, by, radius], index) => {
      const clump = new THREE.Mesh(
        new THREE.SphereGeometry(radius * scale, 10, 7),
        shrubMats[index % shrubMats.length],
      );
      clump.scale.set(1.15, 0.72, 1);
      clump.position.set(bx * scale, (radius * 0.58 + by) * scale, 0);
      clump.userData.collidable = false;
      bush.add(clump);
    });
    bush.position.set(x, 0, z);
    g.add(bush);
  }

  const barkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: barkTexture, roughness: 0.82 });
  function addTree(x, z, scale = 1) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22 * scale, 0.34 * scale, 3.4 * scale, 10),
      barkMat,
    );
    trunk.position.y = 1.7 * scale;
    trunk.userData.collidable = true;
    tree.add(trunk);

    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2d6b3d, roughness: 0.75 });
    [[0, 3.55, 0, 1.38], [-0.72, 3.2, 0.15, 1.05], [0.72, 3.25, -0.12, 1.08], [0.05, 4.15, 0, 1.0]]
      .forEach(([cx, cy, cz, radius]) => {
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 12, 8), canopyMat);
        canopy.scale.set(1, 0.82, 1);
        canopy.position.set(cx * scale, cy * scale, cz * scale);
        canopy.userData.collidable = false;
        tree.add(canopy);
      });
    tree.position.set(x, 0, z);
    g.add(tree);
  }

  // Pond: dark edge, shallow water, lily pads and reeds make the existing
  // water feature read as a small natural pond instead of a flat blue disc.
  const pondMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: waterTexture,
    emissive: 0x083447,
    emissiveIntensity: 0.2,
    metalness: 0.45,
    roughness: 0.28,
  });
  const pondEdge = new THREE.Mesh(
    new THREE.CircleGeometry(3.45, 40),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: grassTexture, roughness: 0.95 }),
  );
  pondEdge.rotation.x = -Math.PI / 2;
  pondEdge.position.set(10, 0.015, 10);
  pondEdge.userData.collidable = false;
  g.add(pondEdge);
  const pond = new THREE.Mesh(new THREE.CircleGeometry(3.12,40), pondMat); 
  pond.rotation.x=-Math.PI/2; 
  pond.position.set(10,0.03,10); 
  pond.userData.collidable = false; 
  g.add(pond);

  const lilyMat = new THREE.MeshStandardMaterial({ color: 0x427e3e, roughness: 0.75 });
  [[9.1, 9.45, 0.34], [10.65, 10.45, 0.26], [11.35, 9.25, 0.22], [9.7, 11.2, 0.2]].forEach(([x, z, r]) => {
    const lily = new THREE.Mesh(new THREE.CircleGeometry(r, 12), lilyMat);
    lily.rotation.x = -Math.PI / 2;
    lily.position.set(x, 0.055, z);
    lily.userData.collidable = false;
    g.add(lily);
  });

  const reedMat = new THREE.MeshStandardMaterial({ color: 0x668d43, roughness: 0.9 });
  function addReeds(x, z) {
    [-0.13, 0, 0.14].forEach((offset, index) => {
      const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.65 + index * 0.08, 5), reedMat);
      reed.position.set(x + offset, 0.32 + index * 0.04, z + (index - 1) * 0.06);
      reed.rotation.z = (index - 1) * 0.12;
      reed.userData.collidable = false;
      g.add(reed);
    });
  }
  [[7.45, 9.1], [7.65, 11.1], [12.3, 8.9], [12.45, 10.9]].forEach(([x, z]) => addReeds(x, z));

  // A shallow creek leaves the pond and curves toward the asteroid edge.
  // ShapeGeometry keeps it flat and non-collidable, so existing movement
  // physics sees it exactly like decorative ground.
  const creekShape = new THREE.Shape();
  [[11.8, 10.2], [13.6, 10.9], [14.8, 12.7], [16.1, 14.2], [18.6, 15.6],
    [19.3, 17.4], [18.3, 17.7], [17.1, 16.2], [15.2, 14.9], [13.7, 13.3],
    [12.5, 11.7], [11.2, 11.15]]
    .forEach(([x, z], index) => index === 0 ? creekShape.moveTo(x, z) : creekShape.lineTo(x, z));
  creekShape.closePath();
  const creek = new THREE.Mesh(new THREE.ShapeGeometry(creekShape), pondMat);
  creek.rotation.x = -Math.PI / 2;
  creek.position.y = 0.028;
  creek.userData.collidable = false;
  g.add(creek);

  // Low planting lines define the pond and creek banks.
  [[7.25, 8.1, 0.75], [7.0, 10.35, 0.85], [8.0, 12.25, 0.72], [10.0, 13.05, 0.78],
    [12.3, 12.15, 0.68], [13.45, 11.4, 0.66], [14.45, 13.0, 0.72], [15.9, 14.9, 0.78],
    [17.75, 16.3, 0.7], [19.35, 16.0, 0.82]]
    .forEach(([x, z, scale]) => addBush(x, z, scale));

  // Simple wooden bench beside the pond - the one extra detail asset for
  // this pass, built from primitives (seat, backrest, four legs).
  const benchMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: woodTexture, roughness: 0.85 });
  const bench = new THREE.Group();
  const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.55), benchMat);
  benchSeat.position.set(0, 0.46, 0);
  bench.add(benchSeat);
  const benchBack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.08), benchMat);
  benchBack.position.set(0, 0.75, -0.24);
  bench.add(benchBack);
  for (const [lx, lz] of [[-0.7, 0.2], [0.7, 0.2], [-0.7, -0.2], [0.7, -0.2]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.08), benchMat);
    leg.position.set(lx, 0.23, lz);
    leg.userData.collidable = false;
    bench.add(leg);
  }
  benchSeat.userData.collidable = true;
  benchSeat.userData.interactable = true;
  bench.position.set(7.2, 0, 8.5);
  bench.rotation.y = -0.5;
  g.add(bench);

  new GLTFLoader().loadAsync(soccerPitchUrl).then((gltf) => {
    const pitch = gltf.scene;
    pitch.name = 'BlenderSoccerPitch';
    // Initial view faces -Z, so +X is the player's right. Rotating the long
    // pitch axis along Z keeps it right of the house and entirely on terrain.
    pitch.position.set(16, 0.02, -1.5);
    pitch.rotation.y = Math.PI / 2;
    pitch.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.userData.collidable = false;
    });
    g.add(pitch);
  }).catch((err) => {
    console.warn('Blender soccer pitch failed to load.', err);
  });

  // Mature trees frame the garden while varied low bushes fill the space
  // beneath their canopy without blocking the primary path to the house.
  [[-22, -1, 1.1], [-6, -21, 0.92], [23, -18, 1.04], [23, 10, 1.08],
    [-17, 17, 1.0], [19, 14, 0.95], [-21, 5, 0.88], [3, -20, 0.9]]
    .forEach(([x, z, scale]) => addTree(x, z, scale));
  [[-22, -5, 0.9], [-4, -20, 0.72], [-3, -18, 0.85], [-4, -18, 0.8],
    [23, -18, 0.82], [23, 6, 0.9], [-22, 10, 0.78], [-13, 19, 0.88],
    [2, 20, 0.82], [20, 20, 0.9], [-9, 9, 0.7], [5, 15, 0.75]]
    .forEach(([x, z, scale]) => addBush(x, z, scale));


  new GLTFLoader().loadAsync(rocksUrl).then((gltf) => {
    const rockClusters = new THREE.Group();
    rockClusters.name = 'BlenderRockClusters';
    const placements = [
      [-20, 2, 1.8, 0.2],
      [-8, -20, 1.6, 1.1],
      [23, -20, 1.9, 2.4],
      [23, 10, 1.7, 3.1],
      [-20, 13, 1.8, 4.2],
      [16, 19, 1.7, 5.0],
      [-15, 3, 1.5, 5.8],
    ];
    placements.forEach(([x, z, scale, rotation]) => {
      const cluster = gltf.scene.clone(true);
      cluster.position.set(x, 0.11, z);
      cluster.rotation.y = rotation;
      cluster.scale.setScalar(scale);
      cluster.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.collidable = false;
      });
      rockClusters.add(cluster);
    });
    g.add(rockClusters);
  }).catch((err) => {
    console.warn('Blender rocks failed to load.', err);
  });

  new GLTFLoader().loadAsync(alienRockOutcropUrl).then((gltf) => {
    const outcrops = new THREE.Group();
    outcrops.name = 'BlenderAlienRockOutcrops';
    const placements = [
      [23, 14, 0.78, 0.4],
      [18, 18, 0.92, 2.3],
      [-21, 13, 0.8, 4.7],
      [20, 5, 0.67, 5.6],
    ];
    placements.forEach(([x, z, scale, rotation]) => {
      const outcrop = gltf.scene.clone(true);
      outcrop.position.set(x, 0.03, z);
      outcrop.rotation.y = rotation;
      outcrop.scale.setScalar(scale);
      outcrop.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.collidable = false;
      });
      outcrops.add(outcrop);
    });
    g.add(outcrops);
  }).catch((err) => {
    console.warn('Detailed Blender rock outcrop failed to load.', err);
  });

  // A modest flower patch for color - small stem + bloom, sized like an
  // actual flower rather than the oversized pink cones from before - placed
  // near the path and pond edge where the garden reads best from the house.
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3c6b32, roughness: 0.85 });
  const bloomColors = [0xe85c6b, 0xf2c14e, 0x8e6bd1, 0xf4f1ea];
  const bloomMats = bloomColors.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));
  function addFlower(x, z, seed) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.32, 5), stemMat);
    stem.position.set(x, 0.16, z);
    stem.userData.collidable = false;
    g.add(stem);
    const bloom = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.07, 0),
      bloomMats[Math.floor(rand(seed) * bloomMats.length)],
    );
    bloom.position.set(x, 0.34, z);
    bloom.scale.set(1, 0.7, 1);
    bloom.userData.collidable = false;
    g.add(bloom);
  }
  const flowerPatchSpots = [[3, 6], [-2.5, 9], [6.5, 6.5], [8.6, 12.6], [11.6, 12.3], [6.4, 9.6], [3.6, 12.4]];
  let flowerSeed = 0;
  flowerPatchSpots.forEach(([cx, cz]) => {
    for (let i = 0; i < 3; i++) {
      flowerSeed += 1;
      const x = cx + (rand(flowerSeed * 4.3) - 0.5) * 1.1;
      const z = cz + (rand(flowerSeed * 6.7) - 0.5) * 1.1;
      if (isClearArea(x, z)) addFlower(x, z, flowerSeed * 9.1);
    }
  });

  return g;
}