import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Shared helpers so every room can be fully enclosed with soft, consistent
// shapes without repeating the same boilerplate in each room file. Rooms
// still build themselves independently - these are just small building
// blocks (a rounded "wall box" and a ceiling with a circular hole).

// A softer alternative to plain BoxGeometry for the big, visible shapes
// (walls, roofs). Physics is unaffected: collision uses the mesh's bounding
// box, which is identical whether the corners are sharp or rounded.
export function roundedBox(width, height, depth, radius = 0.12){
  const r = Math.min(radius, width/2 - 0.01, height/2 - 0.01, depth/2 - 0.01);
  return new RoundedBoxGeometry(width, height, depth, 2, Math.max(0.01, r));
}

// Flat ceiling/roof cap with a circular hole in the middle (e.g. for the
// central stairwell shaft, or an observatory dome opening). Ceilings are
// visual only - never marked collidable - since every room's walls sit well
// below jumping height, so a real polygon hole is the simplest way to keep
// rooms enclosed while still letting the stairwell (or dome) read through.
export function createHoledCeiling(width, depth, holeRadius, material, segments = 40){
  const shape = new THREE.Shape();
  shape.moveTo(-width/2, -depth/2);
  shape.lineTo(width/2, -depth/2);
  shape.lineTo(width/2, depth/2);
  shape.lineTo(-width/2, depth/2);
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 0, holeRadius, 0, Math.PI*2, true);
  shape.holes.push(hole);

  const geo = new THREE.ShapeGeometry(shape, segments);
  material.side = THREE.DoubleSide; // visible from below (inside the room) and above
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = Math.PI/2; // lie flat, facing down into the room
  mesh.userData.collidable = false;
  return mesh;
}

export function createInvisibleBoundaryColliders(width, depth, height, floorY) {
  const group = new THREE.Group();
  group.name = 'InteriorBoundaryColliders';
  const material = new THREE.MeshBasicMaterial({ visible: false });
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, height, depth), material);
  side.position.set(-width / 2 - 0.1, floorY + height / 2, 0);
  side.userData.collidable = true;
  group.add(side);

  const oppositeSide = side.clone();
  oppositeSide.position.x = width / 2 + 0.1;
  group.add(oppositeSide);

  const rear = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.2), material);
  rear.position.set(0, floorY + height / 2, -depth / 2 - 0.1);
  rear.userData.collidable = true;
  group.add(rear);
  return group;
}
