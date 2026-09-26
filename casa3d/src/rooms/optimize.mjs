import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function movable(node, root) {
  for (let p = node; p && p !== root; p = p.parent) {
    if (p.userData.interactable || /JETPACK|EntryDoorPivot/.test(p.name)) return true;
  }
  return false;
}
// Preserve shared Blender geometry: repeated static pieces become GPU instances.
export function instanceStaticMeshes(root) {
  root.updateMatrixWorld(true);
  const inverse=root.matrixWorld.clone().invert(), buckets=new Map();
  root.traverseVisible(o=>{
    if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||Array.isArray(o.material)||o.material.transparent||o.children.length||!o.visible||movable(o,root))return;
    // InstancedMesh cannot change face winding per instance. Mirrored shutters
    // stay separate here; the material batching below corrects their winding.
    if(inverse.clone().multiply(o.matrixWorld).determinant()<0)return;
    const key=o.geometry.uuid+o.material.uuid;
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);
  });
  let saved=0;
  for(const objects of buckets.values()) {
    if(objects.length<3)continue;
    const first=objects[0], batch=new THREE.InstancedMesh(first.geometry,first.material,objects.length);
    batch.name=`Shared_${first.name}`;batch.castShadow=true;batch.receiveShadow=true;
    objects.forEach((o,i)=>{batch.setMatrixAt(i,inverse.clone().multiply(o.matrixWorld));o.removeFromParent();});
    batch.computeBoundingSphere();root.add(batch);saved+=objects.length-1;
  }
  root.userData.drawCallsSaved=saved;
  return saved;
}

// Batch static opaque architecture by material and spatial cell. Keeping cells
// small lets the renderer still discard parts outside the camera's view.
export function batchStaticArchitecture(root, cellSize = 10, excludedRoots = []) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), buckets = new Map();
  root.traverseVisible(node => {
    for (let p = node; p && p !== root; p = p.parent) if (excludedRoots.includes(p)) return;
    if (!node.isMesh || node.isInstancedMesh || node.isSkinnedMesh || node.children.length
      || Array.isArray(node.material) || node.material.transparent || movable(node, root)
      || node.userData.collidable || node.geometry.morphAttributes.position || node.geometry.groups.length > 1) return;
    const matrix = inverse.clone().multiply(node.matrixWorld);
    node.geometry.computeBoundingBox();
    const center = node.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(matrix);
    const attributes = Object.keys(node.geometry.attributes).sort().map(k => {
      const a = node.geometry.attributes[k]; return `${k}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;
    }).join('|');
    const cell = center.toArray().map(v => Math.floor(v / cellSize)).join(',');
    const key = `${node.material.uuid}/${cell}/${attributes}/${node.castShadow}/${node.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ node, matrix });
  });
  let saved = 0;
  for (const entries of buckets.values()) {
    if (entries.length < 2) continue;
    const geometries = entries.map(({ node, matrix }) => {
      const geometry = node.geometry.clone().applyMatrix4(matrix);
      // Index every input without expanding vertices or changing UV seams.
      if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
      if (matrix.determinant() < 0) {
        for (let i = 0; i < geometry.index.count; i += 3) {
          const b = geometry.index.getX(i + 1);
          geometry.index.setX(i + 1, geometry.index.getX(i + 2)); geometry.index.setX(i + 2, b);
        }
        const tangent = geometry.getAttribute('tangent');
        if (tangent) for (let i = 0; i < tangent.count; i++) tangent.setW(i, -tangent.getW(i));
      }
      return geometry;
    });
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    if (!geometry) continue;
    geometry.computeBoundingSphere(); geometry.computeBoundingBox();
    const first = entries[0].node, mesh = new THREE.Mesh(geometry, first.material);
    mesh.name = `Architecture_${first.material.name}`;
    mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    entries.forEach(({ node }) => node.removeFromParent());
    saved += entries.length - 1;
  }
  // Static local matrices no longer need recomputing each frame. Ancestors and
  // movable branches still update normally, including the world's 5× scale.
  root.traverse(node => { if (node !== root && !movable(node, root)) { node.updateMatrix(); node.matrixAutoUpdate = false; } });
  root.userData.drawCallsSaved = (root.userData.drawCallsSaved || 0) + saved;
  return saved;
}

export function partitionInstances(source, cellSize = 12) {
  const cells = new Map(), matrix = new THREE.Matrix4(), p = new THREE.Vector3();
  for (let i = 0; i < source.count; i++) {
    source.getMatrixAt(i, matrix); p.setFromMatrixPosition(matrix);
    const key = `${Math.floor(p.x / cellSize)},${Math.floor(p.z / cellSize)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(matrix.clone());
  }
  const group = new THREE.Group(); group.name = 'GrassCells';
  for (const [key, matrices] of cells) {
    const mesh = new THREE.InstancedMesh(source.geometry, source.material, matrices.length);
    mesh.name = `GrassCell_${key}`;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.computeBoundingSphere(); mesh.matrixAutoUpdate = false;
    mesh.userData.fullCount = matrices.length;
    group.add(mesh);
  }
  source.dispose();
  return group;
}

export function updateGrassDensity(cells, x, y, z) {
  for (const mesh of cells) {
    const c = mesh.boundingSphere.center;
    const distance = Math.hypot(c.x - x, c.y - y, c.z - z);
    // Keep full detail nearby; distant blades gradually give way to the lawn
    // texture. Deterministic instance ordering prevents reshuffling the plants.
    const density = 1 - .94 * THREE.MathUtils.smoothstep(distance, 10, 34);
    mesh.count = Math.max(1, Math.round(mesh.userData.fullCount * density));
  }
}
