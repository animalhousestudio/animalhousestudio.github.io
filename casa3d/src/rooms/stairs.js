import * as THREE from 'three';

// Spiral staircase spanning multiple floors. Built from simple boxes and a central pole.
export function createSpiralStairs(){
  const g = new THREE.Group(); g.name = 'SpiralStairs'; g.userData.isStairs = true;

  const steps = new THREE.Group();
  const stepMat = new THREE.MeshStandardMaterial({
    color: 0x715bb5,
    emissive: 0x211749,
    emissiveIntensity: 0.35,
    metalness: 0.45,
    roughness: 0.45,
  });
  const count = 60; // number of steps
  const height = 10.4; // total height
  for (let i = 0; i < count; i++){
    const t = i / (count - 1);
    const angle = t * Math.PI * 2 * 2.0; // two full turns
    const radius = 1.35;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = -4.0 + t * height; // basement (-4.0) to observatory (6.4)
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.1, 0.3), stepMat);
    step.position.set(x, y, z);
    step.rotation.y = -angle;
    step.userData.collidable = false;
    steps.add(step);
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
  landing.position.set(0, 6.48, 0);
  landing.userData.isStairsLanding = true;
  g.add(landing);

  const returnMarker = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.65, 4),
    new THREE.MeshStandardMaterial({ color: 0xffd479, emissive: 0xa3425a, emissiveIntensity: 0.65 })
  );
  returnMarker.position.set(0, 6.86, 0);
  returnMarker.rotation.x = Math.PI;
  returnMarker.userData.isStairsLanding = true;
  g.add(returnMarker);

  // central pole - collidable for collision detection
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 10.4, 12), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  pole.position.set(0, 1.2, 0);
  pole.userData.collidable = true; // Make pole collidable
  g.add(pole);

  // Non-collidable helper retained for future proximity prompts.
  const bound = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 10.4, 24), new THREE.MeshStandardMaterial({ visible: false }));
  bound.position.set(0, 1.2, 0); 
  bound.userData.collidable = false; 
  bound.userData.isStairsBound = true; 
  g.add(bound);

  return g;
}
