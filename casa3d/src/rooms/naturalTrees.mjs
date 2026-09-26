import { Group, InstancedMesh, DoubleSide } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createTreeTemplates, selectTreePlacements } from './treePlacement.mjs';
import treesUrl from '../assets/models/trees-natural.glb?url';

export async function addNaturalTrees(garden, pitch) {
  const { scene } = await new GLTFLoader().loadAsync(treesUrl);
  const templates = createTreeTemplates(scene);
  const placements = selectTreePlacements(templates, pitch);
  if (placements.length !== 12) throw new Error('Unable to find twelve clear tree sites');
  const layer = new Group(); layer.name = 'NaturalTrees';
  const buckets = new Map();
  for (const placement of placements) {
    const key = `${placement.variant}/${Math.floor(placement.x / 16)}/${Math.floor(placement.z / 16)}`;
    if (!buckets.has(key)) buckets.set(key, { template: placement.template, matrices: [] });
    buckets.get(key).matrices.push(placement.matrix);
  }
  for (const [key, { template, matrices }] of buckets) for (const part of template.parts) {
    const leaves = part.name === 'Leaves';
    if (leaves) {
      part.material.alphaTest = Math.max(.45, part.material.alphaTest);
      part.material.transparent = false; part.material.depthWrite = true;
      part.material.side = DoubleSide;
    }
    const mesh = new InstancedMesh(part.geometry, part.material, matrices.length);
    mesh.name = `NaturalTree_${part.name}_${key}`;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.collisionDisabled = leaves;
    mesh.userData.collidable = !leaves;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); mesh.matrixAutoUpdate = false;
    layer.add(mesh);
  }
  layer.userData.placements = placements.map(({ variant, x, z, height, yaw }) => ({ variant, x, z, height, yaw }));
  const sourceGeometry = new Set();
  scene.traverse(node => { if (node.isMesh) sourceGeometry.add(node.geometry); });
  sourceGeometry.forEach(geometry => geometry.dispose());
  garden.add(layer);
  return layer;
}
