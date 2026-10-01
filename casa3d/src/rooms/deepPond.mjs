import * as THREE from 'three';
import { WORLD_SCALE } from './layout.mjs';
import { createPondBasin } from './pondBasin.mjs';
import { createPondQuality, pondDeviceLevel, POND_LEVELS } from './pondQuality.mjs';
import { createPondSimulation, createPondSurface, supportsPondSimulation } from './pondWater.mjs';
import waterLicense from '../assets/water-reference/LICENSE?raw';

export function addDeepPond(garden, layout, renderer) {
  const root = new THREE.Group(); root.name = 'DeepGardenPond';
  root.userData.staticDetail = true;
  const basin = createPondBasin(layout);
  const supported = supportsPondSimulation(renderer);
  const surface = createPondSurface(layout, supported);
  const simulation = createPondSimulation(renderer, layout);
  root.add(basin, surface.mesh); garden.add(root);
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const localBounds = surface.mesh.geometry.boundingSphere.clone();
  let lastSimulationTime = -Infinity;
  const options = { enabled: false, reducedMotion: false, simulationSupported: supported };
  const quality = createPondQuality({ root, localBounds, deviceLevel: pondDeviceLevel(navigator),
    onLevel(level) {
      surface.setLevel(level);
      if (level < 2) {
        surface.uniforms.uSimulation.value = 0;
        surface.uniforms.uWaves.value = surface.neutral;
      }
    },
    onStep(seconds, dt, level) {
      surface.uniforms.uTime.value = seconds;
      if (level < 2) return;
      const size = POND_LEVELS[level].simulationSize;
      const texture = simulation.step(seconds, dt, size);
      if (texture) {
        surface.uniforms.uWaves.value = texture;
        surface.uniforms.uSimulation.value = 1;
        surface.uniforms.uTexel.value.set(1 / size, 1 / size);
        lastSimulationTime = seconds;
      } else {
        surface.uniforms.uSimulation.value = 0;
        surface.uniforms.uWaves.value = surface.neutral;
        options.simulationSupported = false;
      }
    },
  });
  const state = { quality: quality.state, simulation: simulation.state, explorationEnabled: false,
    widthMetres: layout.rx * 2 * WORLD_SCALE, lengthMetres: layout.rz * 2 * WORLD_SCALE,
    depthMetres: layout.depth * WORLD_SCALE, surfaceTriangles: 0 };
  root.userData.pond = state; root.userData.waterLicense = waterLicense;
  const pond = {
    root, layout, state,
    update(seconds, camera, viewportHeight, enabled = true) {
      options.enabled = enabled && !document.hidden;
      options.reducedMotion = motionPreference.matches;
      surface.uniforms.uMotion.value = options.reducedMotion ? 0 : 1;
      quality.tick(seconds, camera, viewportHeight, options);
      if (quality.state.level < 2 && simulation.state.size && seconds - lastSimulationTime > 10) simulation.release();
      state.surfaceTriangles = surface.mesh.geometry.index.count / 3;
    },
    // Coordinates for future swimming/interactions are explicit garden-local units.
    containsVolume: layout.containsVolume,
    getDepthAt: layout.sampleDepth,
    getFloorAt: layout.floorAt,
    disturb: simulation.disturb,
    // The physical rim stops walkers. Flying down into the unfinished swim volume
    // returns to the nearest shore, instead of adding a walkable disk over water.
    recoverUnfinishedEntry(position, eyeHeight, playerRadius, target) {
      if (state.explorationEnabled) return false;
      const x = position.x / WORLD_SCALE, z = position.z / WORLD_SCALE;
      if (Math.abs(x - layout.x) > layout.rx || Math.abs(z - layout.z) > layout.rz
        || !layout.contains(x, z) || position.y - eyeHeight > (layout.waterY + .025) * WORLD_SCALE) return false;
      const angle = Math.atan2((z - layout.z) / layout.rz, (x - layout.x) / layout.rx);
      const margin = playerRadius / WORLD_SCALE + .15;
      target.set((layout.x + Math.cos(angle) * (layout.rx * 1.07 + margin)) * WORLD_SCALE,
        (layout.shoreY + .05) * WORLD_SCALE + eyeHeight,
        (layout.z + Math.sin(angle) * (layout.rz * 1.07 + margin)) * WORLD_SCALE);
      return true;
    },
    dispose() {
      garden.remove(root); simulation.dispose(); surface.dispose(); basin.userData.dispose();
      if (garden.userData.pond === pond) delete garden.userData.pond;
    },
  };
  garden.userData.pond = pond;
  return pond;
}
