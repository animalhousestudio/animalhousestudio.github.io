import * as THREE from 'three';
import { sculptSurface, terrainHeight } from './terrainDetail.mjs';

export function insideHouse(x, z) {
  return x > -5.9 && x < 9.2 && z > -6.12 && z < 4.98;
}

// Weld positions for edge counting only. The render geometry keeps its normals.
export function surfaceBoundary(geometry) {
  const positions = geometry.getAttribute('position');
  const points = [], ids = [], unique = new Map(), edges = new Map();
  for (let i = 0; i < positions.count; i++) {
    const point = [positions.getX(i), positions.getZ(i)];
    const key = point.map(v => v.toFixed(4)).join(',');
    if (!unique.has(key)) { unique.set(key, points.length); points.push(point); }
    ids.push(unique.get(key));
  }
  const index = geometry.index;
  const count = index ? index.count : positions.count;
  for (let i = 0; i < count; i += 3) {
    const triangle = [0, 1, 2].map(j => ids[index ? index.getX(i + j) : i + j]);
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (edges.has(key)) edges.delete(key);
      else edges.set(key, [points[a], points[b]]);
    }
  }
  return [...edges.values()];
}

export function containsSurface(boundary, x, z) {
  let inside = false;
  for (const [[ax, az], [bx, bz]] of boundary) {
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

export function prepareAsteroid(model, groundMaterial) {
  const surface = model.getObjectByName('Asteroid_Surface');
  if (!surface) throw new Error('Asteroid_Surface missing from asteroid asset');
  model.updateMatrixWorld(true);
  // Bake the glTF axis conversion once; physics and UVs use game coordinates.
  surface.geometry.applyMatrix4(surface.matrixWorld);
  const boundary = surfaceBoundary(surface.geometry);
  const originalGeometry = surface.geometry;
  surface.geometry = sculptSurface(originalGeometry);
  originalGeometry.dispose();
  model.attach(surface);
  surface.position.set(0, 0, 0);
  surface.quaternion.identity();
  surface.scale.set(1, 1, 1);
  const positions = surface.geometry.getAttribute('position');
  const uv = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    uv[i * 2] = positions.getX(i) / 52 + .5;
    uv[i * 2 + 1] = positions.getZ(i) / 52 + .5;
  }
  surface.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  surface.material.dispose();
  surface.material = groundMaterial;
  // Keep the existing open stair shaft and basement visible inside the house.
  groundMaterial.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('void main() {',
      'attribute vec4 terrainTint;\nvarying vec4 soilTint;\nvarying vec3 terrainWorld;\nvoid main() {').replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nterrainWorld = transformed;\nsoilTint = terrainTint;');
    shader.fragmentShader = shader.fragmentShader.replace('void main() {',
      'varying vec4 soilTint;\nvarying vec3 terrainWorld;\nvoid main() {\nif (terrainWorld.x > -5.9 && terrainWorld.x < 9.2 && terrainWorld.z > -6.12 && terrainWorld.z < 4.98) discard;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, soilTint.rgb, soilTint.a);');
  };
  groundMaterial.customProgramCacheKey = () => 'asteroid-sculpted-soil-v1';
  groundMaterial.needsUpdate = true;
  model.traverse(node => { if (node.isMesh) node.receiveShadow = true; });
  return { model, surface, boundary, heightAt: (x, z) =>
    !insideHouse(x, z) && containsSurface(boundary, x, z) ? terrainHeight(x, z) : null };
}
