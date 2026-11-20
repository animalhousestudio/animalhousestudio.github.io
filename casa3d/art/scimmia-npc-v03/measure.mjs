// Sample the shipped skin in Three.js coordinates, in metres relative to its route anchor.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { AnimationMixer, Box3, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const path = name => new URL(name, import.meta.url);
const data = await readFile(path('../../src/assets/models/props/scimmia-npc.glb'));
const manifest = JSON.parse(await readFile(path('runtime-export.json')));
assert.equal(createHash('sha256').update(data).digest('hex'), manifest.glbSha256);
const loader = new GLTFLoader();
loader.register(() => ({name:'BoundsOnly',loadTexture:async () => new Texture()}));
const {scene,animations} = await loader.parseAsync(
  data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
const mixer = new AnimationMixer(scene);
let skin;
scene.traverse(node => { if (node.isSkinnedMesh) skin = node; });
const positions = skin.geometry.getAttribute('position');
const vertex = new Vector3();
const center = new Vector3(0,.75,0);
const measurements = {};
for (const clip of animations) {
  const action = mixer.clipAction(clip).play();
  action.paused = true;
  const box = new Box3();
  let radiusSq = 0;
  const samples = Math.ceil(clip.duration*60);
  for (let i=0; i<=samples; i++) {
    action.time = clip.duration*i/samples;
    mixer.update(0);
    scene.updateMatrixWorld(true);
    for (let j=0; j<positions.count; j++) {
      skin.localToWorld(skin.applyBoneTransform(j,vertex.fromBufferAttribute(positions,j)));
      box.expandByPoint(vertex);
      radiusSq = Math.max(radiusSq,vertex.distanceToSquared(center));
    }
  }
  const horizontalRadius = Math.hypot(Math.max(-box.min.x,box.max.x),Math.max(-box.min.z,box.max.z));
  assert.ok(horizontalRadius<1.6 && box.min.y>=-.15 && box.max.y<=1.75 && radiusSq<=1.5**2);
  measurements[clip.name] = {seconds:clip.duration,min:box.min.toArray(),max:box.max.toArray(),
    radiusFromCullingCenter:Math.sqrt(radiusSq)};
  action.stop();
}
await writeFile(path('ingombri.json'),JSON.stringify(measurements,null,2)+'\n');
