import { LANDING_Z } from '../arrival.mjs';
import { WORLD_SCALE } from './layout.mjs';

// Model-local coordinates; WORLD_SCALE converts these into gameplay metres.
export const BEEHIVE_PLACEMENT = Object.freeze({
  x: -4 / WORLD_SCALE,
  z: LANDING_Z - 9 / WORLD_SCALE,
  height: 2.7 / WORLD_SCALE,
  yaw: Math.atan2(4, 9) + Math.PI / 6,
});

// In front of the hive, 2.7 metres toward the landing, just left of the path.
const approachLength = Math.hypot(4, 9);
export const JETPACK_PLACEMENT = Object.freeze({
  x: BEEHIVE_PLACEMENT.x + 4 / approachLength * 2.7 / WORLD_SCALE,
  z: BEEHIVE_PLACEMENT.z + 9 / approachLength * 2.7 / WORLD_SCALE,
  yaw: Math.atan2(4, 9),
});
