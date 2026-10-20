import { CatmullRomCurve3, Matrix4, Quaternion, Vector3, MathUtils, Box3 } from 'three';
import { EYE_HEIGHT } from './layout.mjs';

// Metres in gameplay space, independently of the mansion's 5x scale.
export const COASTER_DURATION = 105;
export const COASTER_STATION = Object.freeze({ x: 9, y: .8, z: 207 });
export const COASTER_TUNNEL = Object.freeze({ x: -120, floor: -13, ceiling: -4, halfWidth: 4.25, startZ: 19, endZ: 76 });
export const COASTER_POINTS = Object.freeze([
  [9,.8,207], [9,.8,199], [9,.8,191], [20,2,182], [40,6,174], [100,30,150], [135,95,60],
  [85,170,-80], [-65,155,-120], [-165,65,-40], [-260,100,20],
  [-310,180,170], [-110,235,300], [120,180,260], [145,75,155],
  [45,42,120], [-70,35,65], [-120,10,-3], [-120,2,10],
  [-120,-5,15], [-120,-10,19], [-120,-10,32], [-120,-10,63],
  [-120,-8,77], [-120,-2,85], [-118,5,90], [-85,18,120],
  [-25,10,175], [-15,10,250], [9,.8,238], [9,.8,230], [9,.8,222], [9,.8,214],
].map(point => Object.freeze(point)));

export function createCoasterRoute() {
  const curve = new CatmullRomCurve3(COASTER_POINTS.map(point => new Vector3(...point)), true, 'centripetal');
  curve.arcLengthDivisions = 6000; curve.updateArcLengths();
  const length = curve.getLength(), upAxis = new Vector3(0, 1, 0);
  function frameAt(u) {
    u = MathUtils.clamp(u, 0, 1);
    const position = curve.getPointAt(u), forward = curve.getTangentAt(u).normalize();
    const right = new Vector3().crossVectors(upAxis, forward).normalize();
    if (right.lengthSq() < .1) right.set(1, 0, 0);
    const up = new Vector3().crossVectors(forward, right).normalize();
    const before = curve.getTangentAt(MathUtils.euclideanModulo(u-.001,1)), after = curve.getTangentAt(MathUtils.euclideanModulo(u+.001,1));
    const bank = MathUtils.clamp(new Vector3().crossVectors(before, after).y * -5, -.32, .32);
    right.applyAxisAngle(forward, bank); up.applyAxisAngle(forward, bank);
    const quaternion = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, up, forward));
    const feet = position.clone().addScaledVector(up, .2);
    return { u, position, forward, right, up, quaternion, feet,
      eye: feet.clone().addScaledVector(up, EYE_HEIGHT), bank };
  }
  return { curve, length, frameAt };
}

export function createCoasterRide(route, { duration = COASTER_DURATION } = {}) {
  let elapsed = 0, active = false;
  return {
    get active() { return active; }, get progress() { return Math.min(1, elapsed / duration); },
    start() { if (active) return false; elapsed = 0; active = true; return true; },
    stop() { const wasActive = active; active = false; return wasActive; },
    sample(progress) {
      const p = MathUtils.clamp(progress, 0, 1), u = p * p * (3 - 2 * p);
      return { ...route.frameAt(u), progress: p, finished: p === 1 };
    },
    update(dt) {
      if (!active) return null;
      elapsed = Math.min(duration, elapsed + Math.max(0, Math.min(.1, dt)));
      return this.sample(elapsed / duration);
    },
  };
}

export function createCoasterSupports(route, heightAt) {
  const samples=Array.from({length:4001},(_,i)=>route.frameAt(i/4000));
  const placements=[];
  function add(position,size,quaternion=new Quaternion()){
    const bounds=new Box3().setFromCenterAndSize(new Vector3(),size).applyMatrix4(new Matrix4().compose(position,quaternion,new Vector3(1,1,1)));
    const {min,max}=bounds;
    // Check every passing section, including a lower track below another span.
    if(samples.some(({eye,feet})=>max.y>Math.min(feet.y,eye.y)-.5&&min.y<Math.max(feet.y,eye.y)+.8
      &&Math.hypot(Math.max(min.x-eye.x,0,eye.x-max.x),Math.max(min.z-eye.z,0,eye.z-max.z))<2.6))return;
    placements.push({position,size,quaternion});
  }
  for(let d=0;d<route.length;d+=13){
    const frame=route.frameAt(d/route.length),p=frame.position;
    if(p.y<2||p.y>145)continue;
    const side=new Vector3(frame.right.x,0,frame.right.z).normalize();
    for(const sign of [-1,1]){
      const base=p.clone().addScaledVector(side,sign*3),bottom=heightAt(base.x,base.z);
      if(bottom===null)continue;
      const top=p.y-.45,height=top-bottom;if(height<1)continue;
      add(new Vector3(base.x,bottom+height/2,base.z),new Vector3(.32,height,.32));
    }
    add(new Vector3(p.x,p.y-.6,p.z),new Vector3(6.3,.22,.32),
      new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.atan2(-side.z,side.x)));
  }
  return placements;
}

export function tunnelPortalBox(scale = 1) {
  const t = COASTER_TUNNEL;
  return new Box3(new Vector3(t.x - t.halfWidth - .1, t.floor - .3, t.startZ - 2).multiplyScalar(scale),
    new Vector3(t.x + t.halfWidth + .1, t.ceiling + .3, t.endZ + 2).multiplyScalar(scale));
}
