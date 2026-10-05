import { WORLD_SCALE, BASE_HOUSE_X, BASE_HOUSE_Z, BASE_FLOOR_Y } from '../rooms/layout.mjs';
import { LANDING_Z } from '../arrival.mjs';
import { GARDEN } from '../rooms/landscapeLayout.mjs';
import { PITCH_PLACEMENT } from '../rooms/rockLayout.mjs';

export const WORLD_ZONE_IDS = Object.freeze({
  ARRIVAL: 'outdoor:arrival',
  GARDEN: 'outdoor:garden',
  SPORTS: 'outdoor:sports',
  ASTEROID: 'outdoor:asteroid',
  HOUSE_SHELL: 'house:shell',
  BASEMENT: 'house:basement',
  LIVING: 'house:living',
  KITCHEN: 'house:kitchen',
  GALLERY: 'house:gallery',
  OBSERVATORY: 'house:observatory',
});

// Anchors describe the authored world before its WORLD_SCALE transform (5×).
// They are navigation/loading hints, never visibility or collision boundaries.
// Runtime bounds come from registered objects after their final world placement.
const zone = (id, label, kind, anchor) => Object.freeze({
  id, label, kind, resident: true, coordinateSpace: 'model-local', worldScale: WORLD_SCALE,
  anchor: Object.freeze(anchor),
});
const floor = (id, label, index) => zone(id, label, 'house', [BASE_HOUSE_X, BASE_FLOOR_Y[index], BASE_HOUSE_Z]);

export const WORLD_ZONE_CATALOG = Object.freeze([
  zone(WORLD_ZONE_IDS.ARRIVAL, 'Arrivo', 'outdoor', [0, 0, LANDING_Z]),
  zone(WORLD_ZONE_IDS.GARDEN, 'Giardino', 'outdoor', [GARDEN.x, 0, GARDEN.z]),
  zone(WORLD_ZONE_IDS.SPORTS, 'Sport', 'outdoor', [PITCH_PLACEMENT.x, PITCH_PLACEMENT.y, PITCH_PLACEMENT.z]),
  zone(WORLD_ZONE_IDS.ASTEROID, 'Asteroide', 'outdoor', [0, 0, 0]),
  zone(WORLD_ZONE_IDS.HOUSE_SHELL, 'Struttura della casa', 'house', [BASE_HOUSE_X, 0, BASE_HOUSE_Z]),
  floor(WORLD_ZONE_IDS.BASEMENT, 'Cantina', 0),
  floor(WORLD_ZONE_IDS.LIVING, 'Salotto', 1),
  floor(WORLD_ZONE_IDS.KITCHEN, 'Cucina', 2),
  floor(WORLD_ZONE_IDS.GALLERY, 'Galleria', 3),
  floor(WORLD_ZONE_IDS.OBSERVATORY, 'Osservatorio', 4),
]);
