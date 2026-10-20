import { CylinderGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { WORLD_SCALE } from './layout.mjs';
import { LOLLIPOP_BASKET_PLACEMENT } from './arrivalLayout.mjs';
import { terrainHeight } from './terrainDetail.mjs';

export function createLollipopBasketRoot(model = null) {
  const root = new Group(); root.name = 'LollipopBasket';
  root.userData.roomName = 'Cesto di leccalecca';
  root.userData.streamingBoundary = true;
  root.userData.interactable = true;
  root.position.set(LOLLIPOP_BASKET_PLACEMENT.x,
    terrainHeight(LOLLIPOP_BASKET_PLACEMENT.x, LOLLIPOP_BASKET_PLACEMENT.z), LOLLIPOP_BASKET_PLACEMENT.z);
  root.rotation.y = LOLLIPOP_BASKET_PLACEMENT.yaw;
  root.scale.setScalar(1 / WORLD_SCALE);
  if (model) {
    model.name = 'LollipopBasket_Visual';
    model.userData.collisionDisabled = true;
    model.traverse(node => {
      if (!node.isMesh) return;
      node.userData.collisionDisabled = true;
      node.castShadow = true; node.receiveShadow = true;
    });
    root.add(model);
  }
  const hull = new Mesh(new CylinderGeometry(.57, .48, .65, 20), new MeshBasicMaterial({ visible: false }));
  hull.name = 'LollipopBasket_Physics'; hull.position.y = .325;
  hull.userData.collidable = true;
  root.add(hull);
  return root;
}
