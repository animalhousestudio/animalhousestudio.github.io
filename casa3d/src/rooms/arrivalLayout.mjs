import { LANDING_Z } from '../arrival.mjs';
import { WORLD_SCALE } from './layout.mjs';

// Model-local coordinates; WORLD_SCALE converts these into gameplay metres.
const pickupLeft = 10;
const pickupForward = 12.5;
const pickupYaw = Math.atan2(pickupLeft, pickupForward);
export const ARRIVAL_PICKUP_ANCHOR = Object.freeze({
  x: -pickupLeft / WORLD_SCALE,
  z: LANDING_Z - pickupForward / WORLD_SCALE,
});
export const LOLLIPOP_BASKET_PLACEMENT = Object.freeze({
  ...ARRIVAL_PICKUP_ANCHOR, yaw: pickupYaw,
});
export const BEEHIVE_PLACEMENT = Object.freeze({
  x: ARRIVAL_PICKUP_ANCHOR.x,
  z: ARRIVAL_PICKUP_ANCHOR.z - 4 / WORLD_SCALE,
  height: 2.7 / WORLD_SCALE,
  yaw: pickupYaw + Math.PI / 6,
});

// Keep the dock 2.7 m in front of the basket along the approach from landing.
export const JETPACK_PLACEMENT = Object.freeze({
  x: ARRIVAL_PICKUP_ANCHOR.x + Math.sin(pickupYaw) * 2.7 / WORLD_SCALE,
  z: ARRIVAL_PICKUP_ANCHOR.z + Math.cos(pickupYaw) * 2.7 / WORLD_SCALE,
  yaw: pickupYaw,
});
export const MUG_PLACEMENT = Object.freeze({
  x: ARRIVAL_PICKUP_ANCHOR.x - 1.8 / WORLD_SCALE,
  z: ARRIVAL_PICKUP_ANCHOR.z + 1.5 / WORLD_SCALE,
});

const monolithLeft = 3.1;
const monolithForward = 8.8;
export const MUSIC_MONOLITH_PLACEMENT = Object.freeze({
  x: -monolithLeft / WORLD_SCALE,
  z: LANDING_Z - monolithForward / WORLD_SCALE,
  yaw: Math.atan2(monolithLeft, monolithForward),
});
