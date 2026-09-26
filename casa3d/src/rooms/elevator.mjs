import * as THREE from 'three';
import { BASE_HOUSE_X, BASE_HOUSE_Z, BASE_FLOOR_Y, HOUSE_X, HOUSE_Z, FLOOR_Y, WORLD_SCALE, EYE_HEIGHT } from './layout.mjs';

// Authored dimensions are scaled by WORLD_SCALE: a 1.6 m cabin inside a 2.2 m
// shaft, with a 1 m entrance and 2.3 m clear cabin height.
export const ELEVATOR_CABIN_RADIUS = .16;
export const ELEVATOR_SHAFT_RADIUS = .22;
export const ELEVATOR_OPENING_RADIUS = .23;
export const ELEVATOR_SHAFT_HALF_WIDTH = ELEVATOR_SHAFT_RADIUS;
export const ELEVATOR_DOOR_WIDTH = .20;
export const ELEVATOR_LANDING_OFFSET = .36;
export const ELEVATOR_RADIAL_SEGMENTS = 24;
const CABIN_HEIGHT = .46;
const PLAYER_RADIUS = .35;
const DOOR_HALF_WIDTH = ELEVATOR_DOOR_WIDTH / 2;
const DOOR_HALF_ANGLE = Math.asin(DOOR_HALF_WIDTH / ELEVATOR_CABIN_RADIUS);
const SHAFT_DOOR_Z = Math.sqrt(ELEVATOR_SHAFT_RADIUS ** 2 - DOOR_HALF_WIDTH ** 2);

// Board through the +Z opening, ride on the cabin floor, then exit through the
// matching landing. Keep the player's whole capsule inside the circular floor.
export function createElevatorTravel(from, to, startPosition) {
  const source = new THREE.Vector3(HOUSE_X, FLOOR_Y[from] + EYE_HEIGHT, HOUSE_Z);
  const target = new THREE.Vector3(HOUSE_X, FLOOR_Y[to] + EYE_HEIGHT, HOUSE_Z);
  const landing = source.clone().add(new THREE.Vector3(0, 0, ELEVATOR_LANDING_OFFSET * WORLD_SCALE));
  const exit = target.clone().add(new THREE.Vector3(0, 0, ELEVATOR_LANDING_OFFSET * WORLD_SCALE));
  const insideRadius = ELEVATOR_CABIN_RADIUS * WORLD_SCALE
    * Math.cos(Math.PI / ELEVATOR_RADIAL_SEGMENTS) - PLAYER_RADIUS;
  const startRadius = Math.hypot(startPosition.x - HOUSE_X, startPosition.z - HOUSE_Z);
  const alreadyInside = startRadius <= insideRadius;
  if (alreadyInside) landing.copy(startPosition);
  // Approach around the outside of the shaft when called from its side/back.
  // A straight diagonal to the doorway would cut through the curved glass.
  const approachRadius = Math.max(startRadius, ELEVATOR_LANDING_OFFSET * WORLD_SCALE);
  const startAngle = Math.atan2(startPosition.x - HOUSE_X, startPosition.z - HOUSE_Z);
  const outwardDistance = approachRadius - startRadius;
  const arcDistance = Math.abs(startAngle) * approachRadius;
  const inwardDistance = approachRadius - ELEVATOR_LANDING_OFFSET * WORLD_SCALE;
  const approachDistance = outwardDistance + arcDistance + inwardDistance;
  const approachPosition = t => {
    if (t === 0) return startPosition.clone();
    if (t === 1) return landing.clone();
    if (alreadyInside || approachDistance < 1e-8) return startPosition.clone().lerp(landing, t);
    const distance = approachDistance * t;
    let radius = approachRadius, angle = startAngle;
    if (distance < outwardDistance) radius = startRadius + distance;
    else if (distance < outwardDistance + arcDistance) {
      angle *= 1 - (distance - outwardDistance) / arcDistance;
    } else {
      angle = 0;
      radius -= distance - outwardDistance - arcDistance;
    }
    return new THREE.Vector3(HOUSE_X + Math.sin(angle) * radius,
      THREE.MathUtils.lerp(startPosition.y, source.y, t), HOUSE_Z + Math.cos(angle) * radius);
  };
  const smooth = t => t * t * (3 - 2 * t);
  return {
    duration: 2600 + Math.abs(to - from) * 700,
    sample(progress) {
      const p = THREE.MathUtils.clamp(progress, 0, 1);
      let position, cabinY;
      if (p < .15) {
        position = approachPosition(smooth(p / .15));
        cabinY = BASE_FLOOR_Y[from];
      } else if (p < .3) {
        position = landing.clone().lerp(source, smooth((p - .15) / .15));
        cabinY = BASE_FLOOR_Y[from];
      } else if (p < .8) {
        const ride = smooth((p - .3) / .5);
        position = source.clone().lerp(target, ride);
        cabinY = THREE.MathUtils.lerp(BASE_FLOOR_Y[from], BASE_FLOOR_Y[to], ride);
      } else {
        position = target.clone().lerp(exit, smooth((p - .8) / .2));
        cabinY = BASE_FLOOR_Y[to];
      }
      return { position, cabinY };
    },
  };
}

// The Blender asset supplies the continuous transparent shaft and landings.
// The separate circular cabin moves without GLTF animation.
export function createElevator() {
  const group = new THREE.Group();
  group.name = 'TransparentElevator';
  group.position.set(BASE_HOUSE_X, 0, BASE_HOUSE_Z);
  group.userData.stops = BASE_FLOOR_Y.slice();
  group.userData.selectors = [];
  group.userData.createTravel = createElevatorTravel;

  const cabin = new THREE.Group();
  cabin.name = 'PlayableElevatorCabin';
  cabin.position.y = BASE_FLOOR_Y[0];
  const glass = new THREE.MeshStandardMaterial({
    color: 0x89cde0, transparent: true, opacity: .14,
    roughness: .13, metalness: .08, depthWrite: false,
    side: THREE.DoubleSide,
  });
  const frame = new THREE.MeshStandardMaterial({ color: 0x53636b, roughness: .24, metalness: .78 });
  const floor = new THREE.MeshStandardMaterial({ color: 0x566673, roughness: .45, metalness: .22 });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const addMesh = (parent, name, geometry, position, material) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = material !== glass;
    mesh.receiveShadow = true;
    mesh.userData.collidable = true;
    parent.add(mesh);
    return mesh;
  };
  const addBox = (parent, name, size, position, material) => {
    const mesh = addMesh(parent, name, unitBox, position, material);
    mesh.scale.set(...size);
    return mesh;
  };
  const r = ELEVATOR_CABIN_RADIUS, h = CABIN_HEIGHT, segments = ELEVATOR_RADIAL_SEGMENTS;
  const disc = new THREE.CylinderGeometry(r, r, 1, segments, 1);
  const cabinFloor = addMesh(cabin, 'ElevatorCabinFloor', disc, [0, -.012, 0], floor);
  cabinFloor.scale.y = .024;
  const cabinCeiling = addMesh(cabin, 'ElevatorCabinCeiling', disc, [0, h + .007, 0], frame);
  cabinCeiling.scale.y = .014;
  const wall = new THREE.CylinderGeometry(r, r, h, segments, 1, true,
    DOOR_HALF_ANGLE, Math.PI * 2 - DOOR_HALF_ANGLE * 2);
  addMesh(cabin, 'ElevatorCabinGlassCurved', wall, [0, h / 2, 0], glass);
  const ring = new THREE.CylinderGeometry(r + .002, r + .002, .012, segments, 1, true,
    DOOR_HALF_ANGLE, Math.PI * 2 - DOOR_HALF_ANGLE * 2);
  for (const [name, y] of [['Bottom', .006], ['Top', h - .006]]) {
    addMesh(cabin, `ElevatorCabinRing${name}`, ring, [0, y, 0], frame);
  }
  const entranceZ = Math.sqrt(r ** 2 - DOOR_HALF_WIDTH ** 2);
  for (const sign of [-1, 1]) {
    addBox(cabin, `ElevatorCabinEntrancePost_${sign}`, [.008, h, .008],
      [sign * (DOOR_HALF_WIDTH + .004), h / 2, entranceZ], frame);
  }
  addBox(cabin, 'ElevatorCabinEntranceLintel', [ELEVATOR_DOOR_WIDTH + .016, .01, .008],
    [0, h + .005, entranceZ], frame);
  group.add(cabin);

  // Curved landing leaves slide around the shaft, leaving the reclaimed floor
  // clear. Shared geometry needs only two radial segments per half-door.
  const landingGates = new THREE.Group();
  landingGates.name = 'ElevatorLandingGates';
  landingGates.userData.collisionDynamic = true;
  const gateRadius = ELEVATOR_SHAFT_RADIUS - .004;
  const gateAngle = Math.asin(DOOR_HALF_WIDTH / gateRadius);
  const gateSegments = Math.ceil(segments * gateAngle / (Math.PI * 2));
  const gateGlass = new THREE.CylinderGeometry(gateRadius, gateRadius, h,
    gateSegments, 1, true, 0, gateAngle);
  const gateRing = new THREE.CylinderGeometry(gateRadius + .001, gateRadius + .001, .006,
    gateSegments, 1, true, 0, gateAngle);
  const gateLeaves = [];
  BASE_FLOOR_Y.forEach((floorY, index) => {
    const gate = new THREE.Group();
    gate.name = `ElevatorLandingGate_${index}`;
    gate.position.y = floorY + .002;
    for (const sign of [-1, 1]) {
      const leaf = new THREE.Group();
      leaf.name = `ElevatorLandingGateLeaf_${index}_${sign}`;
      addMesh(leaf, `${leaf.name}_Glass`, gateGlass, [0, h / 2, 0], glass);
      addMesh(leaf, `${leaf.name}_RailBottom`, gateRing, [0, .003, 0], frame);
      addMesh(leaf, `${leaf.name}_RailTop`, gateRing, [0, h - .003, 0], frame);
      for (const [edge, angle] of [[0, 0], [1, gateAngle]]) {
        const post = addBox(leaf, `${leaf.name}_Edge_${edge}`, [.004, h, .004],
          [Math.sin(angle) * gateRadius, h / 2, Math.cos(angle) * gateRadius], frame);
        post.rotation.y = angle;
      }
      gate.add(leaf);
      gateLeaves.push({ leaf, sign, index });
    }
    landingGates.add(gate);
  });
  group.add(landingGates);
  group.userData.landingGates = landingGates;
  let servedLanding = null;
  group.userData.updateGates = () => {
    const nextLanding = BASE_FLOOR_Y.findIndex(y => Math.abs(cabin.position.y - y) < .002);
    if (nextLanding === servedLanding) return;
    servedLanding = nextLanding;
    for (const { leaf, sign, index } of gateLeaves) {
      const closedAngle = sign < 0 ? -gateAngle : 0;
      leaf.rotation.y = closedAngle + (index === servedLanding ? sign * (gateAngle + .025) : 0);
    }
    landingGates.updateMatrixWorld(true);
  };
  group.userData.updateGates();

  const panelMetal = new THREE.MeshStandardMaterial({ color: 0x8a8f92, roughness: .34, metalness: .72 });
  const panelBlack = new THREE.MeshStandardMaterial({ color: 0x05080d, roughness: .22, metalness: .28 });
  const selectorButton = new THREE.MeshStandardMaterial({ color: 0xb9c1c3, emissive: 0x1b4360,
    emissiveIntensity: .35, roughness: .2, metalness: .9 });
  const buttonGeometry = new THREE.CylinderGeometry(.027, .027, .012, 8, 1);
  const displayGeometry = new THREE.PlaneGeometry(.10, .072);
  const makeFloorTexture = label => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 48;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#63dcff';
    context.font = 'bold 34px monospace';
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.shadowColor = '#35a8ff'; context.shadowBlur = 6;
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  BASE_FLOOR_Y.forEach((floorY, index) => {
    const panel = new THREE.Group();
    panel.name = `ElevatorSelector_${String(index).padStart(2, '0')}`;
    // Controls are 22 x 45 cm and centred 1.28 m above each landing.
    panel.position.set(.155, floorY + 1.28 / WORLD_SCALE, SHAFT_DOOR_Z + .012);
    panel.scale.setScalar(1 / WORLD_SCALE);
    const selectable = mesh => {
      mesh.userData.isElevatorSelector = true;
      mesh.userData.elevatorFloor = index;
      return mesh;
    };
    const plate = selectable(addBox(panel, `ElevatorSelectorPlate_${index}`,
      [.22, .45, .035], [0, 0, 0], panelMetal));
    selectable(addBox(panel, `ElevatorSelectorDisplay_${index}`,
      [.14, .09, .012], [0, .13, .021], panelBlack));
    selectable(addMesh(panel, `ElevatorSelectorFloor_${index}`, displayGeometry,
      [0, .13, .028], new THREE.MeshBasicMaterial({
        map: makeFloorTexture(index === 0 ? 'B' : String(index - 1)), transparent: true, depthWrite: false,
      })));
    for (const [buttonName, y, direction] of [['Up', .015, 1], ['Down', -.095, -1]]) {
      const button = selectable(addMesh(panel, `ElevatorSelector_${buttonName}_${index}`,
        buttonGeometry, [0, y, .027], selectorButton));
      button.rotation.x = Math.PI / 2;
      button.userData.elevatorDirection = direction;
    }
    group.add(panel);
    group.userData.selectors.push(plate);
  });
  group.userData.cabin = cabin;
  group.userData.cabinHeight = h;
  group.userData.center = new THREE.Vector3(BASE_HOUSE_X, 0, BASE_HOUSE_Z);
  return group;
}
