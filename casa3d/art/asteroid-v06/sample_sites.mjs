import { readFileSync } from 'node:fs';
import { insideHouse } from '../../src/rooms/asteroid.mjs';
import { reservedGround } from '../../src/rooms/landscapeLayout.mjs';
import { LANDING_Z } from '../../src/arrival.mjs';
import { stageFootprintContains, STAGE_PLACEMENT } from '../../src/rooms/stageLayout.mjs';
import { lynxTempleFootprintContains } from '../../src/rooms/lynxTempleLayout.mjs';
import { contactBoothClearing } from '../../src/rooms/contactBoothLayout.mjs';
import { scatteredPickupClearing } from '../../src/rooms/arrivalLayout.mjs';
import { PITCH_CLEARANCE } from '../../src/rooms/rockLayout.mjs';
import { propPlacements, terrainHeight } from '../../src/rooms/terrainDetail.mjs';

const pitch = PITCH_CLEARANCE;
const points = JSON.parse(readFileSync(0,'utf8'));
const heights = points.map(([x,z,radius]) => {
  const clear = (a,b) => !insideHouse(a,b) && !reservedGround(a,b,.45)
    && !stageFootprintContains(a,b,9) && !lynxTempleFootprintContains(a,b,4)
    && !contactBoothClearing(a,b) && !scatteredPickupClearing(a,b)
    && !(a>pitch.minX-.7 && a<pitch.maxX+.7 && b>pitch.minZ-.7 && b<pitch.maxZ+.7)
    && Math.hypot(a,b-LANDING_Z)>5.7
    && Math.hypot(a-STAGE_PLACEMENT.x-3,b-STAGE_PLACEMENT.z+2)>5.5
    && propPlacements.every(prop=>Math.hypot(a-prop.x,b-prop.z)>(prop.name==='CrashedUFO' ? 3.7 : 1.4));
  if (![[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]]
    .every(([dx,dz])=>clear(x+dx,z+dz))) return null;
  return terrainHeight(x,z);
});
process.stdout.write(JSON.stringify(heights));
