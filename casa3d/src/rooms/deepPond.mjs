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
  // A submerged camera renders just these shared meshes, not the entire garden.
  // No copied buffers, reflection pass, scene-wide visibility edits or readbacks.
  const submergedScene = new THREE.Scene();
  submergedScene.background = new THREE.Color('#12383e');
  submergedScene.fog = new THREE.FogExp2('#12383e', .045);
  submergedScene.add(new THREE.HemisphereLight(0xb1e7d8, 0x234450, 1.8));
  const submergedRoot = root.clone(true);
  submergedRoot.matrixAutoUpdate = false;
  submergedScene.add(submergedRoot);
  const submergedSurface = submergedRoot.getObjectByName(surface.mesh.name);
  const viewPoint = new THREE.Vector3();
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
  const state = { quality: quality.state, simulation: simulation.state, explorationEnabled: true,
    underwater: false, submersion: 0,
    widthMetres: layout.rx * 2 * WORLD_SCALE, lengthMetres: layout.rz * 2 * WORLD_SCALE,
    depthMetres: layout.depth * WORLD_SCALE, surfaceTriangles: 0 };
  root.userData.pond = state; root.userData.waterLicense = waterLicense;
  const pond = {
    root, layout, state, submergedScene,
    updateView(camera) {
      camera.getWorldPosition(viewPoint);
      const x = viewPoint.x / WORLD_SCALE, z = viewPoint.z / WORLD_SCALE;
      const near = Math.abs(x - layout.x) < layout.rx * 1.4 && Math.abs(z - layout.z) < layout.rz * 1.4;
      state.submersion = near ? Math.max(0, layout.waterY * WORLD_SCALE - viewPoint.y) : 0;
      state.underwater = near && state.submersion > (state.underwater ? .04 : .12) && layout.contains(x, z);
      return state.underwater;
    },
    update(seconds, camera, viewportHeight, enabled = true) {
      options.enabled = enabled && !document.hidden;
      options.reducedMotion = motionPreference.matches;
      options.simulationSupported = supported && !simulation.state.failed && (!state.underwater || state.submersion < 1.2);
      // The distant surface is completely absorbed by the underwater fog.
      const showSurface = !state.underwater || state.submersion < 24;
      options.enabled &&= showSurface;
      surface.uniforms.uMotion.value = options.reducedMotion ? 0 : 1;
      surface.uniforms.uSubmersion.value = state.underwater ? state.submersion : 0;
      quality.tick(seconds, camera, viewportHeight, options);
      if (quality.state.level < 2 && simulation.state.size && seconds - lastSimulationTime > 10) simulation.release();
      state.surfaceTriangles = surface.mesh.geometry.index.count / 3;
      if (state.underwater) {
        root.updateWorldMatrix(true, false);
        submergedRoot.matrix.copy(root.matrixWorld);
        submergedSurface.geometry = surface.mesh.geometry;
        submergedSurface.visible = showSurface;
      }
    },
    // Coordinates for future swimming/interactions are explicit garden-local units.
    containsVolume: layout.containsVolume,
    getDepthAt: layout.sampleDepth,
    getFloorAt: layout.floorAt,
    disturb: simulation.disturb,
    dispose() {
      garden.remove(root); simulation.dispose(); surface.dispose(); basin.userData.dispose();
      if (garden.userData.pond === pond) delete garden.userData.pond;
    },
  };
  garden.userData.pond = pond;
  return pond;
}
