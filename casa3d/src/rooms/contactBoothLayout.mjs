import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Vector3, Box3 } from 'three';
import { WORLD_SCALE } from './layout.mjs';
import { terrainHeight } from './terrainDetail.mjs';

export const CONTACT_BOOTH = Object.freeze({ x: -14, z: 193, yaw: .65, scale: 2, reach: 3 });
export function contactBoothClearing(x, z) {
  return Math.hypot(x * WORLD_SCALE - CONTACT_BOOTH.x, z * WORLD_SCALE - CONTACT_BOOTH.z) < 2.3 * CONTACT_BOOTH.scale;
}
export function createContactBoothRoot(model = null) {
  const root = new Group(); root.name = 'ContactBooth';
  root.position.set(CONTACT_BOOTH.x / WORLD_SCALE,
    terrainHeight(CONTACT_BOOTH.x / WORLD_SCALE, CONTACT_BOOTH.z / WORLD_SCALE), CONTACT_BOOTH.z / WORLD_SCALE);
  root.rotation.y = CONTACT_BOOTH.yaw; root.scale.setScalar(CONTACT_BOOTH.scale / WORLD_SCALE);
  root.userData.streamingBoundary = true; root.userData.roomName = 'Cabina dei telegrammi';
  // Include the outward door swing as well as the closed shell.
  root.userData.worldLocalBounds = new Box3(new Vector3(-1.05,0,-.85),new Vector3(.85,3.2,2.1));
  if (model) {
    model.userData.collisionDisabled = true;
    model.traverse(node => { if (node.isMesh) {
      node.userData.collisionDisabled = true; node.castShadow = true; node.receiveShadow = true;
    } });
    root.add(model);
  }
  // The open doorway is a portal. These supports never depend on visual LOD.
  for (const [name, size, position] of [
    ['Back',[1.6,2.8,.14],[0,1.4,-.72]],
    ['Left',[.14,2.8,1.5],[-.72,1.4,0]],
    ['Right',[.14,2.8,1.5],[.72,1.4,0]],
    ['Base',[1.64,.16,1.64],[0,.08,0]],
  ]) {
    const hull = new Mesh(new BoxGeometry(...size), new MeshBasicMaterial({ visible: false }));
    hull.name = `ContactBooth_Physics_${name}`; hull.position.set(...position);
    hull.userData.collidable = true; root.add(hull);
  }
  // The structure grows, while the interaction remains at the visitor's eye height.
  root.userData.entryTarget = new Vector3(0,1.65 / CONTACT_BOOTH.scale,1.05);
  return root;
}
export function contactBoothApproach(root, distance = 2.5, eyeHeight = 2) {
  root.updateWorldMatrix(true,false);
  const scale = root.getWorldScale(new Vector3());
  return root.localToWorld(new Vector3(0,eyeHeight / scale.y,.82 + distance / scale.z));
}
export function boothContainsVisitor(root, eye) {
  if (!root?.userData.ready) return false;
  root.updateWorldMatrix(true,false);
  const local = root.worldToLocal(eye.clone());
  const height = local.y * root.getWorldScale(new Vector3()).y;
  // Cross the front threshold inside the jambs, at a walking eye height.
  return Math.abs(local.x) < .56 && local.z < .82 && local.z > -.55
    && height > 1.1 && height < 3;
}
export function boothReachable(root, eye, blocked = false, lineOfSight = () => true) {
  if (!root?.userData.ready || blocked) return false;
  root.updateWorldMatrix(true,false);
  const local = root.worldToLocal(eye.clone());
  const target = root.localToWorld(root.userData.entryTarget.clone());
  return local.z > .65 && Math.abs(local.x) < 2.1 && eye.distanceTo(target) <= CONTACT_BOOTH.reach
    && lineOfSight(eye,target);
}
