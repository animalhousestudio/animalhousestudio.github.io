import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';

export const METRES_PER_UNIT = 1;
export const FLOOR_LEVELS = [-2.8, 0.2, 4, 7.8, 11.6, 15.6];
export const FLOOR_LABELS = ['Cantina', 'Grande atrio', 'Saloni', 'Stanze private', 'Conservatorio', 'Osservatorio'];
export const EYE_HEIGHT = 1.65;
export const BODY_HEIGHT = 1.8;
export const BODY_RADIUS = 0.22;
export const SPAWN_FEET = new THREE.Vector3(0, 0, 12.5);

// Four simple ground patches leave the basement and its stair opening empty.
// They are a test surface outside the house, not part of the exported asset.
export function createTestGround() {
  const group = new THREE.Group();
  group.name = 'TestGroundOutsideBasement';
  const material = new THREE.MeshLambertMaterial({ color: 0x606d73 });
  for (const [x0, x1, z0, z1] of [
    [-24, -11.4, -24, 24], [11.1, 24, -24, 24],
    [-11.4, 11.1, -24, -7.4], [-11.4, 11.1, 7.4, 24],
  ]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.1, z1 - z0), material);
    mesh.position.set((x0 + x1) / 2, -0.05, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function prepareHouse(model, ground = createTestGround()) {
  // glTF's Y-up conversion is already applied by GLTFLoader. Never apply the
  // old world's 5x multiplier or a second axis conversion to this asset.
  model.scale.setScalar(METRES_PER_UNIT);
  model.updateMatrixWorld(true);
  ground.updateMatrixWorld(true);
  const collision = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: 0xb5bbc0 });
  let visualMeshes = 0, visualTriangles = 0, rampCount = 0;
  const visualBounds = new THREE.Box3();
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const ramp = mesh.userData.collision_only === true;
    if (ramp) {
      mesh.visible = false;
      rampCount++;
    } else {
      mesh.material = material;
      mesh.castShadow = mesh.receiveShadow = true;
      visualMeshes++;
      visualTriangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      visualBounds.union(new THREE.Box3().setFromObject(mesh));
    }
    // Preserve actual wall openings and slab holes. One AABB around a whole
    // shell would seal every room. The low-poly static greybox is already simple.
    if (mesh.userData.game_collision !== 'stairs_visual') {
      const proxy = new THREE.Mesh(mesh.geometry);
      proxy.matrixAutoUpdate = false;
      proxy.matrix.copy(mesh.matrixWorld);
      collision.add(proxy);
    }
  });
  if (visualMeshes !== 87 || rampCount !== 0) throw new Error('Dimora incompleta: ricontrollare esportazione e collisioni.');
  ground.traverse(mesh => {
    if (!mesh.isMesh) return;
    const proxy = new THREE.Mesh(mesh.geometry);
    proxy.matrixAutoUpdate = false;
    proxy.matrix.copy(mesh.matrixWorld);
    collision.add(proxy);
  });
  const octree = new Octree().fromGraphNode(collision);
  return { model, ground, octree, visualBounds, stats: { visualMeshes, visualTriangles, rampCount, metresPerUnit: METRES_PER_UNIT } };
}
