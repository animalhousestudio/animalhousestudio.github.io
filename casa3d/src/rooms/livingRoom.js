import * as THREE from 'three';
import { createInvisibleBoundaryColliders, roundedBox } from './roomShell.js';
import logoUrl from '../assets/textures/animal-house-logo.png';
import introVideoUrl from '../assets/video/animal-house-intro.mp4';
export function createLivingRoom(){
  const g = new THREE.Group(); g.name='LivingRoom'; g.userData.roomName='Salotto';
  const y = 1.26;
  const width = 18, depth = 18, wallHeight = 5.95;
  // Keep a stable thin slab behind the Blender cutaway, while a separate
  // invisible collider preserves the exact playable top surface at y=1.05.
  const floorCollider = new THREE.Mesh(new THREE.PlaneGeometry(width,depth), new THREE.MeshBasicMaterial({visible:false})); floorCollider.rotation.x = -Math.PI / 2; floorCollider.position.set(0,y,0); floorCollider.userData.collidable=true; g.add(floorCollider);

  const boundaries = createInvisibleBoundaryColliders(width, depth, wallHeight, y);
  g.add(boundaries);
  g.userData.shells = [boundaries];

  // TV placed in front of the sofa. Its screen faces the sofa (toward -Z);
  // entering from the garden therefore first reveals the branded rear panel.
  const tvGroup = new THREE.Group();
  tvGroup.name = 'AnimalHouseTV';
  tvGroup.position.set(-1.1, y, 2.55);
  const tvFrameMat = new THREE.MeshStandardMaterial({ color:0x171827, metalness:0.55, roughness:0.3 });
  const tvBody = new THREE.Mesh(roundedBox(3.35, 1.95, 0.24, 0.13), tvFrameMat);
  tvBody.position.y = 1.65;
  tvBody.userData.collidable = true;
  tvGroup.add(tvBody);

  const video = document.createElement('video');
  video.src = introVideoUrl;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.autoplay = true;
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  videoTexture.minFilter = THREE.LinearFilter;
  tvGroup.userData.video = video;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(3.05, 1.68),
    new THREE.MeshBasicMaterial({ map:videoTexture, toneMapped:false }),
  );
  screen.position.set(0, 1.65, -0.125);
  screen.rotation.y = Math.PI;
  screen.userData.collidable = false;
  tvGroup.add(screen);
  video.addEventListener('canplay', () => {
    video.play().catch((error) => console.warn('TV video autoplay was blocked:', error));
  }, { once:true });
  video.load();

  const logoTexture = new THREE.TextureLoader().load(logoUrl);
  logoTexture.colorSpace = THREE.SRGBColorSpace;
  const rearLogo = new THREE.Mesh(
    new THREE.PlaneGeometry(1.62, 1.62),
    new THREE.MeshBasicMaterial({ map:logoTexture, transparent:true, toneMapped:false }),
  );
  rearLogo.position.set(0, 1.65, 0.126);
  rearLogo.userData.collidable = false;
  tvGroup.add(rearLogo);

  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.18, 16), tvFrameMat);
  stand.position.set(0, 0.18, 0);
  stand.userData.collidable = true;
  tvGroup.add(stand);
  tvGroup.userData.interactable = true;
  g.add(tvGroup);

  return g;
}
