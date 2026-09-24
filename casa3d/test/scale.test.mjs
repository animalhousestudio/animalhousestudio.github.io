import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Box3, PerspectiveCamera, Vector3 } from 'three';
import { createInterior } from '../src/rooms/interior.mjs';
import { createSpiralStairs } from '../src/rooms/compactStairs.mjs';
import { Player } from '../src/player/movement.js';
import { WORLD_SCALE, BASE_FLOOR_Y, FLOOR_Y, HOUSE_X, HOUSE_Z, EYE_HEIGHT, BASE_HOUSE_X, BASE_HOUSE_Z } from '../src/rooms/layout.mjs';

test('5x environment keeps all floor surfaces aligned and human eye height unchanged',()=>{
  const world=new Group();world.scale.setScalar(WORLD_SCALE);
  const rooms=FLOOR_Y.map((_,i)=>createInterior(i));world.add(...rooms);
  const stairs=createSpiralStairs();stairs.position.set(BASE_HOUSE_X,0,BASE_HOUSE_Z);world.add(stairs);world.updateMatrixWorld(true);
  for(let i=0;i<rooms.length;i++) {
    const floor=new Box3().setFromObject(rooms[i].getObjectByName('WalkingSurface'));
    assert.ok(Math.abs(floor.max.y-BASE_FLOOR_Y[i]*WORLD_SCALE)<1e-5);
    const player=new Player(new PerspectiveCamera(),null);
    player.setPosition(new Vector3(HOUSE_X+2,FLOOR_Y[i]+EYE_HEIGHT+.1,HOUSE_Z+7));
    for(let frame=0;frame<120;frame++)player.update(1/60,[floor]);
    assert.ok(Math.abs(player.camera.position.y-FLOOR_Y[i]-EYE_HEIGHT)<1e-5);
  }
  assert.equal(WORLD_SCALE,5);
  assert.equal(EYE_HEIGHT,1.65);
});
