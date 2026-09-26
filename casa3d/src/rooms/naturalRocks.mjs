import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { naturalRockPlacements, isRockFootprintClear } from './rockLayout.mjs';
import { createRockTemplate, naturalRockTransform } from './rockPlacement.mjs';
import { gardenBorderClear } from './landscapeLayout.mjs';
import rocksUrl from '../assets/models/rocks-natural.glb?url';

export async function addNaturalRocks(garden, pitch) {
  const { scene } = await new GLTFLoader().loadAsync(rocksUrl);
  scene.updateMatrixWorld(true);
  const templates = [];
  scene.traverse(node => {
    if (!node.isMesh) return;
    // Only two geometry copies in memory, shared by every spatial instance batch.
    templates.push(createRockTemplate(node));
  });
  templates.sort((a, b) => a.name.localeCompare(b.name));
  if (templates.length !== 2) throw new Error('Expected the two authored natural rock variants');
  // Source geometry is no longer referenced after the two template copies.
  const sourceGeometry = new Set();
  scene.traverse(node => { if (node.isMesh) sourceGeometry.add(node.geometry); });
  sourceGeometry.forEach(geometry => geometry.dispose());
  const layer = new THREE.Group(); layer.name = 'NaturalRocks';
  const buckets = new Map();
  let rejected = 0;
  naturalRockPlacements.forEach((p, i) => {
    // Small stones use the 192-triangle model; retain the detailed silhouette on boulders.
    const variant = p.size < 1.2 ? 1 : i % templates.length;
    const template = templates[variant];
    const { matrix, bounds: box } = naturalRockTransform(template, p);
    const footprint = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
    if (!isRockFootprintClear(footprint, pitch) || !gardenBorderClear(footprint)) { rejected++; return; }
    const key = `${variant}/${Math.floor(p.x / 12)}/${Math.floor(p.z / 12)}`;
    if (!buckets.has(key)) buckets.set(key, { template, matrices: [] });
    buckets.get(key).matrices.push(matrix);
  });
  for (const [key, { template, matrices }] of buckets) {
    const mesh = new THREE.InstancedMesh(template.geometry, template.material, matrices.length);
    mesh.name = `NaturalRock_${key}`;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.collidable = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); mesh.matrixAutoUpdate = false;
    layer.add(mesh);
  }
  layer.userData.rejectedPlacements = rejected;
  garden.add(layer);
  return layer;
}
