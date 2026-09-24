import { WORLD_SCALE, BASE_FLOOR_Y } from './layout.mjs';
export const STAIR_OUTER_RADIUS = .64;
export const STAIR_TRAVEL_RADIUS = .43;
export const STAIR_OPENING_RADIUS = .72;
export const STAIR_START_ANGLE = Math.PI / 2;
// Architectural proportions: two generous turns per storey, independent of world scale.
export const STAIR_TURNS = BASE_FLOOR_Y.slice(1).map(()=>2);
