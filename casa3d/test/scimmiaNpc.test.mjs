import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { AnimationMixer, MeshBasicMaterial, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANDING_Z } from '../src/arrival.mjs';
import { WORLD_SCALE } from '../src/rooms/layout.mjs';
import { prepareAsteroid } from '../src/rooms/asteroid.mjs';
import { createCoasterRoute, createCoasterSupports } from '../src/rooms/coasterLayout.mjs';
import { createScimmiaRoute } from '../src/rooms/scimmiaRoute.mjs';
import { CONTACT_BOOTH } from '../src/rooms/contactBoothLayout.mjs';
import { createPondLayout, SECOND_POND_FOOTPRINT } from '../src/rooms/pondLayout.mjs';
import { terrainHeight } from '../src/rooms/terrainDetail.mjs';
import { gardenBorderClear } from '../src/rooms/landscapeLayout.mjs';
import { naturalRockPlacements, isRockFootprintClear } from '../src/rooms/rockLayout.mjs';
import { createRockTemplate, naturalRockTransform } from '../src/rooms/rockPlacement.mjs';

async function loadGlb(path) {
  const payload = await readFile(new URL(path,import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
  return { payload, ...await loader.parseAsync(payload.buffer.slice(payload.byteOffset,payload.byteOffset+payload.length),'') };
}

const ground = await loadGlb('../src/assets/models/asteroid.glb');
const pondLayouts = [createPondLayout(ground.scene,{heightAt:terrainHeight}),
  createPondLayout(ground.scene,{heightAt:terrainHeight,footprint:SECOND_POND_FOOTPRINT})];
const asteroid = prepareAsteroid(ground.scene,new MeshBasicMaterial(),{pondLayouts});
const heightAt = (x,z) => {
  const height = asteroid.heightAt(x/WORLD_SCALE,z/WORLD_SCALE);
  return height === null ? null : height*WORLD_SCALE;
};
const supports = createCoasterSupports(createCoasterRoute(),heightAt);
const rocks = await loadGlb('../src/assets/models/rocks-natural.glb');
rocks.scene.updateMatrixWorld(true);
const templates = [];
rocks.scene.traverse(node => { if (node.isMesh) templates.push(createRockTemplate(node)); });
templates.sort((a,b) => a.name.localeCompare(b.name));
const rockBounds = naturalRockPlacements.flatMap((placement,index) => {
  const {bounds} = naturalRockTransform(templates[placement.size<1.2 ? 1 : index%2],placement);
  const footprint = {minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z};
  if (!isRockFootprintClear(footprint) || !gardenBorderClear(footprint)) return [];
  bounds.min.multiplyScalar(WORLD_SCALE);
  bounds.max.multiplyScalar(WORLD_SCALE);
  return [bounds];
});
const npc = await loadGlb('../src/assets/models/props/scimmia-npc.glb');

test('the route starts behind and left and snakes forward across the continuous run of real columns', () => {
  const pauses = [0,1,.22,.65];
  let draw = 0;
  const tour = createScimmiaRoute(supports,heightAt,() => pauses[draw++ % pauses.length],rockBounds);
  const start = tour.sample().position;
  assert.ok(start.x < 0 && start.z > LANDING_Z*WORLD_SCALE);
  assert.equal(tour.posts.length,25);
  assert.equal(new Set(tour.posts.map(post => post.id)).size,25);
  assert.deepEqual(tour.posts.slice(0,5).map(post => post.id),
    ['176:1','175:1','175:-1','174:-1','174:1']);
  assert.deepEqual(tour.posts.slice(-2).map(post => post.id),['164:-1','164:1']);
  for (const post of tour.posts) {
    assert.equal(post.size.x,.32);
    assert.equal(post.size.z,.32);
    assert.ok(post.anchor.y >= post.position.y);
    assert.ok(supports.some(support => support.position === post.position));
  }
  const seen = [];
  let previous;
  for (let i = 0; i < 18000; i++) {
    const pose = tour.update(.02);
    assert.ok(tour.bounds.containsPoint(pose.position));
    if (pose.phase === 'walk') assert.equal(pose.position.y,heightAt(pose.position.x,pose.position.z));
    if (pose.phase === 'grip' && previous !== 'grip') seen.push([pose.target,pose.hold]);
    previous = pose.phase;
  }
  assert.deepEqual(seen.slice(0,5),[[0,2],[1,7],[2,3.1],[3,5.25],[4,2]]);
  const outward = tour.posts.map((_,index) => index);
  assert.deepEqual(seen.slice(0,49).map(([index]) => index),
    [...outward,...outward.slice(0,-1).reverse()]);
  assert.equal(seen[49]?.[0],1);
});

test('the skinned grip reaches both facets of every post with all four limbs', async () => {
  const manifest = JSON.parse(await readFile(new URL('../art/scimmia-npc-v01/runtime-export.json',import.meta.url)));
  assert.equal(createHash('sha256').update(npc.payload).digest('hex'),manifest.glbSha256);
  assert.deepEqual(npc.animations.map(clip => clip.name).sort(),['Grip','Leap','Mount','Walk']);
  const tour = createScimmiaRoute(supports,heightAt,Math.random,rockBounds);
  const mixer = new AnimationMixer(npc.scene);
  const grip = mixer.clipAction(npc.animations.find(clip => clip.name === 'Grip')).play();
  mixer.update(0);
  let skin;
  npc.scene.traverse(node => { if (node.isSkinnedMesh) skin = node; });
  assert.ok(skin.geometry.attributes.color);
  assert.equal(skin.geometry.index.count/3,manifest.triangles);
  assert.ok(manifest.triangles < 14000);
  assert.equal(skin.skeleton.bones.filter(bone => /^tail_/.test(bone.name)).length,4);
  for (const name of ['Walk','Leap']) {
    assert.ok(npc.animations.find(clip => clip.name === name).tracks.some(track =>
      /^tail_.*\.quaternion$/.test(track.name) && track.values.some((value,i) =>
        i >= 4 && Math.abs(value-track.values[i%4]) > .001)));
  }
  const { position, skinIndex } = skin.geometry.attributes;
  const vertex = new Vector3();
  for (const post of tour.posts) {
    npc.scene.position.copy(post.anchor);
    npc.scene.rotation.y = post.yaw;
    npc.scene.updateMatrixWorld(true);
    const distances = new Map();
    const nearbyRocks = rockBounds.filter(rock => rock.distanceToPoint(post.anchor)<2);
    for (let i = 0; i < position.count; i++) {
      skin.localToWorld(skin.applyBoneTransform(i,vertex.fromBufferAttribute(position,i)));
      assert.ok(vertex.y >= post.position.y,`Grip below half height on ${post.id}`);
      assert.ok(!nearbyRocks.some(rock => rock.containsPoint(vertex)),`Rock at grip ${post.id}`);
      const bone = skin.skeleton.bones[skinIndex.getX(i)].name;
      const distance = Math.max(Math.abs(vertex.x-post.position.x),Math.abs(vertex.z-post.position.z))-.16;
      distances.set(bone,Math.min(distances.get(bone) ?? Infinity,distance));
    }
    const contacts = ['handL','handR','footL','footR'];
    for (const bone of contacts) {
      assert.ok(distances.get(bone) > -.012 && distances.get(bone) < .018, `${bone}: ${distances.get(bone)}`);
    }
    for (const [bone,distance] of distances) {
      if (!contacts.includes(bone)) assert.ok(distance > 0,`${bone}: ${distance}`);
    }
  }
  grip.stop();
});

test('mount and every jump keep the skinned character clear of the coaster posts', () => {
  const tour = createScimmiaRoute(supports,heightAt,() => 0,rockBounds);
  const mixer = new AnimationMixer(npc.scene);
  const clips = new Map(npc.animations.map(clip => [clip.name.toLowerCase(),mixer.clipAction(clip)]));
  let skin, action;
  npc.scene.traverse(node => { if (node.isSkinnedMesh) skin = node; });
  const { position, skinIndex } = skin.geometry.attributes;
  const vertex = new Vector3();
  const local = new Vector3();
  const visited = new Set();
  let worst = 0;
  let worstPose;
  let boothClearance = Infinity;
  const boothCos = Math.cos(CONTACT_BOOTH.yaw), boothSin = Math.sin(CONTACT_BOOTH.yaw);
  const columns = supports.filter(support => support.column);
  const beams = supports.filter(support => !support.column).map(({position,size,quaternion}) =>
    ({ position, half:size.clone().multiplyScalar(.5), inverse:quaternion.clone().invert() }));
  for (let i = 0; i < 12400; i++) {
    const pose = tour.update(1/60);
    if (pose.phase !== 'mount' && pose.phase !== 'leap') continue;
    visited.add(pose.phase === 'mount' ? 'mount' : `${pose.returning}:${pose.target}`);
    const nearby = columns.filter(post => Math.hypot(post.position.x-pose.position.x,post.position.z-pose.position.z)<2);
    const nearbyRocks = rockBounds.filter(rock => rock.distanceToPoint(pose.position)<2);
    const nearbyBeams = beams.filter(beam => Math.abs(beam.position.y-pose.position.y-.8)<1.2
      && Math.hypot(beam.position.x-pose.position.x,beam.position.z-pose.position.z)<4.8);
    const nearBooth = Math.hypot(pose.position.x-CONTACT_BOOTH.x,pose.position.z-CONTACT_BOOTH.z)<5;
    if (!nearby.length && !nearBooth && !nearbyRocks.length && !nearbyBeams.length) continue;
    const next = clips.get(pose.phase);
    if (next !== action) {
      action?.stop();
      action = next.reset().play();
      action.paused = true;
    }
    action.time = pose.clipTime*action.getClip().duration;
    mixer.update(0);
    npc.scene.position.copy(pose.position);
    npc.scene.rotation.y = pose.yaw;
    npc.scene.updateMatrixWorld(true);
    for (let j = 0; j < position.count; j++) {
      skin.localToWorld(skin.applyBoneTransform(j,vertex.fromBufferAttribute(position,j)));
      assert.ok(!nearbyRocks.some(rock => rock.containsPoint(vertex)),
        `Rock on hop ${pose.target} at ${pose.clipTime}`);
      for (const beam of nearbyBeams) {
        local.subVectors(vertex,beam.position).applyQuaternion(beam.inverse);
        assert.ok(Math.abs(local.x)>beam.half.x || Math.abs(local.y)>beam.half.y
          || Math.abs(local.z)>beam.half.z,`Coaster beam on hop ${pose.target} at ${pose.clipTime}`);
      }
      if (nearBooth && vertex.y < 3.2*CONTACT_BOOTH.scale) {
        const dx = vertex.x-CONTACT_BOOTH.x, dz = vertex.z-CONTACT_BOOTH.z;
        boothClearance = Math.min(boothClearance,Math.max(Math.abs(dx*boothCos-dz*boothSin),
          Math.abs(dx*boothSin+dz*boothCos))-.85*CONTACT_BOOTH.scale);
      }
      for (const post of nearby) {
        const distance = Math.max(Math.abs(vertex.x-post.position.x),Math.abs(vertex.z-post.position.z))-.16;
        if (distance < worst) {
          worst = distance;
          worstPose = [pose.phase,pose.clipTime,pose.target,skin.skeleton.bones[skinIndex.getX(j)].name];
        }
      }
    }
  }
  assert.equal(visited.size,2*tour.posts.length-1);
  assert.ok(worst > -.018,`Maximum sampled post penetration: ${-worst} m at ${worstPose}`);
  assert.ok(boothClearance > 0,`Minimum clearance at the telegram booth: ${boothClearance} m`);
  action?.stop();
});
