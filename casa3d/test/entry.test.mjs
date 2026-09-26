import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Group, PerspectiveCamera, Vector3, Raycaster, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareEntryDoor, prepareEntrySteps, entryHeightAt, ENTRY_STEPS } from '../src/rooms/entry.mjs';
import { CollisionWorld, captureCollisionSource } from '../src/player/collisionWorld.mjs';
import { batchStaticArchitecture, instanceStaticMeshes } from '../src/rooms/optimize.mjs';
import { Player } from '../src/player/movement.js';
import { BASE_HOUSE_X, BASE_HOUSE_Z, HOUSE_X, HOUSE_Z, FLOOR_Y, WORLD_SCALE as S, EYE_HEIGHT as E } from '../src/rooms/layout.mjs';

async function entrance() {
  const bytes = await readFile(new URL('../src/assets/models/mansion-v09.glb', import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
  const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.position.set(BASE_HOUSE_X, 0, BASE_HOUSE_Z);
  const stairBytes = await readFile(new URL('../src/assets/models/entry-stairs.glb', import.meta.url));
  const stairModel = await new GLTFLoader().parseAsync(stairBytes.buffer.slice(stairBytes.byteOffset, stairBytes.byteOffset + stairBytes.byteLength), '');
  prepareEntrySteps(scene, stairModel.scene);
  const door = prepareEntryDoor(scene);
  const source = captureCollisionSource(scene);
  instanceStaticMeshes(scene); batchStaticArchitecture(scene);
  const world = new Group(); world.scale.setScalar(S); world.add(scene); world.updateMatrixWorld(true);
  const collisions = new CollisionWorld().addSource(source, scene.matrixWorld).build();
  for (const pivot of door.pivots) collisions.addDynamicRoot(pivot, { filter: node => /WalnutLeaf/.test(node.name) });
  return { door, world, scene, collisions };
}

test('authored open doors become closed movable leaves and respond only near the entrance', async () => {
  const { door, world } = await entrance();
  assert.equal(door.pivots.length, 2);
  for (const pivot of door.pivots) {
    assert.ok(pivot.children.length > 10); assert.equal(pivot.rotation.y, 0);
    const leaf = pivot.children.find(n => n.name.includes('WalnutLeaf'));
    const size = new Box3().setFromObject(leaf).getSize(new Vector3());
    assert.ok(Math.abs(size.x - .96 * S) < .001);
    assert.ok(size.z < .241 * S);
  }
  const near = new Vector3(HOUSE_X - .98 * S, FLOOR_Y[1] + E, HOUSE_Z + 7.2 * S);
  const before = near.clone(); before.z = HOUSE_Z + 6.55 * S;
  const after = near.clone(); after.z = HOUSE_Z + 6.15 * S;
  assert.equal(door.blocked(before, after, .35), true);
  for (let i = 0; i < 120; i++) door.update(new Vector3(0, E, 150), 1/60);
  assert.equal(door.pivots[0].rotation.y, 0);
  for (let i = 0; i < 120; i++) door.update(near, 1/60);
  assert.ok(door.pivots[0].rotation.y > 1.7); assert.equal(door.blocked(before, after, .35), false);
  world.updateMatrixWorld(true);
  for (let i = 0; i < 120; i++) door.update(new Vector3(0, E, 150), 1/60);
  assert.ok(door.pivots[0].rotation.y < .001);
});

for (const [speed, dt] of [[7.6, 1/60], [11.4, 1/30], [11.4, 1/20]]) {
  test(`entrance supports ascent, doorway, stopping and descent at ${speed} m/s and ${Math.round(1/dt)} FPS`, async () => {
    const { door, collisions } = await entrance();
    for (const offset of [-.55, 0, .55]) {
      const player = new Player(new PerspectiveCamera(), null, { speed, gravity:-6,
        groundHeightAt:(x,z,feet) => entryHeightAt(x,z,feet) ?? 0 });
      const x = HOUSE_X + (-.98 + offset) * S;
      player.setPosition(new Vector3(x, E, HOUSE_Z + (ENTRY_STEPS.front + 1) * S)); player.yaw = Math.PI; player.setMoveState({ forward:true });
      for (let i = 0; i < Math.ceil(45/speed/dt); i++) {
        door.update(player.camera.position, dt); player.update(dt, collisions);
        if (player.camera.position.z < HOUSE_Z + 6.7*S) assert.ok(player.camera.position.y >= FLOOR_Y[1]+E-.06);
      }
      player.setMoveState({forward:false}); for(let i=0;i<30;i++) player.update(dt,collisions);
      assert.ok(player.camera.position.z < HOUSE_Z + 5.3*S, 'crossed the threshold into the room');
      assert.ok(Math.abs(player.camera.position.y - E - FLOOR_Y[1]) < .01, 'standing on living-room floor');
      player.yaw = 0; player.setMoveState({forward:true});
      for(let i=0;i<Math.ceil(50/speed/dt);i++) { door.update(player.camera.position,dt);player.update(dt,collisions); }
      player.setMoveState({forward:false}); for(let i=0;i<60;i++)player.update(dt,collisions);
      assert.ok(player.camera.position.z > HOUSE_Z+8.3*S); assert.ok(Math.abs(player.camera.position.y-E)<.01);
    }
  });
}

test('entrance support never teleports a basement visitor upstairs', () => {
  assert.equal(entryHeightAt(HOUSE_X - .98*S, HOUSE_Z + 6*S, FLOOR_Y[0]), null);
});

test('walkable support follows the actual human-height treads', async () => {
  const {scene} = await entrance();
  const steps = scene.getObjectByName('AuthoredEntrySteps');
  assert.ok(steps);
  const {front,back,count,top} = ENTRY_STEPS;
  assert.ok(top*S/count < .20);
  assert.ok((front-back)*S/count >= .39);
  const ray = new Raycaster();
  for(let i=0;i<count;i++) {
    const height=top*(i+1)/count*S, z=HOUSE_Z+(front-(i+.5)*(front-back)/count)*S;
    assert.ok(Math.abs(entryHeightAt(HOUSE_X-.98*S,z,height)-height)<1e-6);
    ray.set(new Vector3(HOUSE_X-.98*S, 20, z), new Vector3(0,-1,0));
    const hits = ray.intersectObject(steps, true);
    assert.ok(hits.length, `tread ${i} exists in exported Blender model`);
    assert.ok(Math.abs(hits[0].point.y-height)<1e-5, `tread ${i} mesh matches support`);
  }
  for (const z of [6.3, 6.89, 7.2, 7.49]) {
    ray.set(new Vector3(HOUSE_X-.98*S,20,HOUSE_Z+z*S),new Vector3(0,-1,0));
    assert.ok(Math.abs(ray.intersectObject(steps,true)[0].point.y-top*S)<1e-5, 'landing overlaps threshold');
  }
});
