// Measured walking surfaces in the refined Blender asset (Blender Z -> game Y).
export const WORLD_SCALE = 5;
export const BASE_HOUSE_X = 1.65;
export const BASE_HOUSE_Z = -0.57;
export const BASE_FLOOR_Y = [-6.6, 1.487, 9.912, 17.2, 25.72];
export const HOUSE_X = BASE_HOUSE_X * WORLD_SCALE;
export const HOUSE_Z = BASE_HOUSE_Z * WORLD_SCALE;
export const FLOOR_Y = BASE_FLOOR_Y.map(y => y * WORLD_SCALE);
export const FLOOR_NAMES = ['Cantina', 'Salotto', 'Primo piano', 'Galleria', 'Osservatorio'];
export const EYE_HEIGHT = 1.65;
export const ENTRY = { x: HOUSE_X - .98 * WORLD_SCALE, z: HOUSE_Z + 6.38 * WORLD_SCALE };
export function nearestFloor(eyeY) {
  return FLOOR_Y.reduce((best, y, i) => Math.abs(eyeY-EYE_HEIGHT-y)<Math.abs(eyeY-EYE_HEIGHT-FLOOR_Y[best]) ? i : best, 0);
}
