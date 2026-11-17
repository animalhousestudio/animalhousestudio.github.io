import { Bone, Float32BufferAttribute, MathUtils, Skeleton, SkinnedMesh,
  Uint16BufferAttribute } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createFishMotionSampler, FISH_FORMATION, FISH_TAIL_SWING } from './fishSchoolMotion.mjs';

export function createFishSchoolModel(source, route) {
  const parts = [], bones = [], tails = [], roots = [];
  source.updateMatrixWorld(true);
  let material;
  let geometry;
  try {
    for (const [i, spec] of FISH_FORMATION.entries()) {
      const name = 'Fish_' + String(spec.source + 1).padStart(2, '0');
      const fish = source.getObjectByName(name);
      if (!fish?.isMesh || !fish.geometry.attributes.color || !fish.geometry.index
        || Array.isArray(fish.material) || (material && material !== fish.material)) {
        throw new Error(`Invalid school mesh: ${name}`);
      }
      material = fish.material;
      const part = fish.geometry.clone().applyMatrix4(fish.matrixWorld);
      part.scale(spec.scale, spec.scale, spec.scale);
      parts.push(part);
      part.computeBoundingBox();
      const { min, max } = part.boundingBox;
      const pivot = MathUtils.lerp(min.z, max.z, .46);
      const root = new Bone();
      const tail = new Bone();
      tail.position.z = pivot;
      root.add(tail);
      bones.push(root, tail);
      roots.push(root);
      tails.push(tail);
      const count = part.attributes.position.count;
      const index = new Uint16Array(count * 4);
      const weights = new Float32Array(count * 4);
      for (let v = 0; v < count; v++) {
        const weight = 1 - MathUtils.smoothstep(part.attributes.position.getZ(v), min.z, pivot);
        index[v * 4] = i * 2;
        index[v * 4 + 1] = i * 2 + 1;
        weights[v * 4] = 1 - weight;
        weights[v * 4 + 1] = weight;
      }
      part.setAttribute('skinIndex', new Uint16BufferAttribute(index, 4));
      part.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
    }
    geometry = mergeGeometries(parts);
  } finally {
    parts.forEach(part => part.dispose());
  }
  if (!geometry) throw new Error('Incompatible school vertex attributes');
  const mesh = new SkinnedMesh(geometry, material.clone());
  mesh.name = 'PondFishSchoolMesh';
  mesh.frustumCulled = false; // The controller tests the complete moving formation sphere.
  mesh.add(...roots);
  mesh.bind(new Skeleton(bones));

  const motion = createFishMotionSampler(route);
  return {
    mesh,
    swim(seconds, centre) {
      for (const [i, spec] of FISH_FORMATION.entries()) {
        const root = roots[i];
        motion.sample(spec, seconds, root.position, root.quaternion);
        root.position.sub(centre);
        tails[i].rotation.y = FISH_TAIL_SWING * Math.sin(seconds * (7.3 + i % 4 * .31) + spec.phase);
      }
    },
    dispose() {
      mesh.removeFromParent();
      mesh.skeleton.dispose();
      mesh.geometry.dispose();
      mesh.material.dispose();
    },
  };
}
