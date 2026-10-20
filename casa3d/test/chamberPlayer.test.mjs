import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshBasicMaterial,PerspectiveCamera} from 'three';
import {createChamberPlayer} from '../src/contact/chamberPlayer.mjs';

function room(){
 const root=new Group();
 for(const [size,pos] of [[[8.2,.16,8.2],[0,-.08,0]],[[8.2,3.5,.16],[0,1.75,-4]],[[8.2,3.5,.16],[0,1.75,4]],[[.16,3.5,8.2],[-4,1.75,0]],[[.16,3.5,8.2],[4,1.75,0]]]){
  const mesh=new Mesh(new BoxGeometry(...size),new MeshBasicMaterial());mesh.position.set(...pos);root.add(mesh);
 }
 return root;
}
test('room walks and runs with the same player speed, eye height and collision response as the world',()=>{
 const walk=createChamberPlayer(new PerspectiveCamera(),room());
 const run=createChamberPlayer(new PerspectiveCamera(),room());
 walk.player.setMoveState({forward:true});run.player.setMoveState({forward:true,run:true});
 const start=walk.player.getPosition().z;
 for(let i=0;i<6;i++){walk.player.update(1/60,walk.colliders);run.player.update(1/60,run.colliders);}
 assert.ok(Math.abs(start-walk.player.getPosition().z-.76)<.001);
 assert.ok(Math.abs((start-run.player.getPosition().z)/(start-walk.player.getPosition().z)-1.5)<.001);
 for(let i=0;i<180;i++)walk.player.update(1/60,walk.colliders);
 assert.ok(walk.player.getPosition().z>=-3.58);
 assert.ok(Math.abs(walk.player.getPosition().y-2)<.001);
 assert.equal(walk.player.camera.fov,75);
});
