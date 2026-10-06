import * as THREE from 'three';

// Authored in metres. The nozzle mouths sit at y=0; the display face points +Z.
// Rotate the worn instance by PI so the padded harness faces the character.
const palette = {
  ivory: new THREE.MeshStandardMaterial({ color: 0xe8dfc5, roughness: .38, metalness: .24 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xba7750, roughness: .29, metalness: .78 }),
  edge: new THREE.MeshStandardMaterial({ color: 0xe2b18a, roughness: .24, metalness: .8 }),
  graphite: new THREE.MeshStandardMaterial({ color: 0x26343a, roughness: .52, metalness: .52 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x152329, roughness: .9, metalness: .05 }),
  black: new THREE.MeshStandardMaterial({ color: 0x091519, roughness: .78, metalness: .25 }),
};
const geometry = {
  box: new THREE.BoxGeometry(1, 1, 1),
  tank: new THREE.CapsuleGeometry(.119, .39, 5, 16),
  collar: new THREE.CylinderGeometry(.125, .125, .055, 16),
  neck: new THREE.CylinderGeometry(.064, .075, .095, 12),
  nozzle: new THREE.CylinderGeometry(.076, .12, .13, 16, 1, true),
  mouth: new THREE.TorusGeometry(.113, .012, 5, 16),
  throat: new THREE.CylinderGeometry(.079, .094, .05, 16),
  bolt: new THREE.CylinderGeometry(.013, .013, .012, 6),
  cap: new THREE.CylinderGeometry(.048, .048, .02, 12),
  core: new THREE.CylinderGeometry(.067, .067, .027, 20),
  coreRim: new THREE.TorusGeometry(.074, .008, 5, 20),
  flame: new THREE.ConeGeometry(.079, 1, 10, 1, true),
};

function tube(points, radius = .016) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 16, radius, 6, false);
}

// Repeated tanks, fittings and both instances share geometry and static materials.
const hoses = [-1, 1].map(side => tube([
  [side * .22, .83, .045], [side * .325, .77, .04],
  [side * .35, .54, .025], [side * .325, .29, .045], [side * .21, .2, .05],
]));
const straps = [-1, 1].map(side => tube([
  [side * .145, .84, -.08], [side * .15, .82, -.16],
  [side * .155, .66, -.205], [side * .15, .4, -.2], [side * .13, .29, -.085],
], .023));

export function createJetpackModel() {
  const root = new THREE.Group();
  root.name = 'Jetpack_Visual';
  root.userData.collisionDisabled = true;
  root.userData.authoredHeight = .95;
  root.userData.displayFace = '+Z';
  const teal = new THREE.MeshStandardMaterial({ color: 0x6af3dd, emissive: 0x32d9c3, emissiveIntensity: .7, roughness: .24, metalness: .18 });
  const flameOuter = new THREE.MeshBasicMaterial({ color: 0x22bba8, transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const flameInner = new THREE.MeshBasicMaterial({ color: 0xcdfff2, transparent: true, opacity: .88, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const plumes = [];

  function mesh(name, shape, material, position, scale = null, parent = root) {
    const node = new THREE.Mesh(shape, material);
    node.name = `Jetpack_${name}`;
    node.position.set(...position);
    if (scale) node.scale.set(...scale);
    node.castShadow = true;
    node.receiveShadow = true;
    node.userData.collisionDisabled = true;
    parent.add(node);
    return node;
  }
  const box = (name, material, position, scale) => mesh(name, geometry.box, material, position, scale);

  box('HarnessSpine', palette.graphite, [0, .55, -.071], [.28, .69, .082]);
  box('BackPadding', palette.rubber, [0, .535, -.123], [.245, .51, .032]);
  box('UpperCrossbar', palette.graphite, [0, .77, -.037], [.58, .055, .078]);
  box('LowerCrossbar', palette.graphite, [0, .32, -.037], [.57, .05, .076]);
  box('CarryHandleLeft', palette.copper, [-.084, .879, -.025], [.027, .104, .035]);
  box('CarryHandleRight', palette.copper, [.084, .879, -.025], [.027, .104, .035]);
  box('CarryHandleGrip', palette.rubber, [0, .927, -.025], [.196, .032, .04]);

  for (const [index, side] of [-1, 1].entries()) {
    const x = side * .226, label = side < 0 ? 'Left' : 'Right';
    mesh(`${label}_IvoryTank`, geometry.tank, palette.ivory, [x, .56, 0]);
    for (const [level, y] of [.349, .767].entries()) {
      mesh(`${label}_CopperBand${level}`, geometry.collar, palette.copper, [x, y, 0]);
      box(`${label}_BandBuckle${level}`, palette.edge, [x, y, .13], [.054, .069, .02]);
      const bolt = mesh(`${label}_BandFastener${level}`, geometry.bolt, palette.graphite, [x, y, .146]);
      bolt.rotation.x = Math.PI / 2;
    }
    mesh(`${label}_CrownValve`, geometry.cap, palette.copper, [x, .884, 0]);
    mesh(`${label}_CrownValveInset`, geometry.cap, palette.graphite, [x, .899, 0], [.64, .7, .64]);
    mesh(`${label}_EngineNeck`, geometry.neck, palette.graphite, [x, .222, 0]);
    mesh(`${label}_NozzleBell`, geometry.nozzle, palette.copper, [x, .077, 0]);
    mesh(`${label}_NozzleThroat`, geometry.throat, palette.black, [x, .08, 0]);
    const rim = mesh(`${label}_NozzleLip`, geometry.mouth, palette.edge, [x, .012, 0]);
    rim.rotation.x = Math.PI / 2;
    mesh(`${label}_FuelHose`, hoses[index], palette.rubber, [0, 0, 0]);
    mesh(`${label}_ShoulderStrap`, straps[index], palette.rubber, [0, 0, 0]);
    box(`${label}_StrapBuckle`, palette.copper, [side * .15, .442, -.205], [.067, .071, .031]);
    box(`${label}_TankLightSocket`, palette.graphite, [x, .56, .116], [.038, .244, .025]);
    box(`${label}_TankLight`, teal, [x, .56, .133], [.013, .212, .009]);
    for (let rib = 0; rib < 3; rib++) {
      box(`${label}_EngineFin${rib}`, palette.graphite, [x, .164 + rib * .019, 0], [.174, .011, .144]);
    }
    const plume = new THREE.Group();
    plume.name = `Jetpack_${label}_Exhaust`;
    plume.userData.collisionDisabled = true;
    plume.position.set(x, .003, 0);
    plume.visible = false;
    root.add(plume);
    const outer = mesh(`${label}_FlameOuter`, geometry.flame, flameOuter, [0, -.5, 0], [1, 1, 1], plume);
    const inner = mesh(`${label}_FlameInner`, geometry.flame, flameInner, [0, -.35, 0], [.52, .7, .52], plume);
    outer.rotation.z = inner.rotation.z = Math.PI;
    outer.castShadow = inner.castShadow = outer.receiveShadow = inner.receiveShadow = false;
    plumes.push(plume);
  }

  // Raised central instrument housing bridges the two independent thrusters.
  box('ControlHousing', palette.graphite, [0, .575, .062], [.177, .4, .132]);
  box('ControlFaceTrim', palette.copper, [0, .585, .133], [.19, .307, .025]);
  box('ControlFace', palette.black, [0, .585, .15], [.169, .286, .021]);
  const core = mesh('ReactorLens', geometry.core, teal, [0, .626, .174]);
  core.rotation.x = Math.PI / 2;
  mesh('ReactorRim', geometry.coreRim, palette.edge, [0, .626, .191]);
  box('ReactorLensBridge', palette.graphite, [0, .626, .193], [.018, .137, .014]);
  for (let bar = 0; bar < 3; bar++) {
    box(`ChargeMeter${bar}`, teal, [0, .49 + bar * .027, .17], [.065 + bar * .015, .01, .012]);
  }
  const chevronLeft = box('IvoryChevronLeft', palette.ivory, [-.022, .763, .139], [.015, .075, .017]);
  const chevronRight = box('IvoryChevronRight', palette.ivory, [.022, .763, .139], [.015, .075, .017]);
  chevronLeft.rotation.z = -.61;
  chevronRight.rotation.z = .61;
  for (const side of [-1, 1]) {
    const bolt = mesh(`FaceFastener${side}`, geometry.bolt, palette.edge, [side * .065, .459, .17]);
    bolt.rotation.x = Math.PI / 2;
  }

  function update(seconds, { enabled = false, thrusting = false, boost = false } = {}) {
    const time = Number.isFinite(seconds) ? seconds : 0;
    teal.emissiveIntensity = enabled ? 1.5 + Math.sin(time * 4) * .12 : .48 + Math.sin(time * 1.8) * .07;
    for (let index = 0; index < plumes.length; index++) {
      const plume = plumes[index];
      plume.visible = enabled && thrusting;
      if (!plume.visible) continue;
      const flicker = 1 + Math.sin(time * 39 + index * 1.7) * .065 + Math.sin(time * 67) * .035;
      const length = (boost ? .54 : .31) * flicker;
      plume.scale.set(boost ? 1.16 : .94, length, boost ? 1.16 : .94);
    }
  }
  update(0);
  return { root, update };
}
