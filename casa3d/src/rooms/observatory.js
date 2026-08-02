import * as THREE from 'three';
import { roundedBox, createHoledCeiling } from './roomShell.js';
export function createObservatory(){
  const g = new THREE.Group(); g.name='Observatory'; g.userData.roomName='Osservatorio';
  const y = 14.2;
  const width = 12, depth = 14, wallHeight = 5.45;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(width,0.2,depth), new THREE.MeshStandardMaterial({color:0x25254a, roughness:0.75})); floor.position.set(0,y,0); floor.userData.collidable=true; g.add(floor);

  // walls - softened corners (same bounding box/collision as a plain box)
  const wallMat = new THREE.MeshStandardMaterial({color:0x252645, roughness:0.8});
  const left = new THREE.Mesh(roundedBox(0.2,wallHeight,depth), wallMat); left.position.set(-width/2 - 0.1,y+wallHeight/2,0); left.userData.collidable=true; g.add(left);
  const right = left.clone(); right.position.set(width/2 + 0.1,y+wallHeight/2,0); g.add(right);
  const back = new THREE.Mesh(roundedBox(width,wallHeight,0.2), wallMat); back.position.set(0,y+wallHeight/2,-depth/2 - 0.1); back.userData.collidable=true; g.add(back);
  // front wall - previously missing entirely, which left most of the room
  // open straight to the void instead of just the glass dome above.
  const front = new THREE.Mesh(roundedBox(width,wallHeight,0.2), wallMat); front.position.set(0,y+wallHeight/2,depth/2 + 0.1); front.userData.collidable=true; g.add(front);

  // A small glowing window set into the front wall, echoing the reference
  // art's night-sky view from the telescope room. Purely decorative panel
  // layered in front of the solid (collidable) wall behind it.
  const windowMat = new THREE.MeshStandardMaterial({color:0x1a2c52, emissive:0x6fb8ff, emissiveIntensity:0.5, transparent:true, opacity:0.75});
  const window1 = new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.7), windowMat);
  window1.position.set(0, y+1.7, depth/2 + 0.03); window1.rotation.y = Math.PI; window1.userData.collidable=false; g.add(window1);

  // roof: a flat cap closed all the way to the walls, except a large round
  // opening in the middle where the glass dome sits - matching the
  // reference image's roofline-with-a-dome silhouette instead of a tiny
  // sphere floating with the whole front of the room left open.
  const domeHoleRadius = 4.4;
  const roof = createHoledCeiling(width, depth, domeHoleRadius, new THREE.MeshStandardMaterial({color:0x2e6b57, roughness:0.8}));
  roof.position.set(0, y+wallHeight, 0); g.add(roof);

  // dome ring: a short collar bridging the roof hole and the glass dome,
  // giving the opening a built silhouette rather than a bare cut edge.
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(domeHoleRadius+0.15, domeHoleRadius+0.15, 0.45, 28, 1, true),
    new THREE.MeshStandardMaterial({color:0x1c3d33, roughness:0.75, side:THREE.DoubleSide})
  );
  collar.position.set(0, y+wallHeight+0.22, 0); collar.userData.collidable=false; g.add(collar);

  // dome: large glass hemisphere that actually covers the roof opening,
  // reading as the observatory's signature glass cupola.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(domeHoleRadius+0.2, 32, 16, 0, Math.PI*2, 0, Math.PI/2),
    new THREE.MeshStandardMaterial({color:0x111331, emissive:0x36215b, emissiveIntensity:0.42, metalness:0.2, transparent:true, opacity:0.55, roughness:0.25, side:THREE.DoubleSide})
  );
  dome.position.set(0,y+wallHeight+0.45,0); dome.userData.collidable=false; g.add(dome);
  g.userData.shells = [left, right, back, front, roof, collar, dome];
  // thin ribs across the dome for a built, paned-glass look
  const ribMat = new THREE.MeshStandardMaterial({color:0x0d0e22, roughness:0.6});
  for (let i=0;i<8;i++){
    const a = (i/8) * Math.PI*2;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(domeHoleRadius+0.2, 0.035, 6, 16, Math.PI), ribMat);
    rib.rotation.x = Math.PI/2; rib.rotation.z = a; rib.position.set(0,y+wallHeight+0.45,0); rib.userData.collidable=false; g.add(rib);
  }

  // telescope
  const telescopeMat = new THREE.MeshStandardMaterial({color:0x1a1a1a, metalness:0.6, roughness:0.3});
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.3,3.4,16), telescopeMat);
  tube.rotation.z = Math.PI/2.2; tube.position.set(1.4,y+1.8,-1.2); tube.userData.collidable=true; g.add(tube);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.16,16), new THREE.MeshStandardMaterial({color:0x7ae7ff, emissive:0x136a93, emissiveIntensity:0.8, metalness:0.7}));
  lens.rotation.z=Math.PI/2.2; lens.position.set(2.9,y+2.48,-1.2); lens.userData.collidable=false; g.add(lens);
  for (const [x,z] of [[1.1,-1.7],[1.8,-1.7],[1.45,-0.55]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,1.8,8), telescopeMat); leg.position.set(x,y+0.9,z); leg.rotation.z=(x-1.45)*0.25; leg.userData.collidable=false; g.add(leg); }

  // desk + chair
  const deskMat = new THREE.MeshStandardMaterial({color:0x5a4a3a});
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.75,1.0), deskMat); desk.position.set(-3.8,y+0.6,3.7); desk.userData.collidable=true; g.add(desk);
  const chair = new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.58,0.75,8), new THREE.MeshStandardMaterial({color:0x8c5a9e})); chair.position.set(-3.8,y+0.38,5.0); chair.userData.collidable=true; g.add(chair);

  // Constellation panels evoke the illustrated planetarium interior.
  const panelMat = new THREE.MeshStandardMaterial({color:0x192441, emissive:0x263f83, emissiveIntensity:0.35});
  for (const x of [-3.8, -1.5, 1.5, 3.8]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.45,1.05,0.05), panelMat);
    panel.position.set(x,y+1.9,-depth/2+0.13); panel.userData.collidable=false; g.add(panel);
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.07,8,8), new THREE.MeshStandardMaterial({color:0xe6d9ff, emissive:0xa389ff, emissiveIntensity:1}));
    star.position.set(x,y+2.0,-depth/2+0.08); star.userData.collidable=false; g.add(star);
  }

  return g;
}
