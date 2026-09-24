import * as THREE from 'three';
import { createInvisibleBoundaryColliders } from './roomShell.js';

export function createUpperGallery() {
  const room = new THREE.Group();
  room.name = 'UpperGallery';
  room.userData.roomName = 'Galleria';
  const y = 17.04;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(15, 12), new THREE.MeshBasicMaterial({ visible: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = y;
  floor.userData.collidable = true;
  room.add(floor);
  const boundaries = createInvisibleBoundaryColliders(15, 12, 5.15, y);
  room.add(boundaries);
  room.userData.shells = [boundaries];
  return room;
}
