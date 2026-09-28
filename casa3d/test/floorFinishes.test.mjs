import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, MeshStandardMaterial, Raycaster, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyHouseFloorFinishes } from '../src/rooms/floorFinishes.mjs';
import { PARQUET_TILE_WORLD_SIZE } from '../src/rooms/parquetMaterial.mjs';
import { WORLD_SCALE } from '../src/rooms/layout.mjs';

async function loadHouse() {
  const bytes = await readFile(new URL('../src/assets/models/mansion-v10.glb', import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({name:'GeometryOnlyImages',loadTexture:async()=>new Texture()}));
  const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.updateMatrixWorld(true);
  return scene;
}

test('parquet replaces walking-face materials without adding geometry or painting ceilings', async () => {
  const house = await loadHouse(), original = new Map(), parquet = new MeshStandardMaterial();
  house.traverse(n => { if (n.isMesh) original.set(n.name, {geometry:n.geometry,material:n.material}); });
  const stats = applyHouseFloorFinishes(house, parquet);
  for (const name of ['M01_Reuse_INT_Slab_Living', 'M01_Reuse_INT_Slab_Kitchen', 'M01_UpperFloor_Slab',
    'M01_Conservatory_Plinth', 'M01_Reuse_AVIARY_Left_Floor', 'M03_Tower_Floor',
    'M04_WestTurret_M03_Tower_Floor002', 'M04_WestPassage_Assembly001', 'M06_EastBridge_Threshold']) {
    assert.ok(stats.surfaces.includes(name), `Missing walking surface ${name}`);
  }
  for (const name of stats.surfaces) {
    const node = house.getObjectByName(name), before = original.get(name).geometry;
    assert.deepEqual(node.geometry.attributes.position.array, before.attributes.position.array, `${name}: floor moved`);
    assert.equal(node.geometry.index.count, before.index?.count ?? before.attributes.position.count, `${name}: triangle count changed`);
    assert.ok(node.material.includes(parquet));
    assert.equal(node.geometry.groups.reduce((sum,g)=>sum+g.count,0),node.geometry.index.count);
  }
  for (const name of ['M06_Observatory_InteriorFloor', 'M01_UpperFloor_Ceiling', 'M10_Lift_BoardingBridge_00',
    'M10_Lift_BoardingBridge_04', 'M04_WestPassage_Assembly001_1', 'M04_WestPassage_Assembly001_2']) {
    const node = house.getObjectByName(name), before = original.get(name);
    assert.ok(node && before, `Missing exclusion fixture ${name}`);
    assert.equal(node.geometry,before.geometry,`${name}: excluded geometry changed`);
    assert.equal(node.material,before.material,`${name}: excluded material changed`);
  }
});

test('living-room floor keeps its lift aperture and original underside', async () => {
  const house = await loadHouse(), parquet = new MeshStandardMaterial();
  applyHouseFloorFinishes(house, parquet);
  const slab = house.getObjectByName('M01_Reuse_INT_Slab_Living');
  const down = new Raycaster(new Vector3(2,2,2),new Vector3(0,-1,0),0,1);
  const top = down.intersectObject(slab)[0];
  assert.ok(top);
  assert.equal(slab.material[top.face.materialIndex],parquet);
  const up = new Raycaster(new Vector3(2,1,2),new Vector3(0,1,0),0,1);
  const bottom = up.intersectObject(slab)[0];
  assert.ok(bottom);
  assert.notEqual(slab.material[bottom.face.materialIndex],parquet);
  for (const [x,z] of [[0,0],[.15,0],[0,.15],[-.15,0]]) {
    down.ray.origin.set(x,2,z);
    assert.equal(down.intersectObject(slab).length,0,'Parquet sealed the lift aperture');
  }
});

test('different turret transforms retain the same real-world plank scale', async () => {
  const house = await loadHouse();
  applyHouseFloorFinishes(house,new MeshStandardMaterial());
  for (const name of ['M03_Tower_Floor','M04_WestTurret_M03_Tower_Floor']) {
    const node = house.getObjectByName(name), geometry=node.geometry;
    const point=new Vector3();
    for (let i=0;i<geometry.attributes.position.count;i++) {
      point.fromBufferAttribute(geometry.attributes.position,i).applyMatrix4(node.matrixWorld);
      assert.ok(Math.abs(geometry.attributes.uv.getX(i)*PARQUET_TILE_WORLD_SIZE-point.x*WORLD_SCALE)<.00002);
      assert.ok(Math.abs(geometry.attributes.uv.getY(i)*PARQUET_TILE_WORLD_SIZE-point.z*WORLD_SCALE)<.00002);
    }
  }
});

test('mixed west passage receives parquet on its deck, leaving roof and rail tops alone', async () => {
  const house=await loadHouse(),parquet=new MeshStandardMaterial();
  applyHouseFloorFinishes(house,parquet);
  const node=house.getObjectByName('M04_WestPassage_Assembly001'),g=node.geometry,p=new Vector3();
  let deckTriangles=0,otherTriangles=0;
  for(const group of g.groups)for(let i=group.start;i<group.start+group.count;i+=3) {
    const ys=[0,1,2].map(j=>p.fromBufferAttribute(g.attributes.position,g.index.getX(i+j)).applyMatrix4(node.matrixWorld).y);
    if(node.material[group.materialIndex]===parquet) {
      assert.ok(ys.every(y=>Math.abs(y-17.2)<.001),'Wood painted onto a non-deck surface');
      deckTriangles++;
    } else otherTriangles++;
  }
  assert.ok(deckTriangles>0&&otherTriangles>0);
});

test('lift thresholds on finished floors are separated by two millimetres and finish is idempotent', async () => {
  const house=await loadHouse(),parquet=new MeshStandardMaterial(),original=new Map();
  for(const suffix of ['01','02','03']) {
    const name=`M10_Lift_BoardingBridge_${suffix}`;
    original.set(name,new Box3().setFromObject(house.getObjectByName(name)));
  }
  const stats=applyHouseFloorFinishes(house,parquet);
  assert.equal(stats.separatedLiftThresholds.length,3);
  for(const [name,before] of original) {
    const after=new Box3().setFromObject(house.getObjectByName(name));
    assert.ok(Math.abs((after.max.y-before.max.y)*WORLD_SCALE-.002)<.00001);
    assert.equal(after.min.y,before.min.y);
  }
  const again=applyHouseFloorFinishes(house,parquet);
  assert.equal(again.surfaces.length,0);
  assert.equal(again.separatedLiftThresholds.length,0);
});
