import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Group,Vector3,Texture} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createContactBoothRoot,boothReachable,boothContainsVisitor,contactBoothApproach,CONTACT_BOOTH} from '../src/rooms/contactBoothLayout.mjs';
import {captureCollisionSource} from '../src/player/collisionWorld.mjs';
import {experienceUrl,saveReturnState,takeReturnState,BOOTH_RETURN_KEY} from '../src/contact/navigation.mjs';
import {prepareBoothGlass,addBoothControls,BOOTH_CONTROL_LABELS} from '../src/rooms/contactBoothControls.mjs';
import {prepareContactBoothDoor} from '../src/rooms/contactBoothDoor.mjs';
import {CollisionWorld} from '../src/player/collisionWorld.mjs';

test('isolated routes preserve the deployed path and discard other scene requests',()=>{
  assert.equal(experienceUrl('https://example.com/casa3d/index.html?scene=greybox&review#abc','chamber').href,
    'https://example.com/casa3d/index.html?experience=chamber');
});
test('return restores once, rejects corrupt state and tolerates unavailable storage',()=>{
  const map=new Map();const storage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k),removeItem:k=>map.delete(k)};
  saveReturnState(storage,{position:[1,2,3],yaw:0,pitch:.1,lollipop:true});
  assert.equal(takeReturnState(storage).lollipop,true);assert.equal(takeReturnState(storage),null);
  map.set(BOOTH_RETURN_KEY,'{broken');assert.equal(takeReturnState(storage),null);
  saveReturnState(storage,{position:[1,2,Infinity],yaw:0,pitch:0});assert.equal(takeReturnState(storage),null);
  assert.doesNotThrow(()=>saveReturnState({setItem(){throw Error();}},{position:[]}));
});
test('booth entrance respects metre scale, front, range, blocking and line of sight',()=>{
  const world=new Group();world.scale.setScalar(5);const booth=createContactBoothRoot();world.add(booth);booth.userData.ready=true;
  world.updateMatrixWorld(true);
  assert.ok(booth.getWorldPosition(new Vector3()).distanceTo(new Vector3(CONTACT_BOOTH.x,0,CONTACT_BOOTH.z))<.01);
  const front=contactBoothApproach(booth);
  assert.equal(booth.getWorldScale(new Vector3()).x,2);
  assert.ok(Math.abs(front.y-2)<.01);
  assert.equal(boothReachable(booth,front),true);
  assert.equal(boothReachable(booth,front,true),false);
  assert.equal(boothReachable(booth,front,false,()=>false),false);
  assert.equal(boothReachable(booth,booth.localToWorld(new Vector3(0,2,-1.5))),false);
  assert.equal(boothReachable(booth,booth.localToWorld(new Vector3(0,2,6))),false);
});
test('real Blender asset has recorded hash and never supplies the player collision mesh',async()=>{
  const bytes=await readFile(new URL('../src/assets/models/props/contact-booth.glb',import.meta.url));
  const metadata=JSON.parse(await readFile(new URL('../art/contact-booth-v01/exterior-metadata.json',import.meta.url)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),metadata.sha256);
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  prepareBoothGlass(scene);
  let panes=0;
  scene.traverse(node=>{
    if(node.material?.name==='Review_GlassPlaceholder'){
      panes++;assert.equal(node.material.transparent,true);assert.equal(node.material.opacity,.1);
      assert.equal(node.material.depthWrite,false);assert.equal(node.castShadow,false);
    }
  });
  assert.ok(panes>=3);
  const booth=createContactBoothRoot(scene),source=captureCollisionSource(booth);
  assert.equal(source.length,4);assert.ok(source.every(x=>x.name.startsWith('ContactBooth_Physics_')));
  assert.ok(bytes.length<500000);
});
test('cabin interaction volume excludes sides, roof and the outdoor approach',()=>{
  const world=new Group();world.scale.setScalar(5);const booth=createContactBoothRoot();world.add(booth);
  booth.userData.ready=true;world.updateMatrixWorld(true);
  const point=(x,y,z)=>booth.localToWorld(new Vector3(x,y/CONTACT_BOOTH.scale,z));
  assert.equal(boothContainsVisitor(booth,point(0,2.32,.7)),true);
  assert.equal(boothContainsVisitor(booth,point(0,2.32,0)),true);
  assert.equal(boothContainsVisitor(booth,point(.75,2.32,.7)),false);
  assert.equal(boothContainsVisitor(booth,point(0,6,.7)),false);
  assert.equal(boothContainsVisitor(booth,point(0,2.32,-.8)),false);
  assert.equal(boothContainsVisitor(booth,contactBoothApproach(booth,1.5)),false);
});
test('both controls and concise labels are actual cabin geometry without changing collisions',()=>{
  const root=createContactBoothRoot();
  const controls=addBoothControls(root,{createLabelTexture:()=>new Texture()});
  assert.deepEqual(BOOTH_CONTROL_LABELS,['MESSAGGIO','SALA INFORMAZIONI']);
  assert.equal(controls.buttons.length,2);
  assert.ok(controls.buttons.every(button=>button.parent===controls.root&&button.children.some(child=>child.isMesh)));
  assert.equal(controls.root.parent,root);
  assert.ok(controls.buttons.every(button=>button.position.z>-.65));
  assert.equal(captureCollisionSource(root).length,4);
});
test('the authored door starts closed and its dynamic collider opens with the hinge',async()=>{
  const bytes=await readFile(new URL('../src/assets/models/props/contact-booth.glb',import.meta.url));
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  assert.ok(Math.abs(scene.getObjectByName('Review_DoorHinge').rotation.y)<.001);
  const world=new Group();world.scale.setScalar(5);
  const root=createContactBoothRoot(scene);world.add(root);
  const door=prepareContactBoothDoor(scene);root.userData.ready=true;world.updateMatrixWorld(true);
  const collisions=new CollisionWorld();collisions.addDynamicRoot(door.pivot,{filter:node=>node.userData.boothDoorPhysics===true});collisions.build();
  const from=root.localToWorld(new Vector3(0,1,1.4)),to=root.localToWorld(new Vector3(0,1,0));
  assert.equal(door.isOpen,false);assert.equal(door.passable,false);
  assert.equal(collisions.hasLineOfSight(from,to),false);
  door.open();for(let i=0;i<120;i++)door.update(1/60);
  assert.equal(door.passable,true);assert.equal(collisions.hasLineOfSight(from,to),true);
  assert.equal(captureCollisionSource(root).length,4);
  door.update(1/60,{root,eye:to,inside:true});
  door.update(1/60,{root,eye:from,inside:false});
  assert.equal(door.isOpen,true,'do not close while the visitor is in the swing area');
  const outside=root.localToWorld(new Vector3(0,1,2.4));
  for(let i=0;i<120;i++)door.update(1/60,{root,eye:outside,inside:false});
  assert.equal(door.isOpen,false);assert.equal(door.passable,false);
  assert.equal(collisions.hasLineOfSight(from,to),false);
  door.open({immediate:true});door.update(1/60,{root,eye:outside,inside:false});
  assert.equal(door.isOpen,true,'opening from outside waits for a real visit before auto-closing');
});
