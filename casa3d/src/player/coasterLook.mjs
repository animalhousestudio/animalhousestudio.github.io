import { Euler, MathUtils, Quaternion } from 'three';

// Offset in the ride's local frame: hills and banking keep their orientation.
export function createCoasterLook() {
  let yaw=0,pitch=0;
  const rotation=new Quaternion(),euler=new Euler(0,0,0,'YXZ');
  return {
    get yaw(){return yaw;},get pitch(){return pitch;},
    reset(){yaw=0;pitch=0;},
    rotate(dx,dy){
      yaw=MathUtils.clamp(yaw-dx*.0032,-Math.PI/3,Math.PI/3);
      pitch=MathUtils.clamp(pitch-dy*.0032,-Math.PI/9,Math.PI/9);
    },
    apply(quaternion){return quaternion.multiply(rotation.setFromEuler(euler.set(pitch,yaw,0,'YXZ')));},
  };
}
