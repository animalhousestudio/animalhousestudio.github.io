import {Vector3} from 'three';
import {Player} from '../player/movement.js';
import {CollisionWorld} from '../player/collisionWorld.mjs';
import {EYE_HEIGHT} from '../rooms/layout.mjs';
import {WALKING_DEFAULTS} from '../player/walkingDefaults.mjs';

export function createChamberPlayer(camera,room){
  const spawn=new Vector3(0,EYE_HEIGHT,2.4);
  const player=new Player(camera,null,{...WALKING_DEFAULTS,respawnPosition:spawn,
    groundHeightAt:()=>0});
  const colliders=new CollisionWorld();colliders.addRoot(room);colliders.build();
  player.setPosition(spawn);player.yaw=Math.PI;player.updateCamera();
  camera.fov=75;camera.updateProjectionMatrix();
  return {player,colliders};
}
