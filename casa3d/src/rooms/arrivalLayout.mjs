import { LANDING_Z } from '../arrival.mjs';
import { WORLD_SCALE } from './layout.mjs';

// Model-local coordinates; WORLD_SCALE converts these into gameplay metres.
export const ARRIVAL_PICKUP_ANCHOR = Object.freeze({
  x: -4 / WORLD_SCALE,
  z: LANDING_Z - 9 / WORLD_SCALE,
});
export const LOLLIPOP_BASKET_PLACEMENT = Object.freeze({ ...ARRIVAL_PICKUP_ANCHOR,
  yaw: Math.atan2(4, 9),
});
export const BEEHIVE_PLACEMENT = Object.freeze({
  x: ARRIVAL_PICKUP_ANCHOR.x,
  z: ARRIVAL_PICKUP_ANCHOR.z - 4 / WORLD_SCALE,
  height: 2.7 / WORLD_SCALE,
  yaw: Math.atan2(4, 9) + Math.PI / 6,
});

// Keep the existing dock fixed when the hive moves behind the new basket.
const approachLength = Math.hypot(4, 9);
export const JETPACK_PLACEMENT = Object.freeze({
  x: ARRIVAL_PICKUP_ANCHOR.x + 4 / approachLength * 2.7 / WORLD_SCALE,
  z: ARRIVAL_PICKUP_ANCHOR.z + 9 / approachLength * 2.7 / WORLD_SCALE,
  yaw: Math.atan2(4, 9),
});
