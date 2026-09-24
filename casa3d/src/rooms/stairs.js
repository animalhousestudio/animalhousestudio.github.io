import * as THREE from 'three';
import { BASE_FLOOR_Y as FLOOR_Y } from './layout.mjs';

export const INTERNAL_STAIR_RADIUS = 1.2;
export const INTERNAL_STAIR_TRAVEL_RADIUS = 1.32;
export const INTERNAL_STAIR_OPENING_RADIUS = 1.75;
export const INTERNAL_STAIR_FLOORS = FLOOR_Y;

// Spiral staircase spanning the exact runtime floor intervals. Each interval
// completes one turn, matching the travel animation and the floor openings.
export function createSpiralStairs(){
  const g = new THREE.Group(); g.name = 'SpiralStairs'; g.userData.isStairs = true;

  const steps = new THREE.Group();
  const stepMat = new THREE.MeshStandardMaterial({
    color: 0x765638,
    emissive: 0x211749,
    emissiveIntensity: 0,
    metalness: 0.45,
    roughness: 0.45,
  });
  const stepsPerFloor = 32;
  const stepGeometry = new THREE.BoxGeometry(0.78, 0.1, 0.32);
  for (let floorIndex = 0; floorIndex < INTERNAL_STAIR_FLOORS.length - 1; floorIndex++) {
    const floorY = INTERNAL_STAIR_FLOORS[floorIndex];
    const nextFloorY = INTERNAL_STAIR_FLOORS[floorIndex + 1];
    for (let stepIndex = 0; stepIndex < stepsPerFloor; stepIndex++) {
      const t = stepIndex / stepsPerFloor;
      const angle = (floorIndex + t) * Math.PI * 2;
      const step = new THREE.Mesh(stepGeometry, stepMat);
      step.position.set(
        Math.cos(angle) * INTERNAL_STAIR_RADIUS,
        THREE.MathUtils.lerp(floorY, nextFloorY, t),
        Math.sin(angle) * INTERNAL_STAIR_RADIUS,
      );
      step.rotation.y = -angle;
      step.userData.collidable = false;
      steps.add(step);
    }
  }
  g.add(steps);
  // expose steps group for highlighting
  steps.userData.isStepsGroup = true;

  // The last stair reaches the observatory floor. This bright landing is an
  // obvious, clickable return point when looking down from the observatory.
  const landing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.75, 1.75, 0.12, 24),
    new THREE.MeshStandardMaterial({
      color: 0x54d8d2,
      emissive: 0x144c69,
      emissiveIntensity: 0.8,
      metalness: 0.5,
      roughness: 0.28,
    })
  );
  landing.position.set(0, FLOOR_Y.at(-1) + .04, 0);
  landing.userData.isStairsLanding = true;
  g.add(landing);

  const returnMarker = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.65, 4),
    new THREE.MeshStandardMaterial({ color: 0xffd479, emissive: 0xa3425a, emissiveIntensity: 0.65 })
  );
  returnMarker.position.set(0, FLOOR_Y.at(-1) + .42, 0);
  returnMarker.rotation.x = Math.PI;
  returnMarker.userData.isStairsLanding = true;
  // The landing is the return target; no floating marker.

  // central pole - collidable for collision detection
  const height = INTERNAL_STAIR_FLOORS.at(-1) - INTERNAL_STAIR_FLOORS[0];
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, height, 12), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  pole.position.set(0, (INTERNAL_STAIR_FLOORS.at(-1) + INTERNAL_STAIR_FLOORS[0]) / 2, 0);
  pole.userData.collidable = true; // Make pole collidable
  g.add(pole);

  // Non-collidable helper retained for future proximity prompts.
  const bound = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, height, 24), new THREE.MeshStandardMaterial({ visible: false }));
  bound.position.set(0, (FLOOR_Y[0]+FLOOR_Y.at(-1))/2, 0); 
  bound.userData.collidable = false; 
  bound.userData.isStairsBound = true; 
  g.add(bound);

  const tapTarget = new THREE.Mesh(
    new THREE.CylinderGeometry(INTERNAL_STAIR_OPENING_RADIUS, INTERNAL_STAIR_OPENING_RADIUS, height, 24),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  tapTarget.name = 'StairsTapTarget';
  tapTarget.position.set(0, (FLOOR_Y[0]+FLOOR_Y.at(-1))/2, 0);
  tapTarget.userData.isStairsTapTarget = true;
  g.add(tapTarget);

  return g;
}
