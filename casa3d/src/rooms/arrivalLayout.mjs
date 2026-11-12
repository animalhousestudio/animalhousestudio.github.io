import { LANDING_Z } from '../arrival.mjs';
import { WORLD_SCALE } from './layout.mjs';

// Model-local coordinates; WORLD_SCALE converts these into gameplay metres.
const pickupLeft = 10;
const pickupForward = 12.5;
const pickupYaw = Math.atan2(pickupLeft, pickupForward);
const jetpackAnchor = {
  x: -pickupLeft / WORLD_SCALE,
  z: LANDING_Z - pickupForward / WORLD_SCALE,
};
// Fixed clearings selected across four sectors of the asteroid.
export const LOLLIPOP_BASKET_PLACEMENT = Object.freeze({
  x: 40 / WORLD_SCALE, z: -90 / WORLD_SCALE, yaw: .6,
});
export const BEEHIVE_PLACEMENT = Object.freeze({
  x: 70 / WORLD_SCALE, z: 80 / WORLD_SCALE,
  height: 2.7 / WORLD_SCALE,
  yaw: -.65,
});

export const JETPACK_PLACEMENT = Object.freeze({
  x: jetpackAnchor.x + Math.sin(pickupYaw) * 2.7 / WORLD_SCALE,
  z: jetpackAnchor.z + Math.cos(pickupYaw) * 2.7 / WORLD_SCALE,
  yaw: pickupYaw,
});
export const MUG_PLACEMENT = Object.freeze({
  x: -75 / WORLD_SCALE, z: -100 / WORLD_SCALE,
});

const scatteredPickups = [LOLLIPOP_BASKET_PLACEMENT,BEEHIVE_PLACEMENT,MUG_PLACEMENT];
export function scatteredPickupClearing(x,z) {
  return scatteredPickups.some(point => Math.hypot(point.x-x,point.z-z) < .65);
}

const monolithLeft = 3.1;
const monolithForward = 8.8;
export const MUSIC_MONOLITH_PLACEMENT = Object.freeze({
  x: -monolithLeft / WORLD_SCALE,
  z: LANDING_Z - monolithForward / WORLD_SCALE,
  yaw: Math.atan2(monolithLeft, monolithForward),
});
