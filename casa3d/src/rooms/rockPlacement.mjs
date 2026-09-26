import { Box3, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { noise, terrainHeight } from './terrainDetail.mjs';

// Normalize the two authored assets once, before building their instance batches.
// Rock_B's imported upright pose balances on a tip: its broad face belongs down.
export function createRockTemplate(node) {
  const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
  if (node.name === 'Rock_B') geometry.rotateX(Math.PI / 2);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new Vector3());
  const dimensions = geometry.boundingBox.getSize(new Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  const width = Math.max(dimensions.x, dimensions.z);
  geometry.scale(1 / width, 1 / width, 1 / width);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { name: node.name, geometry, material: node.material };
}

export function naturalRockPose(placement) {
  // Position-based seeds keep existing rocks unchanged when another is added.
  const seed = placement.x * 37.1 + placement.z * 11.7;
  return {
    yaw: placement.yaw,
    tiltX: (noise(seed, 31) - .5) * .36,
    tiltZ: (noise(seed, 32) - .5) * .32,
    burial: .18 + noise(seed, 33) * .20,
  };
}

export function naturalRockTransform(template, placement, heightAt = terrainHeight) {
  const pose = naturalRockPose(placement);
  const rotation = new Quaternion().setFromEuler(new Euler(pose.tiltX, pose.yaw, pose.tiltZ, 'YXZ'));
  const matrix = new Matrix4().compose(new Vector3(placement.x, 0, placement.z), rotation,
    new Vector3().setScalar(placement.size));
  const vertices = template.geometry.getAttribute('position');
  const point = new Vector3(), bounds = new Box3();
  // Bounds of the actual tilted vertices, not the unrotated source bounding box.
  for (let i = 0; i < vertices.count; i++) {
    bounds.expandByPoint(point.fromBufferAttribute(vertices, i).applyMatrix4(matrix));
  }
  const height = bounds.max.y - bounds.min.y;
  const supportCeiling = bounds.min.y + height * .45;
  let ground = heightAt(placement.x, placement.z);
  // Sample underneath the lower surface as well as at its centre. This seats
  // the whole base into sloping terrain instead of balancing one corner on it.
  for (let i = 0; i < vertices.count; i++) {
    point.fromBufferAttribute(vertices, i).applyMatrix4(matrix);
    if (point.y <= supportCeiling) ground = Math.min(ground, heightAt(point.x, point.z));
  }
  const y = ground - bounds.min.y - height * pose.burial;
  matrix.elements[13] = y;
  bounds.translate(new Vector3(0, y, 0));
  return { matrix, bounds, pose, ground };
}
