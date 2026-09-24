import * as THREE from 'three';

export function createObservatory() {
  const room = new THREE.Group();
  room.name = 'Observatory';
  room.userData.roomName = 'Osservatorio';
  const y = 22.44;
  const width = 12, depth = 14, wallHeight = 5.45;
  const invisible = new THREE.MeshBasicMaterial({ visible: false });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), invisible);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = y;
  floor.userData.collidable = true;
  room.add(floor);
  const left = new THREE.Mesh(new THREE.BoxGeometry(.2, wallHeight, depth), invisible);
  left.position.set(-width / 2 - .1, y + wallHeight / 2, 0);
  left.userData.collidable = true;
  room.add(left);
  const right = left.clone(); right.position.x = width / 2 + .1; room.add(right);
  const back = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, .2), invisible);
  back.position.set(0, y + wallHeight / 2, -depth / 2 - .1);
  back.userData.collidable = true;
  room.add(back);
  const front = back.clone(); front.position.z = depth / 2 + .1; room.add(front);
  room.userData.shells = [left, right, back, front];
  return room;
}