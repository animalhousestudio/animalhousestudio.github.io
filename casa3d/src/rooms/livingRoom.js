import * as THREE from 'three';
import { createInvisibleBoundaryColliders } from './roomShell.js';

export function createLivingRoom() {
  const room = new THREE.Group();
  room.name = 'LivingRoom';
  room.userData.roomName = 'Salotto';
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshBasicMaterial({ visible: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 1.26;
  floor.userData.collidable = true;
  room.add(floor);
  const boundaries = createInvisibleBoundaryColliders(18, 18, 5.95, 1.26);
  room.add(boundaries);
  room.userData.shells = [boundaries];
  return room;
}