import * as THREE from 'three';
import { WORLD_SCALE } from './layout.mjs';
import { lawnDensity } from './landscapeLayout.mjs';
import { RELIEF_BASE64, RELIEF_GRID } from './asteroidReliefData.mjs';
import { lynxTempleClearance } from './lynxTempleLayout.mjs';

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
export function baseTerrainHeight(x, z) {
  let y = wildness(x, z) * (1 - smooth(36, 40, Math.hypot(x, z)))
    * (.22 * Math.sin(x * .34) * Math.cos(z * .29) + .1 * Math.sin(x * .8 + z * .47));
  for (const c of craters) {
    const d = Math.hypot(x - c.x, z - c.z) / c.radius;
    if (d < 1) y -= c.depth * (1 - d * d) ** 2;
    if (d > .7 && d < 1.35) y += c.depth * .25 * Math.sin(Math.PI * (d - .7) / .65) ** 2;
  }
  return y;
}

const originalRelief = Int8Array.from(atob(RELIEF_BASE64), value => value.charCodeAt(0));
const { side, min, step } = RELIEF_GRID;

// Elliptical relief in open ground, with offset crests along part of each bowl.
// Each entry is [x, z, length radius, width radius, yaw, height in local cm].
const sculpt = [
  // West of the landing path.
  [-7.8, 32.4, 5.4, 3.7, .81, -16],
  [-5.4, 29.7, 4.2, 2.1, -.68, 15],
  [-11, 33.9, 4.1, 2.8, .31, 11],
  [-13.9, 24.8, 5.8, 3.3, -.55, -13],
  [-11.9, 22.2, 4.9, 2.5, -.23, 14],
  // Eastern clearings around the playing field and toward the rim.
  [13.3, 27.2, 5.2, 3.4, -.86, -14],
  [15.8, 25.9, 4.8, 2.3, -1.02, 14],
  [25.4, 13.3, 5.7, 3.3, -.58, -15],
  [28.1, 12.3, 4.8, 2.6, -.91, 15],
  [30.2, -.5, 6.5, 3.2, -1.18, -17],
  [27.9, -3.1, 5.6, 2.7, -1.01, 13],
  // Bare ground behind the house and on the west flank.
  [15.6, -16.1, 6.8, 3.2, -.39, -17],
  [17.1, -19.1, 5.6, 2.4, -.31, 14],
  [-17.8, -17.2, 5.5, 3.5, .57, -16],
  [-20.8, -16.4, 4.4, 2.2, .89, 13],
  [-29.2, -5.5, 5, 2.6, .37, -12],
  [-31.2, -3.3, 4.5, 2.8, 1.03, 14],
];

function bakeSculpt() {
  const offsets = new Float32Array(originalRelief.length);
  for (const [x, z, rx, rz, yaw, height] of sculpt) {
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const radius = Math.max(rx, rz);
    const firstCol = Math.max(0, Math.ceil((x - radius - min) / step));
    const lastCol = Math.min(side - 1, Math.floor((x + radius - min) / step));
    const firstRow = Math.max(0, Math.ceil((z - radius - min) / step));
    const lastRow = Math.min(side - 1, Math.floor((z + radius - min) / step));
    for (let row = firstRow; row <= lastRow; row++) {
      const dz = min + row * step - z;
      for (let col = firstCol; col <= lastCol; col++) {
        const dx = min + col * step - x;
        const u = (cos * dx + sin * dz) / rx;
        const v = (cos * dz - sin * dx) / rz;
        const t = Math.max(0, 1 - u * u - v * v);
        offsets[row * side + col] += height * t * t;
      }
    }
  }
  return Int16Array.from(originalRelief, (height, i) => {
    if (offsets[i] === 0) return height;
    const x = min + (i % side) * step, z = min + Math.floor(i / side) * step;
    // Fade away from the broad, level garden around the house and playing field.
    let clearance = smooth(0, 2.4, Math.max(-14 - x, x - 21, -12 - z, z - 18));
    for (const crater of craters) {
      clearance = Math.min(clearance, smooth(1.42, 1.95, Math.hypot(x - crater.x, z - crater.z) / crater.radius));
    }
    return height + Math.round(offsets[i] * clearance);
  });
}

// Fold the sculpt into the existing grid once. Walking uses the same four
// samples as before, and the optional pebbles can recover just the change.
const relief = bakeSculpt();

function reliefAt(grid, u, v) {
  const col = Math.floor(u), row = Math.floor(v);
  if (col < 0 || row < 0 || col >= side - 1 || row >= side - 1) return 0;
  const index = row * side + col;
  const bottom = THREE.MathUtils.lerp(grid[index], grid[index+1], u-col);
  const top = THREE.MathUtils.lerp(grid[index+side], grid[index+side+1], u-col);
  return .01 * THREE.MathUtils.lerp(bottom, top, v-row);
}

function heightFromRelief(grid, x, z) {
  const base = baseTerrainHeight(x, z);
  const u = (x-min)/step, v = (z-min)/step;
  return (base + reliefAt(grid, u, v)) * smooth(1.5, 13, lynxTempleClearance(x, z));
}

export function terrainHeight(x, z) {
  return heightFromRelief(relief, x, z);
}

// Stable reference for regenerating the v06 decorative sectors.
export function originalTerrainHeight(x, z) {
  return heightFromRelief(originalRelief, x, z);
}

export function terrainSculptOffset(x, z) {
  const u = (x-min)/step, v = (z-min)/step;
  const offset = reliefAt(relief, u, v) - reliefAt(originalRelief, u, v);
  return offset === 0 ? 0 : offset * smooth(1.5, 13, lynxTempleClearance(x, z));
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

// A midpoint belongs to an edge, not a face. Adjacent triangles therefore
// agree on the height along their common edge after the surface is raised.
export function sculptSurface(source) {
  const p = source.getAttribute('position'), idx = source.index;
  const points = Array.from({length:p.count},(_,i)=>[p.getX(i),p.getZ(i)]);
  const midpoints = new Map(), faces = [];
  const impact = craters[0];
  function split(a,b) {
    const [ax,az] = points[a], [bx,bz] = points[b];
    const x = (ax+bx)*.5, z = (az+bz)*.5;
    const limit = Math.hypot(x-impact.x,z-impact.z)<impact.radius*1.6 ? .73 : 1.4;
    if ((ax-bx)**2+(az-bz)**2<=limit**2) return -1;
    const key = a<b ? `${a}:${b}` : `${b}:${a}`;
    if (!midpoints.has(key)) {
      midpoints.set(key,points.length);
      points.push([x,z]);
    }
    return midpoints.get(key);
  }
  function emit(a,b,c) {
    const ab=split(a,b), bc=split(b,c), ca=split(c,a);
    const count=Number(ab>=0)+Number(bc>=0)+Number(ca>=0);
    if (count===0) { faces.push(a,b,c); return; }
    if (count===3) {
      emit(a,ab,ca); emit(ab,b,bc); emit(ca,bc,c); emit(ab,bc,ca);
      return;
    }
    // Rotate the face so the first edge is split and its opposite edge is last
    // for the two-edge case. Rotations preserve the original winding.
    if (count===1) {
      if (ab>=0) { emit(a,ab,c); emit(ab,b,c); }
      else if (bc>=0) { emit(b,bc,a); emit(bc,c,a); }
      else { emit(c,ca,b); emit(ca,a,b); }
    } else {
      const [u,v,w,m,n] = ab<0 ? [b,c,a,bc,ca] : bc<0 ? [c,a,b,ca,ab] : [a,b,c,ab,bc];
      emit(m,v,n); emit(u,m,w); emit(m,n,w);
    }
  }
  for (let i = 0; i < (idx?.count ?? p.count); i += 3) {
    emit(idx ? idx.getX(i) : i,idx ? idx.getX(i+1) : i+1,idx ? idx.getX(i+2) : i+2);
  }
  const vertices = [], tint = [];
  for (const [x,z] of points) {
    vertices.push(x,terrainHeight(x,z),z);
    const variation = .9+.13*Math.sin(x*2.1+z*1.6);
    tint.push(.24*variation,.205*variation,.15*variation,bareSoil(x,z));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('terrainTint', new THREE.Float32BufferAttribute(tint, 4));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
