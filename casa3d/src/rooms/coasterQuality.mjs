import { MathUtils } from 'three';
import { HOUSE_X, HOUSE_Z } from './layout.mjs';

// Rendering only: collision geometry and the mansion's floors stay resident.
export function coasterVisualQuality(active,eye,groundY,target={}) {
  target.active=active;
  const dx=Math.max(0,Math.abs(eye.x-HOUSE_X)-82),dz=Math.max(0,Math.abs(eye.z-HOUSE_Z)-60);
  const nearHouse=eye.y<155&&Math.hypot(dx,dz)<95;
  const lakeApproach=Math.hypot(eye.x+120,eye.z-15)<60&&eye.y<65;
  target.maxDetail=active?(nearHouse||lakeApproach?0:1):Infinity;
  const clearance=groundY===null?Infinity:eye.y-groundY;
  // At most 3% of grass, only while close to the ground; none above 9 metres.
  target.grassDensity=active?(clearance>=0?.03*(1-MathUtils.smoothstep(clearance,3,9)):0):1;
  return target;
}

export function grassCellCount(fullCount,distance,radius,densityScale=1,nearOnly=false) {
  const localFade=nearOnly?1-MathUtils.smoothstep(Math.max(0,distance-radius),1.2,4):1;
  const density=densityScale*localFade*(1-.92*MathUtils.smoothstep(distance,12,37));
  return Math.max(nearOnly?0:1,Math.round(fullCount*density));
}
