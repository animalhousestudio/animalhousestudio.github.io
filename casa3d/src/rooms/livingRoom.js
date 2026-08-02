import * as THREE from 'three';
import { roundedBox, createHoledCeiling } from './roomShell.js';
import logoUrl from '../assets/textures/animal-house-logo.png';
import introVideoUrl from '../assets/video/animal-house-intro.mp4';
export function createLivingRoom(){
  const g = new THREE.Group(); g.name='LivingRoom'; g.userData.roomName='Salotto';
  const y = 1.05;
  const width = 18, depth = 18, wallHeight = 5.95;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(width,0.2,depth), new THREE.MeshStandardMaterial({color:0x314b5e, roughness:0.82})); floor.position.set(0,y,0); floor.userData.collidable=true; g.add(floor);

  // walls (leave front opening for entrance) - softened corners, same
  // bounding box/collision as a plain box.
  const wallMat = new THREE.MeshStandardMaterial({color:0x34425b, roughness:0.82});
  const left = new THREE.Mesh(roundedBox(0.2,wallHeight,depth), wallMat); left.position.set(-width/2 - 0.1,y+wallHeight/2,0); left.userData.collidable=true; g.add(left);
  const right = left.clone(); right.position.set(width/2 + 0.1,y+wallHeight/2,0); g.add(right);
  const back = new THREE.Mesh(roundedBox(width,wallHeight,0.2), wallMat); back.position.set(0,y+wallHeight/2,-depth/2 - 0.1); back.userData.collidable=true; g.add(back);
  // Match the Blender facade's door recess instead of overlaying a second door.
  const entranceWidth = 2.1;
  const entranceHeight = 4.55;
  const frontWidth = (width - entranceWidth) / 2;
  const frontLeft = new THREE.Mesh(roundedBox(frontWidth,wallHeight,0.2), wallMat); frontLeft.position.set(-(entranceWidth + frontWidth) / 2, y+wallHeight/2, depth/2 + 0.1); frontLeft.userData.collidable=true; g.add(frontLeft);
  const frontRight = new THREE.Mesh(roundedBox(frontWidth,wallHeight,0.2), wallMat); frontRight.position.set((entranceWidth + frontWidth) / 2, y+wallHeight/2, depth/2 + 0.1); frontRight.userData.collidable=true; g.add(frontRight);
  const frontHeader = new THREE.Mesh(roundedBox(entranceWidth,wallHeight-entranceHeight,0.2), wallMat);
  frontHeader.position.set(0, y+entranceHeight+(wallHeight-entranceHeight)/2, depth/2 + 0.1);
  frontHeader.userData.collidable=true;
  g.add(frontHeader);

  // ceiling: closed except the central stairwell shaft.
  const ceiling = createHoledCeiling(width, depth, 2.0, new THREE.MeshStandardMaterial({color:0x293852, roughness:0.88}));
  ceiling.position.set(0, y+wallHeight, 0); g.add(ceiling);
  g.userData.shells = [left, right, back, frontLeft, frontRight, frontHeader, ceiling];

  // sofa
  const sofaMat = new THREE.MeshStandardMaterial({color:0x804d91, roughness:0.65});
  const sofaSeat = new THREE.Mesh(new THREE.BoxGeometry(3.6,0.45,1.25), sofaMat); sofaSeat.position.set(-1.1,y+0.45,-1.2); sofaSeat.userData.collidable=true; g.add(sofaSeat);
  const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(3.6,0.9,0.26), sofaMat); sofaBack.position.set(-1.1,y+0.95,-1.72); sofaBack.userData.collidable=true; g.add(sofaBack);
  for (const x of [-2.15, -1.1, -0.05]) { const cushion = new THREE.Mesh(new THREE.SphereGeometry(0.42,12,8), new THREE.MeshStandardMaterial({color:0xd76f9d})); cushion.scale.set(1,0.55,1); cushion.position.set(x,y+0.78,-1.18); cushion.userData.collidable=false; g.add(cushion); }

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

  // bookshelf
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2,2.4,0.35), new THREE.MeshStandardMaterial({color:0x2b2542})); shelf.position.set(5.5,y+1.2, -4); shelf.userData.collidable=true; g.add(shelf);

  // fireplace
  const fire = new THREE.Mesh(new THREE.BoxGeometry(1.8,1.4,0.6), new THREE.MeshStandardMaterial({color:0x4c304b})); fire.position.set(-5.2,y+0.7,-5.5); fire.userData.collidable=true; g.add(fire);
  // small glowing flame accent inside the fireplace
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35,0.7,8), new THREE.MeshStandardMaterial({color:0xff7a1a, emissive:0xff1e9a, emissiveIntensity:1.1})); flame.position.set(-5.2,y+0.75,-5.14); flame.userData.collidable=false; g.add(flame);

  // coffee table in front of the sofa
  const coffeeTable = new THREE.Mesh(new THREE.CylinderGeometry(0.95,1.05,0.35,6), new THREE.MeshStandardMaterial({color:0x3ec1b8, metalness:0.25})); coffeeTable.position.set(-1.1,y+0.18,0.9); coffeeTable.userData.collidable=true; g.add(coffeeTable);

  // area rug under the coffee table
  const rug = new THREE.Mesh(new THREE.CircleGeometry(3.5,32), new THREE.MeshStandardMaterial({color:0x245776, roughness:0.9})); rug.rotation.x=-Math.PI/2; rug.position.set(-1.1,y+0.011,0.9); rug.userData.collidable=false; g.add(rug);

  // second bookshelf on the other side of the room
  const shelf2 = new THREE.Mesh(new THREE.BoxGeometry(1.2,2.4,0.35), new THREE.MeshStandardMaterial({color:0x2b2542})); shelf2.position.set(5.5,y+1.2,-1.8); shelf2.userData.collidable=true; g.add(shelf2);

  return g;
}
