import * as THREE from 'three';
import { assetBounds, createAssetVisual } from '../world/assetCatalog.mjs';
import { LANDING_Z } from '../arrival.mjs';
import { WORLD_SCALE } from './layout.mjs';
import { terrainHeight } from './terrainDetail.mjs';
import { createBeeSwarm } from './beeSwarm.mjs';

// Four metres left and nine metres ahead of the arrival, beside the path.
export const BEEHIVE_PLACEMENT = Object.freeze({
  x: -4 / WORLD_SCALE,
  z: LANDING_Z - 9 / WORLD_SCALE,
  height: 2.7 / WORLD_SCALE,
  yaw: Math.atan2(4, 9) + Math.PI / 6,
});

function addCollisionHull(root, width, height, depth) {
  const material = new THREE.MeshBasicMaterial({ visible: false });
  const body = new THREE.Mesh(new THREE.BoxGeometry(width * .75, height * .77, depth * .82), material);
  body.name = 'Beehive_CabinetCollision';
  body.position.y = height * .385;
  body.userData.collidable = true;
  root.add(body);

  // Follow the roof slopes instead of blocking the empty space above the eaves.
  const x = width / 2, z = depth / 2, eave = height * .77;
  const roofGeometry = new THREE.BufferGeometry();
  roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -x, eave, -z, x, eave, -z, 0, height, -z,
    -x, eave, z, x, eave, z, 0, height, z,
  ], 3));
  roofGeometry.setIndex([0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5]);
  roofGeometry.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeometry, material);
  roof.name = 'Beehive_RoofCollision';
  roof.userData.collidable = true;
  root.add(roof);
}

export async function addLandingBeehive(garden) {
  // Every tier uses the source bounds, so switching never changes size or grounding.
  const bounds = assetBounds('beehive');
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = BEEHIVE_PLACEMENT.height / size.y;
  const model = new THREE.Group();
  model.name = 'DreamyBeehive_AuthoredModel';
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  model.userData.collisionDisabled = true;
  const visual = createAssetVisual('beehive', model, tier => {
    tier.traverse(node => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.userData.collisionDisabled = true;
    });
  }, garden.userData.prepareVisual);

  const root = new THREE.Group();
  root.name = 'LandingBeehive';
  root.position.set(BEEHIVE_PLACEMENT.x, terrainHeight(BEEHIVE_PLACEMENT.x, BEEHIVE_PLACEMENT.z), BEEHIVE_PLACEMENT.z);
  root.rotation.y = BEEHIVE_PLACEMENT.yaw;
  root.add(model);
  const dimensions = { width: size.x * scale, height: size.y * scale, depth: size.z * scale };
  addCollisionHull(root, dimensions.width, dimensions.height, dimensions.depth);
  const bees = createBeeSwarm({ ...dimensions, count: 12 });
  root.add(bees.group);
  garden.userData.animateBees = seconds => { if (root.visible) bees.update(seconds); };
  garden.userData.beehive = root;
  root.userData.visualAsset = 'beehive';
  garden.userData.visualLods.push(visual);
  garden.add(root);
  await visual.ready;
  return root;
}
