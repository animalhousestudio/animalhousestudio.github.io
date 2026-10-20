import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnimationMixer, Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { createLollipopEquipment } from '../src/player/lollipopEquipment.mjs';
import { createLollipopPickup, LOLLIPOP_REACH_METRES } from '../src/player/lollipopPickup.mjs';
import { createTapGesture } from '../src/player/tapGesture.mjs';
import { CollisionWorld } from '../src/player/collisionWorld.mjs';
import { createCoasterPaws } from '../src/player/coasterPaws.mjs';

const bytes = await readFile(new URL('../src/assets/models/player-bear.glb', import.meta.url));
const loader = new GLTFLoader();
loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
const bear = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');

function model() { return cloneSkeleton(bear.scene); }
function propNodes(root) {
  const nodes = [];
  root.traverse(node => { if (/^(ATTACH_L_Lollipop_Grip|PROP_L_Lollipop_)/.test(node.name)) nodes.push(node); });
  return nodes;
}
function pose(root) {
  root.updateMatrixWorld(true);
  const nodes = [];
  root.traverse(node => nodes.push({ name: node.name, parent: node.parent?.name, matrix: node.matrix.toArray() }));
  return nodes;
}

test('ride paws reach the lap bar with palms down and restore the original rig after dismount',()=>{
  const source=model(),body=new Group();body.add(source);body.rotation.set(.25,.8,-.2);body.position.set(15,30,-20);
  const before=pose(source),paws=createCoasterPaws(source);paws.apply(body);
  for(const [side,sign]of [['L',1],['R',-1]]){
    const hand=source.getObjectByName('hand'+side),target=body.localToWorld(new Vector3(sign*.34,1.67,.64));
    assert.ok(hand.getWorldPosition(new Vector3()).distanceTo(target)<.005);
    const palm=new Vector3(0,0,1).transformDirection(hand.matrixWorld);
    const down=new Vector3(0,-1,0).transformDirection(body.matrixWorld);
    assert.ok(palm.dot(down)>.999,'Palms point down even on a banked curve');
  }
  paws.reset();assert.deepEqual(pose(source),before);
});

test('the same inventory and pickup collect the right-hand mug and hide it only during a ride',()=>{
  const root=model(),before=pose(root),mugNodes=[];
  const equipment=createLollipopEquipment({matches:node=>node.name==='ATTACH_R_Mug_Grip'||node.name.startsWith('PROP_R_Mug_')});
  root.traverse(node=>{if(node.name==='ATTACH_R_Mug_Grip'||node.name.startsWith('PROP_R_Mug_'))mugNodes.push(node);});
  assert.equal(mugNodes.length,5);equipment.attach(root);assert.ok(mugNodes.every(node=>!node.visible));
  const ground=new Group();ground.userData.ready=true;
  const eye=new Vector3(0,2,1),pickup=createLollipopPickup({equipment,getBasket:()=>ground,getEye:()=>eye,isBlocked:()=>false,targetHeight:.2});
  assert.equal(pickup.collect(),true);assert.ok(mugNodes.every(node=>node.visible));
  equipment.setSuppressed(true);assert.equal(equipment.equipped,true);assert.ok(mugNodes.every(node=>!node.visible));
  equipment.setSuppressed(false);assert.ok(mugNodes.every(node=>node.visible));
  assert.deepEqual(pose(root),before);assert.equal(pickup.collect(),false);
});

test('arrival starts without a held lollipop and collecting restores the authored hand prop without moving the bear', () => {
  const root = model(), equipment = createLollipopEquipment();
  const props = propNodes(root), rest = [];
  root.traverse(node => { if (!props.includes(node)) rest.push([node, node.visible]); });
  assert.equal(props.length, 5, 'The actual bear has one attachment and four lollipop pieces');
  const before = pose(root);
  assert.equal(equipment.equipped, false);
  equipment.attach(root);
  assert.ok(props.every(node => node.visible === false), 'Every candy, stick and logo is hidden before collection');
  assert.equal(equipment.collect(), true);
  assert.equal(equipment.equipped, true);
  assert.ok(props.every(node => node.visible === true), 'Complete original prop is restored');
  assert.deepEqual(pose(root), before, 'Authored grip, body and hand transforms stay unchanged');
  assert.ok(rest.every(([node, visible]) => node.visible === visible), 'Head, paws, mug and body visibility are untouched');
  assert.equal(equipment.collect(), false, 'Repeated clicks, E and touch cannot collect twice');
  assert.deepEqual(pose(root), before);
});

test('late bear loading applies current equipment state, including collection before attachment', async () => {
  for (const collectedBeforeLoad of [false, true]) {
    const equipment = createLollipopEquipment();
    let finishLoad;
    const loaded = new Promise(resolve => { finishLoad = resolve; });
    const ready = loaded.then(root => { equipment.attach(root); return root; });
    assert.equal(equipment.equipped, false);
    if (collectedBeforeLoad) assert.equal(equipment.collect(), true);
    finishLoad(model());
    const root = await ready;
    assert.ok(propNodes(root).every(node => node.visible === collectedBeforeLoad), 'Async attachment respects the state already selected');
    if (!collectedBeforeLoad) equipment.collect();
    const replacement = model(); equipment.attach(replacement);
    assert.ok(propNodes(replacement).every(node => node.visible), 'A subsequently attached body retains the collected item');
  }
});

test('collection preserves the active authored idle pose and continues its animation', () => {
  const root = model(), equipment = createLollipopEquipment(), mixer = new AnimationMixer(root);
  const idle = bear.animations.find(clip => clip.name.includes('Idle_Hold'));
  assert.ok(idle, 'The existing hand pose is supplied by the bear asset');
  mixer.clipAction(idle).play(); mixer.update(.35);
  equipment.attach(root); mixer.update(.2);
  const before = pose(root);
  equipment.collect();
  assert.deepEqual(pose(root), before, 'Collection only reveals the existing grip');
  const previousTime = mixer.time; mixer.update(.1);
  assert.ok(mixer.time > previousTime && mixer.clipAction(idle).isRunning());
});

function pickupFixture() {
  const basket = new Group(); basket.userData.ready = true;
  const eye = new Vector3(0, 2, 2), equipment = createLollipopEquipment();
  let blocked = false, visible = true;
  const pickup = createLollipopPickup({ equipment, getBasket: () => basket, getEye: () => eye,
    isBlocked: () => blocked, hasLineOfSight: () => visible });
  return { basket, eye, equipment, pickup, setBlocked: value => { blocked = value; }, setLineOfSight: value => { visible = value; } };
}

test('pickup requires a ready visible basket, local reach, clear sight and unblocked gameplay', () => {
  const fixture = pickupFixture(), { basket, eye, equipment, pickup } = fixture;
  assert.equal(LOLLIPOP_REACH_METRES, 3);
  assert.equal(pickup.available(), true);
  const reject = () => { assert.equal(pickup.available(), false); assert.equal(pickup.collect(), false); assert.equal(equipment.equipped, false); };
  basket.userData.ready = false; reject(); basket.userData.ready = true;
  basket.visible = false; reject(); basket.visible = true;
  const parent = new Group(); parent.add(basket); parent.visible = false; reject(); parent.visible = true;
  fixture.setBlocked(true); reject(); fixture.setBlocked(false);
  fixture.setLineOfSight(false); reject(); fixture.setLineOfSight(true);
  eye.set(0, .9, LOLLIPOP_REACH_METRES + .01); reject();
  eye.z = LOLLIPOP_REACH_METRES - .01;
  assert.equal(pickup.available(), true, 'Reach is measured in world metres');
  const before = eye.clone(), transform = basket.matrix.clone();
  assert.equal(pickup.collect(), true);
  assert.equal(equipment.equipped, true);
  assert.equal(pickup.collect(), false); assert.equal(pickup.available(), false);
  assert.ok(eye.equals(before) && basket.matrix.equals(transform), 'Collection does not move the camera or basket');
  assert.equal(basket.visible, true, 'The basket remains in the scene');
});

test('pickup hit points use actual world distance and an absent basket cannot be collected', () => {
  const { pickup, eye } = pickupFixture();
  assert.equal(pickup.available(eye.clone().add(new Vector3(0, 0, 3.1))), false);
  assert.equal(pickup.available(new Vector3(0, .9, 0)), true);
  const missing = createLollipopPickup({ equipment: createLollipopEquipment(), getBasket: () => null,
    getEye: () => eye, isBlocked: () => false });
  assert.equal(missing.available(), false); assert.equal(missing.collect(), false);
});

test('pickup cannot pass through real collision triangles and a clear approach succeeds', () => {
  const wall = new Box3(new Vector3(-1, 0, .9), new Vector3(1, 3, 1.1));
  const collisions = CollisionWorld.fromBoxes([wall]), eye = new Vector3(0, 2, 2);
  const basket = new Group(); basket.userData.ready = true;
  const target = new Vector3(0, .9, 0), equipment = createLollipopEquipment();
  const pickup = createLollipopPickup({ equipment, getBasket: () => basket, getEye: () => eye,
    isBlocked: () => false, hasLineOfSight: (from, to) => collisions.hasLineOfSight(from, to) });
  assert.equal(collisions.hasLineOfSight(eye, target), false, 'Opaque front face blocks sight');
  assert.equal(collisions.hasLineOfSight(target, eye), false, 'The same wall blocks its back face');
  assert.equal(pickup.collect(), false);
  eye.set(0, 2, -.8);
  assert.equal(pickup.available(), true); assert.equal(pickup.collect(), true);
});

test('pickup sight follows moving doors and stays blocked when their render branch is hidden', () => {
  const door = new Mesh(new BoxGeometry(2, 3, .15), new MeshBasicMaterial());
  door.position.set(0, 1.5, 1);
  const collisions = new CollisionWorld().addDynamicRoot(door).build();
  const eye = new Vector3(0, 2, 2), target = new Vector3(0, .9, 0);
  assert.equal(collisions.hasLineOfSight(eye, target), false);
  door.visible = false;
  assert.equal(collisions.hasLineOfSight(eye, target), false, 'Visibility never removes an occluding collider');
  door.position.x = 3;
  assert.equal(collisions.hasLineOfSight(eye, target), true, 'An open door no longer blocks pickup sight');
  door.position.x = 0;
  assert.equal(collisions.hasLineOfSight(eye, target), false, 'Closing the door restores occlusion');
});

const pointer = (changes = {}) => ({ pointerId: 1, pointerType: 'touch', button: 0, isPrimary: true,
  clientX: 100, clientY: 100, ...changes });

test('mouse click and one-finger tap emit exactly one interaction while secondary buttons do not', () => {
  for (const pointerType of ['mouse', 'touch', 'pen']) {
    const gesture = createTapGesture();
    gesture.start(pointer({ pointerType }));
    assert.deepEqual(gesture.end(pointer({ pointerType, clientX: 102, clientY: 101 })), { x: 102, y: 101 });
    assert.equal(gesture.end(pointer({ pointerType })), null, 'Pointer-up is consumed once');
  }
  const gesture = createTapGesture();
  for (const button of [1, 2]) {
    gesture.start(pointer({ pointerType: 'mouse', button }));
    assert.equal(gesture.end(pointer({ pointerType: 'mouse', button })), null);
  }
});

test('look drags cannot become a tap even when the finger returns to its starting point', () => {
  const gesture = createTapGesture();
  gesture.start(pointer()); gesture.move(pointer({ clientX: 125 })); gesture.move(pointer());
  assert.equal(gesture.end(pointer()), null);
  gesture.start(pointer());
  assert.equal(gesture.end(pointer({ clientY: 125 })), null, 'Large displacement is rejected even without a move event');
});

test('multitouch, blocked gameplay, cancellation and mismatched pointers never collect an item', () => {
  const gesture = createTapGesture();
  gesture.start(pointer(), { otherPointers: 1 });
  assert.equal(gesture.end(pointer()), null, 'Movement-pad plus world tap is not a pickup');
  gesture.start(pointer()); gesture.start(pointer({ pointerId: 2, isPrimary: false }), { otherPointers: 1 });
  assert.equal(gesture.end(pointer()), null, 'Adding a second finger cancels the first candidate');
  gesture.start(pointer(), { blocked: true }); assert.equal(gesture.end(pointer()), null);
  gesture.start(pointer()); assert.equal(gesture.end(pointer(), { blocked: true }), null);
  gesture.start(pointer()); gesture.cancel(); assert.equal(gesture.end(pointer()), null);
  gesture.start(pointer()); assert.equal(gesture.end(pointer({ pointerId: 2 })), null);
});
