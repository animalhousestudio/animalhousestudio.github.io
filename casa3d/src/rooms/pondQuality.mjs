import * as THREE from 'three';

// Level 1 only updates analytic shader uniforms. Levels 2/3 may run ONE fixed
// simulation step; the caller owns the renderer and the optional ping-pong targets.
export const POND_LEVELS = Object.freeze([
  { hz: 0, simulationSize: 0, fixedDt: 0 },
  { hz: 10, simulationSize: 0, fixedDt: 1 / 10 },
  { hz: 15, simulationSize: 64, fixedDt: 1 / 15 },
  { hz: 30, simulationSize: 128, fixedDt: 1 / 30 },
].map(Object.freeze));

export function pondDeviceLevel(device = {}) {
  const { hardwareConcurrency: cores, deviceMemory: memory, userAgent = '', maxTouchPoints = 0 } = device;
  if ((cores > 0 && cores <= 4) || (memory > 0 && memory <= 4)) return 1;
  if (/Android|iPhone|iPad|iPod/i.test(userAgent) || maxTouchPoints > 1) return 2;
  return cores >= 8 ? 3 : 2;
}

const EMPTY_OPTIONS = Object.freeze({});
const noop = () => {};

/**
 * Schedules water work without timers, raycasts, GL queries or frame allocations.
 * localBounds must cover the surface (not the deep basin), in root-local space.
 * tick returns true only when onStep ran. enabled includes document visibility.
 * onLevel(level, profile) runs initially and on changes; zero means suspend work,
 * not hide the water. Reduced motion uses the static analytic level without steps.
 */
export function createPondQuality({ root, localBounds, deviceLevel = 2, onLevel = noop, onStep = noop }) {
  const ceiling = Math.max(1, Math.min(3, Math.floor(Number(deviceLevel) || 2)));
  const sphere = new THREE.Sphere(), frustum = new THREE.Frustum();
  const viewProjection = new THREE.Matrix4(), eye = new THREE.Vector3(), viewCenter = new THREE.Vector3();
  const state = {
    level: 0, deviceLevel: ceiling, budgetLevel: ceiling, updates: 0,
    simulationUpdates: 0, distance: Infinity, pixels: 0, frameSeconds: 0,
  };
  let lastTime = null, nextUpdate = 0, wasAnimating = false, wasAdaptive = false;
  let slowTime = 0, fastTime = 0, cooldown = 0;
  onLevel(0, POND_LEVELS[0]);

  function tick(seconds, camera, viewportHeight, options = EMPTY_OPTIONS) {
    if (!Number.isFinite(seconds)) return false;
    const { enabled = true, reducedMotion = false, simulationSupported = true } = options;
    const elapsed = lastTime === null ? 0 : seconds - lastTime;
    const clockReset = lastTime === null || elapsed < 0 || elapsed >= .25;
    const continuous = elapsed > 0 && elapsed < .25;
    lastTime = seconds;
    let visible = enabled;
    for (let node = root; visible && node; node = node.parent) visible = node.visible;
    if (visible) {
      root.updateWorldMatrix(true, false);
      camera.updateWorldMatrix(true, false);
      sphere.copy(localBounds).applyMatrix4(root.matrixWorld);
      eye.setFromMatrixPosition(camera.matrixWorld);
      state.distance = Math.max(0, eye.distanceTo(sphere.center) - sphere.radius);
      viewCenter.copy(sphere.center).applyMatrix4(camera.matrixWorldInverse);
      // Nearest sphere depth deliberately overestimates a partly clipped surface.
      // This also remains conservative when the eye is above/inside its bounds.
      const depth = camera.isOrthographicCamera ? 1 : Math.max(.1, -viewCenter.z - sphere.radius);
      state.pixels = Math.max(0, viewportHeight || 0) * Math.abs(camera.projectionMatrix.elements[5])
        * sphere.radius / depth;
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProjection);
      visible = frustum.intersectsSphere(sphere);
    } else {
      state.distance = Infinity;
      state.pixels = 0;
    }

    let spatialLevel = 0;
    const radius = sphere.radius;
    if (visible && state.distance < Math.max(state.level ? 100 : 90, radius * (state.level ? 11 : 10))
      && state.pixels > (state.level ? 8 : 12)) {
      spatialLevel = 1;
      if (state.distance < Math.max(state.level >= 2 ? 24 : 18, radius * (state.level >= 2 ? 3.6 : 3))
        && state.pixels > (state.level >= 2 ? 85 : 110)) {
        spatialLevel = 2;
        if (state.distance < Math.max(state.level >= 3 ? 14 : 10, radius * (state.level >= 3 ? 1.9 : 1.5))
          && state.pixels > (state.level >= 3 ? 180 : 220)) spatialLevel = 3;
      }
    }

    const adaptive = spatialLevel >= 2 && simulationSupported && !reducedMotion && ceiling > 1;
    if (adaptive && wasAdaptive && continuous) {
      // A time-weighted mean tolerates isolated good frames during sustained load.
      const weight = 1 - Math.exp(-elapsed / .75);
      state.frameSeconds += (Math.min(elapsed, .1) - state.frameSeconds) * weight;
      cooldown = Math.max(0, cooldown - elapsed);
      if (cooldown === 0) {
        slowTime = state.frameSeconds > 1 / 28 ? slowTime + elapsed : Math.max(0, slowTime - elapsed * .5);
        fastTime = state.frameSeconds < 1 / 48 ? fastTime + elapsed : Math.max(0, fastTime - elapsed * 2);
        if (slowTime >= 2.5 && state.budgetLevel > 1) {
          state.budgetLevel--;
          slowTime = fastTime = 0;
          cooldown = 4;
        } else if (fastTime >= 12 && state.budgetLevel < ceiling) {
          state.budgetLevel++;
          slowTime = fastTime = 0;
          cooldown = 4;
        }
      }
    } else {
      state.frameSeconds = continuous ? Math.min(elapsed, .1) : 0;
      slowTime = fastTime = 0;
    }
    wasAdaptive = adaptive;

    const level = Math.min(spatialLevel, state.budgetLevel, simulationSupported && !reducedMotion ? 3 : 1);
    if (level !== state.level) {
      state.level = level;
      onLevel(level, POND_LEVELS[level]);
      nextUpdate = seconds;
    }
    const animating = level > 0 && !reducedMotion;
    if (!wasAnimating || clockReset) nextUpdate = seconds;
    wasAnimating = animating;
    if (!animating || seconds + 1e-6 < nextUpdate) return false;
    const detail = POND_LEVELS[level];
    onStep(seconds, detail.fixedDt, level);
    state.updates++;
    if (detail.simulationSize) state.simulationUpdates++;
    nextUpdate += detail.fixedDt;
    // A delayed frame never starts a catch-up loop or integrates a giant dt.
    if (nextUpdate <= seconds + 1e-6) nextUpdate = seconds + detail.fixedDt;
    return true;
  }

  return { tick, state };
}
