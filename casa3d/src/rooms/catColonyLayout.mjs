import { Box3, MathUtils, Vector3 } from 'three';
import { LANDING_Z } from '../arrival.mjs';
import { WORLD_SCALE } from './layout.mjs';
import { getPondRadius, POND_FOOTPRINTS } from './pondLayout.mjs';
import { naturalRockPlacements } from './rockLayout.mjs';
import { noise } from './terrainDetail.mjs';

// Centres and paths in gameplay metres, like the coaster layout.
export const CAT_CLEARINGS = [
  { id: 'arrival', label: 'Arrivo', x: -15.2, z: LANDING_Z * WORLD_SCALE - 22.8, viewYaw: -.16, catIds: [1] },
  { id: 'east', label: 'Alveare', x: 87, z: 67, viewYaw: .4, catIds: [5, 6, 7, 8] },
  { id: 'garden', label: 'Giardino', x: -86, z: 42, viewYaw: .3, catIds: [9, 10, 11, 12] },
  { id: 'shore', label: 'Sponde', x: -148, z: 44, viewYaw: .3, catIds: [13, 14, 15, 16] },
  { id: 'temple', label: 'Tempietto', x: -42, z: -81, viewYaw: .3, catIds: [17, 18, 19, 20] },
  { id: 'orchard', label: 'Retro della casa', x: 79, z: -72, viewYaw: -.35, catIds: [21, 22, 23, 24] },
  { id: 'southwest', label: 'Radure a sud-ovest', x: -50, z: 140, viewYaw: 2.85, catIds: [2] },
  { id: 'southeast', label: 'Radure a sud-est', x: 65, z: 126, viewYaw: .4, catIds: [3] },
  { id: 'north', label: 'Radure a nord', x: 55, z: -130, viewYaw: -.3, catIds: [4] },
];

// Fur, markings, pattern, size, build. Each row describes one individual.
const coats = [
  [0xc56b35, 0x76361e, 'tabby', 1.02, .34],
  [0x282933, 0xf8eddf, 'tuxedo', 1.14, .39],
  [0xe8d8c5, 0x69473c, 'point', .89, -.23],
  [0xf0dbc1, 0xb9795f, 'patched', .96, -.03],
  [0x546575, 0x293449, 'tabby', 1.10, .13],
  [0xeee9e2, 0xe2d6ce, 'solid', .85, -.18],
  [0x6e4b3b, 0x2d201f, 'tabby', 1.04, .02],
  [0xf0e3cf, 0xbf6938, 'calico', 1.20, .35],
  [0x54606c, 0xd7e0e0, 'tuxedo', 1.12, .22],
  [0xd89960, 0xf3d1a0, 'solid', .91, -.13],
  [0x352b29, 0xd39760, 'patched', 1.18, .39],
  [0xd1b09a, 0x766186, 'point', .98, -.13],
  [0xcfccbf, 0x6a7881, 'patched', 1.05, .20],
  [0x945948, 0x562e2b, 'tabby', 1.08, .31],
  [0x463f4e, 0x211e2b, 'solid', .88, -.26],
  [0xf6e8de, 0x777c91, 'calico', .94, .13],
  [0x9e929f, 0xe8e1e6, 'tuxedo', 1.15, .21],
  [0x9b7b60, 0x634935, 'point', 1.06, .09],
  [0xa3afac, 0x4e6468, 'tabby', .93, -.19],
  [0xe1be7e, 0xb05331, 'patched', 1.19, .41],
  [0x463029, 0xe3c59f, 'tuxedo', 1.02, -.14],
  [0xf1c183, 0xa26335, 'tabby', .81, -.24],
  [0xf2e9dd, 0xa36958, 'point', 1.09, .13],
  [0xded7cb, 0x475361, 'patched', 1.17, .32],
];

const TAU = Math.PI * 2;
const ROUTE_SAMPLES = 48;
export const CAT_SIZE_MULTIPLIER = 1.2;
const BODY_CLEARANCE = .8 * CAT_SIZE_MULTIPLIER;
export const CAT_VISUAL_RADIUS = 1.2 * CAT_SIZE_MULTIPLIER;
const slots = [[-4.2, -3.8], [3.1, 3.8], [4.2, -4.1], [-3.9, 4.4]];

export function createCatColonyLayout(heightAt, { trees = [], supports = [], blocked = () => false } = {}) {
  const obstacles = [
    ...naturalRockPlacements.map(({ x, z, size }) => [x * WORLD_SCALE, z * WORLD_SCALE, size * WORLD_SCALE * .53]),
    ...trees.map(({ x, z }) => [x * WORLD_SCALE, z * WORLD_SCALE, .7]),
    ...supports.filter(support => support.column).map(({ position }) => [position.x, position.z, .45]),
  ];
  const routes = [];
  const bounds = new Box3();
  const clearance = new Vector3(2.8, 2, 2.8).multiplyScalar(CAT_SIZE_MULTIPLIER);

  function patrol(x, z, rx, rz, angle, reverse) {
    const centre = new Vector3(x, 0, z);
    if (routes.some(route => Math.hypot(centre.x - route.centre.x, centre.z - route.centre.z)
      < Math.max(rx, rz) + route.radius + BODY_CLEARANCE * 2)) return null;
    const points = [], distances = [0];
    for (let i = 0; i <= ROUTE_SAMPLES; i++) {
      const theta = angle + TAU * i / ROUTE_SAMPLES * reverse;
      const px = x + rx * Math.cos(theta), pz = z + rz * Math.sin(theta);
      const lx = px / WORLD_SCALE, lz = pz / WORLD_SCALE;
      const y = heightAt(lx, lz);
      if (y === null || POND_FOOTPRINTS.some(pond => getPondRadius(pond, lx, lz, .35 * CAT_SIZE_MULTIPLIER) < 1)
        || obstacles.some(([ox, oz, radius]) => Math.hypot(px - ox, pz - oz) < radius + BODY_CLEARANCE)) return null;
      const point = new Vector3(px, y * WORLD_SCALE, pz);
      if (blocked(point)) return null;
      const previous = points.at(-1);
      if (previous) {
        const step = Math.hypot(point.x - previous.x, point.z - previous.z);
        if (Math.abs(point.y - previous.y) > step * .27) return null;
        distances.push(distances.at(-1) + step);
      }
      points.push(point);
    }
    return { points, distances, length: distances.at(-1), centre, radius: Math.max(rx, rz) };
  }

  for (const clearing of CAT_CLEARINGS) {
    for (const [slot, catId] of clearing.catIds.entries()) {
      const index = catId - 1;
      const [dx, dz] = clearing.catIds.length === 1 ? [0, 0] : slots[slot];
      let route;
      for (let attempt = 0; attempt < 25 && !route; attempt++) {
        const angle = noise(index, 94) * TAU;
        const offset = attempt ? 1.05 * Math.sqrt(attempt) : 0;
        const direction = angle + attempt * 2.399963;
        route = patrol(clearing.x + dx + offset * Math.cos(direction), clearing.z + dz + offset * Math.sin(direction),
          1.48 + noise(index, 91) * .55, 1.12 + noise(index, 92) * .5, angle, index % 2 ? -1 : 1);
      }
      if (!route) {
        console.warn(`Nessun percorso libero per il gatto ${catId} (${clearing.id})`);
        continue;
      }
      const [fur, markings, pattern, originalSize, build] = coats[index];
      const size = originalSize * CAT_SIZE_MULTIPLIER;
      const speed = (.42 + noise(index, 93) * .14) * size;
      const walk = route.length / speed;
      const rest = 6 + noise(index, 96) * 6, groom = 3.8 + noise(index, 97) * 2;
      const durations = [walk * .52, groom, walk * .48, rest];
      routes.push({ ...route, id: `cat-${catId}`, clearing: clearing.id, fur, markings, pattern, size, build,
        seed: noise(index, 98), speed, durations, phase: [1.1, walk * .52 + 1.8, walk * .52 + groom + 2,
          walk + groom + rest * .41][index % slots.length] });
      const routeBounds = new Box3().setFromPoints(route.points).expandByVector(clearance);
      bounds.union(routeBounds);
    }
  }
  return { routes, bounds };
}

// Travel is split by a wash, then the cat returns to its starting spot to rest.
export function sampleCat(route, seconds, pose, mode = null) {
  const [walkA, wash, walkB, rest] = route.durations;
  const total = walkA + wash + walkB + rest;
  let t = MathUtils.euclideanModulo(seconds + route.phase, total);
  if (mode === 'walk') t = walkA * .32;
  if (mode === 'groom') t = walkA + wash * .5;
  if (mode === 'rest') t = total - rest * .48;

  const ease = (time, duration) => {
    // Smooth starts and stops while preserving the full travelled distance.
    const ramp = .46;
    if (time < ramp) return .5 * time ** 2 / ramp / (duration - ramp);
    if (time > duration - ramp) return 1 - .5 * (duration - time) ** 2 / ramp / (duration - ramp);
    return (time - ramp * .5) / (duration - ramp);
  };
  let progress;
  if (t < walkA) {
    pose.action = 'walk';
    pose.elapsed = t;
    pose.amount = MathUtils.smoothstep(Math.min(t, walkA - t), 0, .64);
    progress = .52 * ease(t, walkA);
  } else if (t < walkA + wash) {
    const elapsed = t - walkA;
    pose.action = 'groom';
    pose.elapsed = mode === 'groom' ? seconds : elapsed;
    pose.amount = MathUtils.smoothstep(Math.min(elapsed, wash - elapsed), 0, .65);
    progress = .52;
  } else if (t < total - rest) {
    pose.action = 'walk';
    pose.elapsed = t - walkA - wash;
    pose.amount = MathUtils.smoothstep(Math.min(pose.elapsed, walkB - pose.elapsed), 0, .64);
    progress = .52 + .48 * ease(pose.elapsed, walkB);
  } else {
    const elapsed = t - (total - rest);
    pose.action = 'rest';
    pose.elapsed = elapsed;
    pose.amount = MathUtils.smoothstep(Math.min(elapsed, rest - elapsed), 0, .92);
    progress = 0;
  }
  const distance = progress * route.length;
  let lo = 0, hi = ROUTE_SAMPLES;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (route.distances[mid] <= distance) lo = mid;
    else hi = mid;
  }
  const fraction = (distance - route.distances[lo]) / (route.distances[hi] - route.distances[lo]);
  pose.position.lerpVectors(route.points[lo], route.points[hi], fraction);
  const previous = route.points[(lo + ROUTE_SAMPLES - 1) % ROUTE_SAMPLES];
  const next = route.points[(hi + 1) % ROUTE_SAMPLES];
  const tangentA = Math.atan2(route.points[hi].x - previous.x, route.points[hi].z - previous.z);
  const tangentB = Math.atan2(next.x - route.points[lo].x, next.z - route.points[lo].z);
  pose.yaw = tangentA + (MathUtils.euclideanModulo(tangentB - tangentA + Math.PI, TAU) - Math.PI) * fraction;
  pose.distance = distance;
  return pose;
}
