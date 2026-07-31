import * as THREE from 'three';

// Simple astronaut explorer built from primitives (sphere helmet, cylinder body, thrusters)
export function createAstronaut(){
  const g = new THREE.Group(); g.name = 'Astronaut';

  // body
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd6e6f2, metalness: 0.4, roughness:0.4 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0x111133, emissive: 0x002244, emissiveIntensity:0.6, roughness: 0.05, metalness:0.8 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.3,0.7,12), bodyMat);
  torso.position.set(0,0.6,0); g.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32,24,16), helmetMat);
  head.position.set(0,1.05,0); g.add(head);

  // visor (slightly inset reflective plane)
  const visorGeo = new THREE.SphereGeometry(0.22,18,12);
  const visorMat = new THREE.MeshStandardMaterial({ color:0x334466, metalness:1.0, roughness:0.05, emissive:0x112233, emissiveIntensity:0.2 });
  const visor = new THREE.Mesh(visorGeo, visorMat); visor.position.set(0,1.05,0.18); visor.scale.set(1,0.8,1); g.add(visor);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36,0.44,0.14), new THREE.MeshStandardMaterial({ color:0x6b6bff, metalness:0.2 }));
  pack.position.set(0,0.8,-0.18); g.add(pack);

  // arms
  const armMat = new THREE.MeshStandardMaterial({ color:0xd6e6f2, metalness:0.2 });
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.4,8), armMat); leftArm.position.set(-0.35,0.9,0); leftArm.rotation.z = 0.4; g.add(leftArm);
  const rightArm = leftArm.clone(); rightArm.position.set(0.35,0.9,0); rightArm.rotation.z = -0.4; g.add(rightArm);

  // tiny thruster glow
  const thruster = new THREE.Mesh(new THREE.ConeGeometry(0.08,0.18,8), new THREE.MeshStandardMaterial({ color:0xff944d, emissive:0xff5522 }));
  thruster.position.set(0,0.35,0.25); thruster.rotation.x = Math.PI; g.add(thruster);

  // small shadow/indicator under feet
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.38,12), new THREE.MeshBasicMaterial({ color:0x000000, opacity:0.35, transparent:true }));
  disc.rotation.x = -Math.PI/2; disc.position.set(0,0.02,0); g.add(disc);

  // initial scale/offset
  g.position.set(0,1.0,8);
  return g;
}
