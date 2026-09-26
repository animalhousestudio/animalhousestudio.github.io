import { landscapeFootprintClear } from './landscapeLayout.mjs';
import { propPlacements, rockPlacements } from './terrainDetail.mjs';

// Garden-local coordinates, including the pitch's goals and a safety margin.
export const PITCH_PLACEMENT = { x: 16, y: .02, z: -1.5, yaw: Math.PI / 2 };
export const PITCH_CLEARANCE = { minX: 10.65, maxX: 21.35, minZ: -10.984, maxZ: 7.984 };
export const gardenRockPlacements = [
  { x: -36, z: 4, size: 2, yaw: .2 },
  { x: -8, z: -20, size: 2.4, yaw: 1.1 },
  { x: 23, z: -20, size: 2.8, yaw: 2.4 },
  { x: 23, z: 11, size: 2.5, yaw: 3.1 },
  { x: -20, z: 17, size: 2.7, yaw: 4.2 },
  { x: 16, z: 19, size: 2.5, yaw: 5 },
  { x: -32, z: 15, size: 1.6, yaw: 5.8 },
  { x: 22, z: 16, size: 1.6, yaw: .4 },
  { x: -23, z: 16, size: 1.5, yaw: 4.7 },
];
export const naturalRockPlacements = [...gardenRockPlacements, ...rockPlacements];
const houseAreas = [
  { minX: -7.9, maxX: 11, minZ: -9.8, maxZ: 8.7 },
  { minX: -15, maxX: -5, minZ: -4, maxZ: 4.6 },
  { minX: -2.5, maxX: 2.5, minZ: 3, maxZ: 17.5 },
];
export function intersectsFootprint(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}
export function isRockFootprintClear(bounds, pitch = PITCH_CLEARANCE) {
  if (!landscapeFootprintClear(bounds)) return false;
  if ([pitch, ...houseAreas].some(area => intersectsFootprint(bounds, area))) return false;
  for (const p of propPlacements) {
    const x = Math.max(bounds.minX, Math.min(p.x, bounds.maxX));
    const z = Math.max(bounds.minZ, Math.min(p.z, bounds.maxZ));
    if (Math.hypot(x - p.x, z - p.z) < (p.clearing ?? p.size * .65) + .4) return false;
  }
  return [bounds.minX, bounds.maxX].every(x => [bounds.minZ, bounds.maxZ].every(z => Math.hypot(x, z) < 39.6));
}
