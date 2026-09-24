import * as THREE from 'three';
import { BASE_HOUSE_X, BASE_HOUSE_Z, BASE_FLOOR_Y } from './layout.mjs';

// The Blender v05 asset supplies the transparent shaft and landings. This
// runtime cabin is separate so the game can move it without GLTF animation.
export function createElevator() {
  const group = new THREE.Group();
  group.name = 'TransparentElevator';
  group.position.set(BASE_HOUSE_X, 0, BASE_HOUSE_Z);
  group.userData.stops = BASE_FLOOR_Y.slice();
  group.userData.selectors = [];

  const cabin = new THREE.Group();
  cabin.name = 'PlayableElevatorCabin';
  cabin.position.y = BASE_FLOOR_Y[0] + 0.12;
  const glass = new THREE.MeshStandardMaterial({
    color: 0x5ac8ef, transparent: true, opacity: 0.18,
    roughness: 0.16, metalness: 0.08, depthWrite: false,
    side: THREE.DoubleSide,
  });
  const frame = new THREE.MeshStandardMaterial({ color: 0x172735, roughness: 0.24, metalness: 0.78 });
  const floor = new THREE.MeshStandardMaterial({ color: 0x566673, roughness: 0.45, metalness: 0.22 });
  const addBox = (name, size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    cabin.add(mesh);
    return mesh;
  };
  const w = 2.2, h = 2.55, t = 0.08;
  addBox('ElevatorCabinFloor', [w, 0.12, w], [0, 0.06, 0], floor);
  addBox('ElevatorCabinCeiling', [w, 0.10, w], [0, h, 0], frame);
  addBox('ElevatorCabinGlassWest', [t, h, w], [-w / 2, h / 2, 0], glass);
  addBox('ElevatorCabinGlassEast', [t, h, w], [w / 2, h / 2, 0], glass);
  addBox('ElevatorCabinGlassNorth', [w, h, t], [0, h / 2, w / 2], glass);
  addBox('ElevatorCabinGlassSouth', [w, h, t], [0, h / 2, -w / 2], glass);
  group.add(cabin);

  // Compact landing selector at every stop: boxes, cylinders and a small
  // emissive display keep it readable without adding heavy geometry.
  const panelMetal = new THREE.MeshStandardMaterial({ color: 0x8a8f92, roughness: 0.34, metalness: 0.72 });
  const panelBlack = new THREE.MeshStandardMaterial({ color: 0x05080d, roughness: 0.22, metalness: 0.28 });
  const panelGlow = new THREE.MeshStandardMaterial({ color: 0x63dcff, emissive: 0x35a8ff, emissiveIntensity: 1.7, roughness: 0.18, metalness: 0.05 });
  const selectorButton = new THREE.MeshStandardMaterial({ color: 0xb9c1c3, emissive: 0x1b4360, emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.9 });
  const addPanelBox = (parent, name, size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const makeFloorTexture = (label) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 96;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#63dcff';
    context.font = 'bold 68px monospace';
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.shadowColor = '#35a8ff'; context.shadowBlur = 12;
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  BASE_FLOOR_Y.forEach((floorY, index) => {
    const panel = new THREE.Group();
    panel.name = `ElevatorSelector_${String(index).padStart(2, '0')}`;
    panel.position.set(0, floorY + 1.28, 2.06);
    const plate = addPanelBox(panel, `ElevatorSelectorPlate_${index}`, [0.86, 1.58, 0.12], [0, 0, 0], panelMetal);
    plate.userData.isElevatorSelector = true;
    plate.userData.elevatorFloor = index;
    const display = addPanelBox(panel, `ElevatorSelectorDisplay_${index}`, [0.56, 0.30, 0.045], [0, 0.46, 0.082], panelBlack);
    display.userData.isElevatorSelector = true;
    const displayGlow = addPanelBox(panel, `ElevatorSelectorFloor_${index}`, [0.30, 0.24, 0.052], [0, 0.46, 0.108], panelGlow);
    displayGlow.material = new THREE.MeshBasicMaterial({ map: makeFloorTexture(index === 0 ? 'B' : String(index - 1)), transparent: true, depthWrite: false });
    displayGlow.userData.isElevatorSelector = true;
    for (const [buttonName, y, direction] of [['Up', 0.06, 1], ['Down', -0.30, -1]]) {
      const button = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 16), selectorButton);
      button.name = `ElevatorSelector_${buttonName}_${index}`;
      button.rotation.x = -Math.PI / 2;
      button.position.set(0, y, 0.11);
      button.userData.isElevatorSelector = true;
      button.userData.elevatorFloor = index;
      button.userData.elevatorDirection = direction;
      panel.add(button);
    }
    group.add(panel);
    group.userData.selectors.push(plate);
  });
  group.userData.cabin = cabin;
  group.userData.cabinHeight = h;
  group.userData.center = new THREE.Vector3(BASE_HOUSE_X, 0, BASE_HOUSE_Z);
  return group;
}
