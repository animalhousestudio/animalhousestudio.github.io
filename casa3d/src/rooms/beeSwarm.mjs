import * as THREE from 'three';

/** A calm, lightweight swarm in the hive's local Y-up coordinates. */
export function createBeeSwarm({ width, height, depth, count = 12 }) {
  const group = new THREE.Group();
  group.name = 'DreamyHive_BeeSwarm';
  group.userData.collisionDisabled = true;
  group.userData.dynamic = true;

  const beeCount = Math.max(0, Math.min(48, Math.round(count)));
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const ring = new THREE.TorusGeometry(1, .085, 5, 12);
  const honey = new THREE.MeshStandardMaterial({ color: 0xefbd57, roughness: .58, metalness: .03 });
  const cocoa = new THREE.MeshStandardMaterial({ color: 0x493024, roughness: .78 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xfff0d8, roughness: .4, metalness: .04 });

  function instances(name, geometry, material, amount) {
    const mesh = new THREE.InstancedMesh(geometry, material, amount);
    mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.collisionDisabled = true;
    mesh.userData.dynamic = true;
    // Matrices move every frame; twelve tiny bees do not warrant rebuilding bounds.
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  }

  // Four draw calls for the whole swarm, including both stripes and both wings.
  const bodies = instances('Bees_HoneyBodies', sphere, honey, beeCount);
  const heads = instances('Bees_CocoaHeads', sphere, cocoa, beeCount);
  const stripes = instances('Bees_CocoaStripes', ring, cocoa, beeCount * 2);
  const wings = instances('Bees_IvoryWings', sphere, ivory, beeCount * 2);
  const meshes = [bodies, heads, stripes, wings];
  const aboveCount = Math.ceil(beeCount / 3);
  const bees = Array.from({ length: beeCount }, (_, index) => {
    const above = index < aboveCount;
    const variation = .5 + .5 * Math.sin(index * 2.399963);
    const length = height * (.066 + .016 * variation);
    const clearance = height * (.23 + .12 * variation);
    return {
      above,
      length,
      phase: index * 2.399963,
      speed: (.26 + .11 * variation) * (index % 3 === 0 ? -1 : 1),
      // The sqrt(2) keeps even a rectangular hive's corners inside the orbit.
      radiusX: above ? width * (.25 + .16 * variation) : (width / 2 + clearance) * Math.SQRT2,
      radiusZ: above ? depth * (.28 + .2 * variation) : (depth / 2 + clearance) * Math.SQRT2,
      altitude: above ? height + length * 2.5 + variation * height * .15 : height * (.43 + .42 * variation),
    };
  });
  const rig = new THREE.Object3D();
  const part = new THREE.Object3D();
  const matrix = new THREE.Matrix4();

  function setPart(mesh, index, x, y, z, sx, sy, sz, rotationZ = 0) {
    part.position.set(x, y, z);
    part.rotation.set(0, 0, rotationZ);
    part.scale.set(sx, sy, sz);
    part.updateMatrix();
    matrix.multiplyMatrices(rig.matrix, part.matrix);
    mesh.setMatrixAt(index, matrix);
  }

  function update(seconds) {
    for (let i = 0; i < bees.length; i++) {
      const bee = bees[i];
      const angle = seconds * bee.speed + bee.phase;
      const bob = Math.sin(seconds * 1.15 + bee.phase) * height * .055;
      const l = bee.length;
      rig.position.set(
        Math.cos(angle) * bee.radiusX,
        bee.altitude + bob,
        Math.sin(angle) * bee.radiusZ,
      );
      const yaw = Math.atan2(-Math.sin(angle) * bee.radiusX * bee.speed,
        Math.cos(angle) * bee.radiusZ * bee.speed);
      rig.rotation.set(Math.sin(seconds * 1.4 + bee.phase) * .055, yaw, Math.sin(angle) * .07, 'YXZ');
      rig.updateMatrix();

      setPart(bodies, i, 0, 0, 0, l * .31, l * .29, l * .5);
      setPart(heads, i, 0, l * .015, l * .48, l * .23, l * .225, l * .205);
      for (let stripe = 0; stripe < 2; stripe++) {
        setPart(stripes, i * 2 + stripe, 0, 0, (stripe ? .16 : -.18) * l,
          l * .287, l * .269, l * .36);
      }

      const flap = .34 + Math.sin(seconds * 64 + bee.phase * 3) * .48;
      for (let side = 0; side < 2; side++) {
        const sign = side === 0 ? -1 : 1;
        // Offset along the rotated wing keeps its inner end hinged to the thorax.
        setPart(wings, i * 2 + side,
          sign * l * (.16 + .4 * Math.cos(flap)),
          l * (.2 + .4 * Math.sin(flap)), l * .09,
          l * .44, l * .043, l * .24, sign * flap);
      }
    }
    for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
  }

  update(0);
  return { group, update };
}
