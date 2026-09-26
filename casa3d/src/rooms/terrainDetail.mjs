import * as THREE from 'three';
import { WORLD_SCALE } from './layout.mjs';
import { lawnDensity } from './landscapeLayout.mjs';

// Coordinates are in the unscaled world. Keep the established garden intact.
export const craters = [
  { x: -29, z: -15, radius: 6.4, depth: 1.65 },
  { x: 23, z: -28, radius: 4.8, depth: 1.15 },
  { x: -22, z: 29, radius: 3.5, depth: .85 },
  { x: 10, z: 33, radius: 2.7, depth: .65 },
  { x: -9, z: -32, radius: 2.3, depth: .55 },
];
export const propPlacements = [
  { name: 'CrashedUFO', x: -29, z: -15, size: 8.2, tilt: .48, yaw: -.55, buried: 1.8 },
  { name: 'AsteroidKeyboard', x: -3.2, z: 14, size: 2.4 / WORLD_SCALE, height: 1.25 / WORLD_SCALE, clearing: .6, yaw: -.55 },
  { name: 'AsteroidPunchball', x: 7, z: 22, size: 2.05, yaw: .25 },
];
export const noise = (i, salt = 0) => THREE.MathUtils.euclideanModulo(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453, 1);
const smooth = (a, b, v) => THREE.MathUtils.smoothstep(v, a, b);
export function wildness(x, z) {
  // Includes house, veranda, approach, pond and pitch, with a soft transition.
  return smooth(0, 6, Math.max(-25 - x, x - 26, -23 - z, z - 25))
    * (z > 20 ? smooth(3, 7, Math.abs(x)) : 1);
}
export function terrainHeight(x, z) {
  let y = wildness(x, z) * (1 - smooth(36, 40, Math.hypot(x, z)))
    * (.22 * Math.sin(x * .34) * Math.cos(z * .29) + .1 * Math.sin(x * .8 + z * .47));
  for (const c of craters) {
    const d = Math.hypot(x - c.x, z - c.z) / c.radius;
    if (d < 1) y -= c.depth * (1 - d * d) ** 2;
    if (d > .7 && d < 1.35) y += c.depth * .25 * Math.sin(Math.PI * (d - .7) / .65) ** 2;
  }
  return y;
}
export function bareSoil(x, z) {
  let bare = wildness(x, z) * (.35 + .45 * smooth(-.4, .6, Math.sin(x * .24) * Math.cos(z * .31)));
  for (const c of craters) bare = Math.max(bare, 1 - smooth(.85, 1.4, Math.hypot(x - c.x, z - c.z) / c.radius));
  return Math.max(bare, (1 - lawnDensity(x, z)) * .57);
}
export const rockPlacements = [];
for (let i = 0; i < 42; i++) {
  const angle = noise(i, 1) * Math.PI * 2, radius = 28 + noise(i, 2) * 9;
  const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
  if (wildness(x, z) < .15 || craters.some(c => Math.hypot(x - c.x, z - c.z) < c.radius * 1.1)) continue;
  for (let j = 0; j < 5; j++) {
    rockPlacements.push({ x: x + (noise(i * 7 + j, 3) - .5) * 4,
      z: z + (noise(i * 7 + j, 4) - .5) * 4,
      size: j === 0 ? 1.4 + noise(i, 5) * 2.2 : .18 + noise(i * 7 + j, 6) * .9,
      yaw: noise(i * 7 + j, 7) * Math.PI * 2 });
  }
}
export function allowsGrass(x, z) {
  if (Math.hypot(x, z) > 39.8 || bareSoil(x, z) > .72) return false;
  if (propPlacements.some(p => Math.hypot(x - p.x, z - p.z) < (p.clearing ?? p.size * .65))) return false;
  return !rockPlacements.some(r => Math.hypot(x - r.x, z - r.z) < r.size * .43);
}

// Subdivide the original disk without changing its perimeter or the cliff seam.
export function sculptSurface(source) {
  const p = source.getAttribute('position'), idx = source.index;
  const vertices = [], tint = [];
  function emit(a, b, c) {
    const ab = a.distanceToSquared(b), bc = b.distanceToSquared(c), ca = c.distanceToSquared(a);
    if (Math.max(ab, bc, ca) > 1.4 ** 2) {
      if (ab >= bc && ab >= ca) { const m = a.clone().lerp(b, .5); emit(a, m, c); emit(m, b, c); }
      else if (bc >= ca) { const m = b.clone().lerp(c, .5); emit(a, b, m); emit(a, m, c); }
      else { const m = c.clone().lerp(a, .5); emit(a, b, m); emit(m, b, c); }
      return;
    }
    for (const v of [a, b, c]) {
      vertices.push(v.x, terrainHeight(v.x, v.z), v.z);
      const variation = .9 + .13 * Math.sin(v.x * 2.1 + v.z * 1.6);
      tint.push(.24 * variation, .205 * variation, .15 * variation, bareSoil(v.x, v.z));
    }
  }
  for (let i = 0; i < (idx?.count ?? p.count); i += 3) {
    emit(...[0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(p, idx ? idx.getX(i + j) : i + j)));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('terrainTint', new THREE.Float32BufferAttribute(tint, 4));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
