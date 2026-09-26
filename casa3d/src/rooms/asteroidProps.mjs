import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { terrainHeight, propPlacements } from './terrainDetail.mjs';
import { instanceStaticMeshes, batchStaticArchitecture } from './optimize.mjs';
import keyboardUrl from '../assets/models/props/keyboard1.glb?url';
import ufoUrl from '../assets/models/props/ufo.glb?url';
import punchUrl from '../assets/models/props/punchmachine.glb?url';

function prepareProp(scene) {
  const staging = [], materials = new Set();
  scene.traverse(node => {
    if (node.name.replaceAll('_', ' ') === 'La Zampata side artwork left') {
      node.geometry = node.geometry.clone();
      const uv = node.geometry.getAttribute('uv');
      // Left panel was exported rotated 180° relative to its outward normal.
      for (let i = 0; i < uv.count; i++) uv.setXY(i, 1 - uv.getX(i), 1 - uv.getY(i));
      uv.needsUpdate = true;
    }
    if (/^Neutral.*floor$/i.test(node.name.replaceAll('_', ' ')) || node.name === 'Cube') staging.push(node);
    if (node.isMesh) for (const mat of (Array.isArray(node.material) ? node.material : [node.material])) materials.add(mat);
  });
  staging.forEach(node => node.removeFromParent());
  // These named materials were exported with Blender's default grey values.
  const palette = {
    'Key ivory': 0xeee8d5, 'Key black': 0x14161a, 'Brushed steel': 0x8e969a,
    'Red switch': 0xc53e32, 'Amber switch': 0xd4a03c, 'Green LED': 0x65c67a,
    'Panel black': 0x181e24, 'Knob cap': 0x313a42, 'Charcoal enamel': 0x252d33,
    'Walnut wood': 0x633a23, 'Wood edge': 0x8b5634, 'Chrome': 0xc8d1d7,
    'Arcade red': 0xa82427, 'Arcade matte black': 0x171c22,
    'Punching bag rubber': 0x26201e, 'Label white': 0xf1ead9,
  };
  for (const mat of materials) {
    if (palette[mat.name] === undefined || mat.map) continue;
    mat.color.setHex(palette[mat.name]);
    mat.metalness = /steel|Chrome/i.test(mat.name) ? .7 : .05;
    mat.roughness = /Chrome/.test(mat.name) ? .24 : .68;
  }
}

// Normalize the complete model, including its authoring transforms and origin.
function place(source, p, heightSized = false) {
  const model = source.clone(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const scale = p.size / (heightSized ? size.y : Math.max(size.x, size.z));
  model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  const pivot = new THREE.Group(); pivot.add(model); pivot.scale.setScalar(scale);
  if (p.height) pivot.scale.y = p.height / size.y;
  pivot.rotation.set(p.tilt || 0, p.yaw || 0, 0);
  pivot.position.set(p.x, terrainHeight(p.x, p.z) - (p.buried || 0), p.z);
  pivot.name = p.name || 'SurfaceBoulder';
  pivot.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = true; node.receiveShadow = true;
    node.userData.collidable = false;
  });
  return pivot;
}

export async function addAsteroidProps(garden) {
  const loader = new GLTFLoader();
  const layer = new THREE.Group(); layer.name = 'AsteroidSurfaceDetails'; garden.add(layer);
  const jobs = [ufoUrl, keyboardUrl, punchUrl].map((url, i) => loader.loadAsync(url).then(({ scene }) => {
    prepareProp(scene);
    const prop = place(scene, propPlacements[i], i === 2);
    instanceStaticMeshes(prop);
    const baseline = ['127.0.0.1', 'localhost'].includes(location.hostname) && new URLSearchParams(location.search).has('baseline');
    if (!baseline) batchStaticArchitecture(prop);
    layer.add(prop);
  }));
  const results = await Promise.allSettled(jobs);
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Asteroid details failed to load');
  instanceStaticMeshes(layer);
  return layer;
}
