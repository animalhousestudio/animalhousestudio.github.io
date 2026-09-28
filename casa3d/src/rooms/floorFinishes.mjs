import { Float32BufferAttribute, Matrix4, Vector3 } from 'three';
import { WORLD_SCALE } from './layout.mjs';
import { PARQUET_TILE_WORLD_SIZE } from './parquetMaterial.mjs';

// An explicit surface schedule prevents wood from appearing on furniture,
// window sills, undersides, the cellar, or the observatory.
const floorNames = new Set([
  'M01_Reuse_INT_Slab_Living', 'M01_Reuse_INT_Slab_Kitchen', 'M01_UpperFloor_Slab',
  'M01_Conservatory_Plinth', 'M01_Reuse_AVIARY_Left_Floor', 'M01_GrandBalcony_Deck',
  'M06_Veranda_Threshold', 'M06_Veranda_UpperLanding', 'M06_Aviary_Threshold',
  'M06_EastBridge_Threshold', 'M04_WestPassage_Assembly001',
]);

function isFloor(name) {
  return floorNames.has(name)
    || /^(?:M04_WestTurret_)?M03_Tower_Floor\d*$/.test(name)
    || /^M03_Bridge_Tread\d*$/.test(name)
    || /^M06_Veranda_Step_\d+$/.test(name);
}

/** Finish only the upward walking faces, preserving the original solid slab. */
export function applyHouseFloorFinishes(exterior, parquet) {
  exterior.updateWorldMatrix(true, true);
  const inverse = exterior.matrixWorld.clone().invert();
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  const ab = new Vector3(), ac = new Vector3(), normal = new Vector3();
  const local = new Matrix4(), point = new Vector3();
  const stats = { surfaces: [], triangles: 0, separatedLiftThresholds: [] };

  exterior.traverse(node => {
    if (!node.isMesh || !isFloor(node.name) || node.userData.parquetFinish) return;
    const source = node.geometry, position = source.attributes.position;
    if (!position) return;
    local.multiplyMatrices(inverse, node.matrixWorld);
    const handedness = Math.sign(local.determinant());
    const count = source.index?.count ?? position.count;
    const originalMaterials = Array.isArray(node.material) ? node.material : [node.material];
    const byMaterial = originalMaterials.map(() => []), top = [];
    const indexAt = i => source.index ? source.index.getX(i) : i;
    for (let i = 0; i < count; i += 3) {
      const ids = [indexAt(i), indexAt(i + 1), indexAt(i + 2)];
      a.fromBufferAttribute(position, ids[0]).applyMatrix4(local);
      b.fromBufferAttribute(position, ids[1]).applyMatrix4(local);
      c.fromBufferAttribute(position, ids[2]).applyMatrix4(local);
      normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).normalize().multiplyScalar(handedness);
      // The west connector combines its deck, rails, braces and roof in one
      // mesh: only the measured deck plane belongs in the flooring schedule.
      const deck = node.name !== 'M04_WestPassage_Assembly001'
        || [a.y, b.y, c.y].every(y => Math.abs(y - 17.2) < .001);
      if (normal.y > .98 && deck) top.push(...ids);
      else {
        const group = source.groups.find(g => i >= g.start && i < g.start + g.count);
        byMaterial[group?.materialIndex ?? 0].push(...ids);
      }
    }
    if (!top.length) return;
    const geometry = source.clone(), indices = [];
    geometry.clearGroups();
    for (let material = 0; material < byMaterial.length; material++) {
      const entries = byMaterial[material];
      if (entries.length) geometry.addGroup(indices.length, entries.length, material);
      indices.push(...entries);
    }
    geometry.addGroup(indices.length, top.length, originalMaterials.length);
    indices.push(...top);
    geometry.setIndex(indices);
    // Metre-based coordinates keep every room and differently scaled turret
    // on the same board size. Existing apertures and vertex positions stay put.
    const uv = new Float32Array(position.count * 2);
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(local);
      uv[i * 2] = point.x * WORLD_SCALE / PARQUET_TILE_WORLD_SIZE;
      uv[i * 2 + 1] = point.z * WORLD_SCALE / PARQUET_TILE_WORLD_SIZE;
    }
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    node.geometry = geometry;
    node.material = [...originalMaterials, parquet];
    node.userData.parquetFinish = true;
    stats.surfaces.push(node.name);
    stats.triangles += top.length / 3;
  });

  // These small metal thresholds overlap both the lift's landing ring and
  // the slab. Separate only their top by 2 mm in the final game scale.
  for (const suffix of ['01', '02', '03']) {
    const node = exterior.getObjectByName(`M10_Lift_BoardingBridge_${suffix}`);
    if (!node?.isMesh || node.userData.thresholdSeparated) continue;
    const geometry = node.geometry.clone(), position = geometry.attributes.position;
    local.multiplyMatrices(inverse, node.matrixWorld);
    const undo = local.clone().invert();
    let topY = -Infinity;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(local);
      topY = Math.max(topY, point.y);
    }
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(local);
      if (Math.abs(point.y - topY) > 1e-5) continue;
      point.y += .002 / WORLD_SCALE;
      point.applyMatrix4(undo);
      position.setXYZ(i, point.x, point.y, point.z);
    }
    position.needsUpdate = true;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    node.geometry = geometry;
    node.userData.thresholdSeparated = true;
    stats.separatedLiftThresholds.push(node.name);
  }
  return stats;
}
