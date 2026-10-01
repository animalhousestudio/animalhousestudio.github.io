import { CatmullRomCurve3, Vector3, MathUtils } from 'three';
import { getPondOutline, getPondRadius, POND_FOOTPRINT } from './pondLayout.mjs';

// Garden-local units: the game scales the complete landscape by five.
export const GARDEN = Object.freeze({ x: -23, z: 3, rx: 10.5, rz: 11.5, gate: Math.PI / 4 });
export const POND_RESERVE = Object.freeze({ x: -24, z: 3, rx: 2.1, rz: 1.55 });
export const PATH_WIDTH = .28; // 1.4 metres in game, one person wide.
export const ellipseDistance = (x, z, area) => Math.hypot((x - area.x) / area.rx, (z - area.z) / area.rz);
const pondClearanceOutline = getPondOutline(POND_FOOTPRINT, undefined, .5);
const smooth = (a, b, value) => MathUtils.smoothstep(value, a, b);
export const paths = [
  [[0, 43], [-.16, 35], [.3, 26], [.9, 18], [.67, 10.35]],
  [[.88, 15.8], [-4, 15.8], [-10, 15], [-15.575, 11.132]],
].map(points => new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal'));
const routeSegments = paths.flatMap(curve => {
  const points = curve.getSpacedPoints(200);
  return points.slice(1).map((b, i) => [points[i], b]);
});
export function pathDistance(x, z) {
  let best = Infinity;
  for (const [a, b] of routeSegments) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}
export function lawnDensity(x, z) {
  const lawn = 1 - smooth(.78, 1.08, Math.hypot((x - .5) / 25, z / 22));
  const garden = 1 - smooth(.94, 1.035, ellipseDistance(x, z, GARDEN));
  return Math.max(.045, lawn * .78, garden);
}
export function reservedGround(x, z, margin = 0) {
  if (getPondRadius(POND_FOOTPRINT, x, z, .08 + margin) < 1) return true;
  return pathDistance(x, z) < PATH_WIDTH / 2 + margin;
}
export function borderDistance(x, z) {
  return Math.abs(ellipseDistance(x, z, GARDEN) - 1) * Math.min(GARDEN.rx, GARDEN.rz);
}
export function gardenBorderClear(b) {
  const nearest = ellipseDistance(MathUtils.clamp(GARDEN.x, b.minX, b.maxX), MathUtils.clamp(GARDEN.z, b.minZ, b.maxZ), GARDEN);
  const farthest = Math.max(...[b.minX, b.maxX].flatMap(x => [b.minZ, b.maxZ].map(z => ellipseDistance(x, z, GARDEN))));
  return nearest > 1.035 || farthest < .965;
}
export function landscapeFootprintClear(b) {
  // Corners, pond vertices and edge crossings cover concave coves as well as
  // rectangles spanning the whole pond. This runs only during prop placement.
  if ([b.minX, b.maxX].some(x => [b.minZ, b.maxZ].some(z => getPondRadius(POND_FOOTPRINT, x, z, .5) <= 1))) return false;
  for (let i = 0; i < pondClearanceOutline.length; i++) {
    const [ax, az] = pondClearanceOutline[i], [bx, bz] = pondClearanceOutline[(i + 1) % pondClearanceOutline.length];
    if (ax >= b.minX && ax <= b.maxX && az >= b.minZ && az <= b.maxZ) return false;
    for (const x of [b.minX, b.maxX]) {
      const t = (x - ax) / (bx - ax), z = az + t * (bz - az);
      if (t >= 0 && t <= 1 && z >= b.minZ && z <= b.maxZ) return false;
    }
    for (const z of [b.minZ, b.maxZ]) {
      const t = (z - az) / (bz - az), x = ax + t * (bx - ax);
      if (t >= 0 && t <= 1 && x >= b.minX && x <= b.maxX) return false;
    }
  }
  return !routeSegments.some(([p]) => p.x > b.minX - .25 && p.x < b.maxX + .25 && p.z > b.minZ - .25 && p.z < b.maxZ + .25);
}
