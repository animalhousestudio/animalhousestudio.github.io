import { readFileSync } from 'node:fs';
import { LANDING_Z } from '../../src/arrival.mjs';
import { BASE_HOUSE_X, BASE_HOUSE_Z, WORLD_SCALE } from '../../src/rooms/layout.mjs';
import { CONTACT_BOOTH } from '../../src/rooms/contactBoothLayout.mjs';
import { POND_FOOTPRINTS } from '../../src/rooms/pondLayout.mjs';
import { LYNX_TEMPLE_PLACEMENT } from '../../src/rooms/lynxTempleLayout.mjs';
import { PITCH_CLEARANCE } from '../../src/rooms/rockLayout.mjs';
import { STAGE_PLACEMENT, STAGE_YAW } from '../../src/rooms/stageLayout.mjs';
import { craters, propPlacements, baseTerrainHeight } from '../../src/rooms/terrainDetail.mjs';

const ufo = propPlacements.find(prop => prop.name === 'CrashedUFO');
const crater = craters.find(site => site.x === ufo.x && site.z === ufo.z);
const points = JSON.parse(readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify({
  ufo: { ...ufo, height: baseTerrainHeight(ufo.x, ufo.z) },
  crater,
  landing: [0, LANDING_Z],
  house: [BASE_HOUSE_X, BASE_HOUSE_Z],
  ponds: POND_FOOTPRINTS,
  pitch: PITCH_CLEARANCE,
  temple: LYNX_TEMPLE_PLACEMENT,
  booth: [CONTACT_BOOTH.x/WORLD_SCALE, CONTACT_BOOTH.z/WORLD_SCALE],
  stage: { ...STAGE_PLACEMENT, yaw: STAGE_YAW },
  heights: points.map(([x, z]) => baseTerrainHeight(x, z)),
}));
