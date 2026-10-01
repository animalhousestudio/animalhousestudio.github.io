import * as THREE from 'three';

// Levels: asleep, flow only, economical, balanced, full. Counts are per outlet.
export const CHOCOLATE_LEVELS = Object.freeze([
  { hz: 0, drops: 0, rings: 0 },
  { hz: 12, drops: 0, rings: 0 },
  { hz: 20, drops: 2, rings: 0 },
  { hz: 30, drops: 3, rings: 1 },
  { hz: 30, drops: 4, rings: 2 },
].map(Object.freeze));

export function chocolateDeviceLevel(device = {}) {
  const { hardwareConcurrency: cores, deviceMemory: memory, userAgent = '', maxTouchPoints = 0 } = device;
  if ((cores > 0 && cores <= 4) || (memory > 0 && memory <= 4)) return 2;
  if (/Android|iPhone|iPad|iPod/i.test(userAgent) || maxTouchPoints > 1) return 3;
  return cores >= 8 ? 4 : 3;
}

/** Owns scheduling only; no timers, raycasts, renderer queries or per-frame allocations. */
export function createChocolateController({ root, localBounds, update, setLevel, deviceLevel = 3 }) {
  const sphere = new THREE.Sphere(), frustum = new THREE.Frustum();
  const viewProjection = new THREE.Matrix4(), eye = new THREE.Vector3(), viewCenter = new THREE.Vector3();
  const state = { level: 0, deviceLevel, budgetLevel: deviceLevel, updates: 0, distance: Infinity, pixels: 0 };
  let nextUpdate = 0, lastTime = null, slowTime = 0, fastTime = 0;
  setLevel(0);

  function tick(seconds, camera, viewportHeight, { enabled = true, reducedMotion = false } = {}) {
    const elapsed = lastTime === null ? 0 : seconds - lastTime;
    lastTime = seconds;
    let visible = enabled && !reducedMotion;
    for (let node = root; visible && node; node = node.parent) visible = node.visible;
    if (visible) {
      root.updateWorldMatrix(true, false);
      camera.updateWorldMatrix(true, false);
      sphere.copy(localBounds).applyMatrix4(root.matrixWorld);
      eye.setFromMatrixPosition(camera.matrixWorld);
      state.distance = Math.max(0, eye.distanceTo(sphere.center) - sphere.radius);
      viewCenter.copy(sphere.center).applyMatrix4(camera.matrixWorldInverse);
      state.pixels = viewportHeight * camera.projectionMatrix.elements[5] * sphere.radius
        / Math.max(.1, -viewCenter.z - sphere.radius);
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProjection);
      visible = frustum.intersectsSphere(sphere);
    }

    let level = 0;
    if (visible && state.distance < (state.level ? 60 : 54) && state.pixels > (state.level ? 28 : 36)) {
      level = state.distance < (state.level >= 2 ? 26 : 22) && state.pixels > (state.level >= 2 ? 90 : 110)
        ? state.budgetLevel : 1;
    }
    // Sustained load reduces the device ceiling; a long stable recovery restores it.
    // Ignore resume gaps and inactive frames so a background tab cannot poison the budget.
    if (level >= 2 && state.level >= 2 && elapsed > 0 && elapsed < .25) {
      slowTime = elapsed > 1 / 28 ? slowTime + elapsed : 0;
      fastTime = elapsed < 1 / 50 ? fastTime + elapsed : 0;
      if (slowTime >= 2 && state.budgetLevel > 2) {
        state.budgetLevel--; slowTime = 0; fastTime = 0;
      } else if (fastTime >= 8 && state.budgetLevel < deviceLevel) {
        state.budgetLevel++; fastTime = 0; slowTime = 0;
      }
      level = Math.min(level, state.budgetLevel);
    } else {
      slowTime = 0; fastTime = 0;
    }
    if (level !== state.level) {
      state.level = level;
      setLevel(level);
      nextUpdate = seconds;
    }
    if (!level || seconds + 1e-6 < nextUpdate) return;
    update(seconds, CHOCOLATE_LEVELS[level]);
    state.updates++;
    const interval = 1 / CHOCOLATE_LEVELS[level].hz;
    // Keep the cadence at 30 Hz on a 60 Hz display, without catch-up loops after pauses.
    nextUpdate = seconds + interval - Math.min(Math.max(0, seconds - nextUpdate), interval * .5);
  }
  return { tick, state };
}

export function animateChocolateMaterial(model) {
  const time = { value: 0 }, strength = { value: 0 };
  const materials = new Set();
  model.traverse(node => {
    if (!node.isMesh) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (/Cioccolato|Riflessi cioccolata/.test(material.name)) materials.add(material);
    }
  });
  for (const material of materials) {
    // A little warmth replaces a point light that added work to every lit scene material.
    material.emissive.copy(material.color);
    material.emissiveIntensity = .035;
    material.onBeforeCompile = shader => {
      shader.uniforms.uChocolateTime = time;
      shader.uniforms.uChocolateStrength = strength;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uChocolateTime;
          uniform float uChocolateStrength;
          varying float vChocolateLight;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vChocolateLight = 0.0;
          if (uChocolateStrength > 0.0) {
            vec3 chocolatePoint = (modelMatrix * vec4(position, 1.0)).xyz;
            vChocolateLight = uChocolateStrength * sin(chocolatePoint.y * 9.0
              + chocolatePoint.x * 2.0 + uChocolateTime * 3.2);
          }`);
      // Interpolate the gentle highlight from vertices: no per-pixel trigonometry,
      // extra render pass or displaced geometry/shadow mismatch.
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vChocolateLight;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 + .07 * vChocolateLight;');
    };
    material.customProgramCacheKey = () => 'chocolate-flow-v2';
    material.needsUpdate = true;
  }
  return { update: seconds => { time.value = seconds; }, setActive: active => { strength.value = active ? 1 : 0; } };
}

export function addAnimatedChocolateDrops(model) {
  const streams = [-Math.PI / 2 - .68, -Math.PI / 2 + .68, .27, Math.PI - .27]
    .map(angle => ({ x: Math.cos(angle), z: -Math.sin(angle), phase: (angle / 6 + 1) % 1 }));
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x54220e, roughness: .22, metalness: .03 }), 16);
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1, .045, 4, 20),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3 }), 8);
  drops.name = 'ChocolateFountain_FallingDrops';
  rings.name = 'ChocolateFountain_AnimatedRipples';
  for (const mesh of [drops, rings]) {
    mesh.userData.collisionDisabled = true;
    mesh.userData.staticDetail = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Conservative, fixed bounds cover every phase; never recalculate moving instances.
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.8, 0), 3.4);
    model.add(mesh);
  }
  const dummy = new THREE.Object3D();
  const flight = 1.2;
  function setLevel(level) {
    const detail = CHOCOLATE_LEVELS[level];
    drops.count = streams.length * detail.drops;
    rings.count = streams.length * detail.rings;
    drops.visible = drops.count > 0;
    rings.visible = rings.count > 0;
  }
  function update(seconds, detail) {
    if (!detail.drops) return;
    let dropIndex = 0, ringIndex = 0;
    for (const stream of streams) {
      const cycle = seconds / flight + stream.phase;
      for (let j = 0; j < detail.drops; j++) {
        const progress = (cycle + j / detail.drops) % 1;
        // Accelerate from the lip and stretch on the way down, ending at the ripple origin.
        const fall = .25 * progress + .75 * progress * progress;
        const radius = 2.1 + .36 * progress;
        const appearance = THREE.MathUtils.smoothstep(progress, 0, .07)
          * (1 - THREE.MathUtils.smoothstep(progress, .91, 1));
        dummy.position.set(radius * stream.x, 3.02 - 2.41 * fall, radius * stream.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar((.055 + .012 * progress) * appearance);
        dummy.scale.y *= 1.7 + .8 * progress;
        dummy.updateMatrix(); drops.setMatrixAt(dropIndex++, dummy.matrix);
      }
      for (let j = 0; j < detail.rings; j++) {
        // Each ring starts on a drop impact and dies away before it is reused.
        const phase = ((cycle * detail.drops) % 1 + j) / detail.rings;
        const radius = .08 + .36 * phase;
        const envelope = Math.sin(Math.PI * phase);
        dummy.position.set(2.46 * stream.x, .602, 2.46 * stream.z);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.scale.set(radius, radius * .8, .6 * envelope);
        dummy.updateMatrix(); rings.setMatrixAt(ringIndex++, dummy.matrix);
        // Instance colour blends the opaque ring back into chocolate, avoiding sorting/overdraw.
        rings.setColorAt(ringIndex - 1, ringColor.copy(basinColor).lerp(crestColor, envelope * .65));
      }
    }
    drops.instanceMatrix.needsUpdate = true;
    if (detail.rings) { rings.instanceMatrix.needsUpdate = true; rings.instanceColor.needsUpdate = true; }
  }
  const basinColor = new THREE.Color(0x54220e), crestColor = new THREE.Color(0xb97543), ringColor = new THREE.Color();
  // Allocate the optional colour attribute before the renderer precompiles materials.
  for (let i = 0; i < 8; i++) rings.setColorAt(i, basinColor);
  rings.instanceColor.setUsage(THREE.DynamicDrawUsage);
  setLevel(0);
  return { drops, rings, update, setLevel };
}
