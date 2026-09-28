import { BufferAttribute } from 'three';

function canCleanGeometry(geometry) {
  const index = geometry.index, position = geometry.getAttribute('position');
  if (!index || !position || position.itemSize !== 3 || index.itemSize !== 1
    || index.isInterleavedBufferAttribute || index.normalized || index.count % 3
    || !(index.array instanceof Uint16Array || index.array instanceof Uint32Array)
    || geometry.getAttribute('skinIndex') || geometry.getAttribute('skinWeight')
    || Object.values(geometry.morphAttributes).some(attributes => attributes.length)) return false;
  // Partial ranges may start a different triangle sequence. Leave them intact.
  if (geometry.drawRange.start !== 0
    || (geometry.drawRange.count !== Infinity && geometry.drawRange.count !== index.count)) return false;
  if (geometry.groups.some(group => !Number.isInteger(group.start) || !Number.isInteger(group.count)
    || group.start < 0 || group.count < 0 || group.start % 3 || group.count % 3
    || group.start + group.count > index.count)) return false;
  for (let i = 0; i < index.count; i++) if (index.getX(i) >= position.count) return false;
  return true;
}

function canCleanNode(node) {
  if (!node.isMesh || node.isSkinnedMesh) return false;
  const materials = Array.isArray(node.material) ? node.material : [node.material];
  // Degenerate faces still have visible edges in wireframe, and vertex
  // deformation can unfold a triangle that is collapsed in its rest pose.
  return materials.every(material => material && !material.wireframe && !material.displacementMap
    && !material.isShaderMaterial && !material.isRawShaderMaterial);
}

/**
 * Remove only exactly collapsed triangles from static imported mesh indices.
 * Call before uploading/batching the loaded root. Geometry identity and all
 * vertex attributes remain unchanged, so every repeated mesh keeps sharing it.
 * No epsilon or squared area is used: even extremely thin real faces survive.
 */
export function removeDegenerateTriangles(root) {
  const usage = new Map();
  root.traverse(node => {
    if (!node.geometry) return;
    if (!usage.has(node.geometry)) usage.set(node.geometry, { supported: true, instances: 0 });
    const entry = usage.get(node.geometry);
    entry.supported &&= canCleanNode(node);
    entry.instances += node.isInstancedMesh ? node.count : 1;
  });
  const stats = { geometriesChanged: 0, geometriesSkipped: 0, trianglesRemoved: 0, meshTrianglesRemoved: 0 };
  for (const [geometry, entry] of usage) {
    if (!entry.supported || !canCleanGeometry(geometry)) {
      stats.geometriesSkipped++;
      continue;
    }
    const index = geometry.index, position = geometry.getAttribute('position');
    const retained = [], offsets = new Uint32Array(index.count / 3 + 1);
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      const abx = position.getX(b) - position.getX(a);
      const aby = position.getY(b) - position.getY(a);
      const abz = position.getZ(b) - position.getZ(a);
      const acx = position.getX(c) - position.getX(a);
      const acy = position.getY(c) - position.getY(a);
      const acz = position.getZ(c) - position.getZ(a);
      const collapsed = aby * acz - abz * acy === 0
        && abz * acx - abx * acz === 0
        && abx * acy - aby * acx === 0;
      if (!collapsed) retained.push(a, b, c);
      offsets[i / 3 + 1] = retained.length;
    }
    const removed = (index.count - retained.length) / 3;
    if (!removed) continue;
    const replacement = new BufferAttribute(new index.array.constructor(retained), 1);
    replacement.name = index.name;
    replacement.setUsage(index.usage);
    replacement.gpuType = index.gpuType;
    geometry.setIndex(replacement);
    for (const group of geometry.groups) {
      const start = offsets[group.start / 3], end = offsets[(group.start + group.count) / 3];
      group.start = start;
      group.count = end - start;
    }
    if (geometry.drawRange.count !== Infinity) geometry.drawRange.count = retained.length;
    stats.geometriesChanged++;
    stats.trianglesRemoved += removed;
    stats.meshTrianglesRemoved += removed * entry.instances;
  }
  return stats;
}
