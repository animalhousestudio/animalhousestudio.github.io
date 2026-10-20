import { createPondSwimming } from './pondSwimming.mjs';
import { COASTER_TUNNEL } from '../rooms/coasterLayout.mjs';
import { WORLD_SCALE } from '../rooms/layout.mjs';
import { getPondOutline } from '../rooms/pondLayout.mjs';

export function connectedPondVolume(layouts) {
  const t = COASTER_TUNNEL, left=(t.x-t.halfWidth+.3)/WORLD_SCALE, right=(t.x+t.halfWidth-.3)/WORLD_SCALE;
  const inTunnel=(x,z)=>x>=left&&x<=right&&z>=t.startZ/WORLD_SCALE&&z<=t.endZ/WORLD_SCALE;
  const pondAt=(x,z)=>layouts.find(layout=>layout.contains(x,z));
  const points=layouts.flatMap(layout=>getPondOutline(layout));
  const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
  const minZ=Math.min(...points.map(p=>p[1])),maxZ=Math.max(...points.map(p=>p[1]));
  const waterY=layouts[0].waterY;
  return {
    waterY,
    outline:[[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]],
    floorAt(x,z) {return inTunnel(x,z)?t.floor/WORLD_SCALE:pondAt(x,z)?.floorAt(x,z)??null;},
    ceilingAt(x,z) {return inTunnel(x,z)?t.ceiling/WORLD_SCALE:pondAt(x,z)?waterY+.1:null;},
  };
}
export function createConnectedPondSwimming(layouts) {
  const volume=connectedPondVolume(layouts);
  return createPondSwimming(volume,{worldScale:WORLD_SCALE,outline:volume.outline});
}
