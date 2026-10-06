import * as THREE from 'three';
import { createJetpackModel } from './jetpackModel.mjs';
import { JETPACK_PLACEMENT } from './arrivalLayout.mjs';
import { WORLD_SCALE } from './layout.mjs';
import { terrainHeight } from './terrainDetail.mjs';

export function addLandingJetpack(garden) {
  const root = new THREE.Group();
  root.name = 'LandingJetpack';
  root.userData.interactable = true;
  root.userData.collisionDisabled = true;
  root.userData.streamingBoundary = true;
  root.position.set(JETPACK_PLACEMENT.x, terrainHeight(JETPACK_PLACEMENT.x, JETPACK_PLACEMENT.z), JETPACK_PLACEMENT.z);
  root.rotation.y = JETPACK_PLACEMENT.yaw;
  root.scale.setScalar(1 / WORLD_SCALE);

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(.48, .53, .1, 32),
    new THREE.MeshStandardMaterial({ color: 0x283a3b, metalness: .65, roughness: .43 }));
  pad.name = 'JETPACK_Dock'; pad.position.y = .05;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.43, .015, 6, 40),
    new THREE.MeshBasicMaterial({ color: 0x82e9db }));
  ring.name = 'JETPACK_DockRing'; ring.rotation.x = Math.PI / 2; ring.position.y = .106;
  const model = createJetpackModel();
  model.root.position.y = .3;
  const hitTarget = new THREE.Mesh(new THREE.BoxGeometry(.88, 1.05, .55),
    new THREE.MeshBasicMaterial({ visible: false }));
  hitTarget.name = 'JETPACK_HitTarget';
  hitTarget.position.y = .79;
  root.add(pad, ring, model.root, hitTarget);
  root.traverse(node => { node.userData.collisionDisabled = true; });
  garden.add(root);
  garden.userData.jetpack = root;
  garden.userData.animateJetpack = seconds => {
    if (!root.visible) return;
    model.root.position.y = .3 + Math.sin(seconds * 2) * .045;
    model.root.rotation.y = Math.sin(seconds * .6) * .12;
    model.update(seconds);
  };
  return root;
}
