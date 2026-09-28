import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Matrix4, Mesh, MeshStandardMaterial, ShapeUtils, Vector2, Vector3 } from 'three';
import { WORLD_SCALE } from './layout.mjs';

export const TOWER_OPENING_RADIUS = .8 / WORLD_SCALE;
export const TOWER_POLE_RADIUS = .035 / WORLD_SCALE;
const EPSILON = 1e-5;
const SPECS = [
  { side: 'East', prefix: '', roof: 'M01_Tower_WitchHat' },
  { side: 'West', prefix: 'M04_WestTurret_', roof: 'M04_WestTurret_M01_Tower_WitchHat' },
];

function pointsOf(node, matrix) {
  const position = node.geometry.attributes.position, points = [];
  for (let i = 0; i < position.count; i++) points.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(matrix));
  return points;
}

function topOutline(points) {
  const y = Math.max(...points.map(point => point.y)), unique = new Map();
  for (const point of points) if (Math.abs(point.y - y) < EPSILON) unique.set(`${point.x.toFixed(5)},${point.z.toFixed(5)}`, point.clone());
  const ring = [...unique.values()], center = ring.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(ring.length);
  ring.sort((a, b) => Math.atan2(a.z - center.z, a.x - center.x) - Math.atan2(b.z - center.z, b.x - center.x));
  return { ring, center, y };
}

function addTriangle(positions, a, b, c, desired) {
  const normal = new Vector3().crossVectors(new Vector3().subVectors(b, a), new Vector3().subVectors(c, a));
  if (desired && normal.dot(desired) < 0) [b, c] = [c, b];
  positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
}

function addFace(positions, outer, inner, y, up = true) {
  const contour = outer.map(point => new Vector2(point.x, point.z));
  const hole = inner.map(point => new Vector2(point.x, point.z));
  const points = [...outer, ...inner].map(point => new Vector3(point.x, y, point.z));
  const normal = new Vector3(0, up ? 1 : -1, 0);
  for (const [a, b, c] of ShapeUtils.triangulateShape(contour, hole.length ? [hole] : [])) addTriangle(positions, points[a], points[b], points[c], normal);
}

function addSides(positions, ring, bottom, top, center, inward = false) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const normal = new Vector3((a.x + b.x) / 2 - center.x, 0, (a.z + b.z) / 2 - center.z).multiplyScalar(inward ? -1 : 1);
    const lowA = new Vector3(a.x, bottom, a.z), lowB = new Vector3(b.x, bottom, b.z);
    const highA = new Vector3(a.x, top, a.z), highB = new Vector3(b.x, top, b.z);
    addTriangle(positions, lowA, lowB, highB, normal);
    addTriangle(positions, lowA, highB, highA, normal);
  }
}

function installGeometry(node, positions, relative) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const uv = [];
  for (let i = 0; i < positions.length; i += 3) uv.push(positions[i], positions[i + 2]);
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  // Work in house coordinates but preserve the authored mesh's transform.
  geometry.applyMatrix4(relative.clone().invert());
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  node.geometry = geometry;
}

function openFloor(node, points, relative) {
  const { ring, center, y: top } = topOutline(points), bottom = Math.min(...points.map(point => point.y));
  const hole = Array.from({ length: 32 }, (_, i) => {
    const angle = i * Math.PI * 2 / 32;
    return new Vector3(center.x + Math.cos(angle) * TOWER_OPENING_RADIUS, top, center.z + Math.sin(angle) * TOWER_OPENING_RADIUS);
  });
  const positions = [];
  addFace(positions, ring, hole, top); addFace(positions, ring, hole, bottom, false);
  addSides(positions, ring, bottom, top, center); addSides(positions, hole, bottom, top, center, true);
  installGeometry(node, positions, relative);
}

function uncoverBottomFloor(base, points, relative, floorOutline) {
  const { ring: outer, y: oldTop } = topOutline(points), positions = [], index = base.geometry.index;
  const count = index?.count ?? points.length;
  for (let i = 0; i < count; i += 3) {
    const triangle = [0, 1, 2].map(offset => points[index ? index.getX(i + offset) : i + offset]);
    // Only the six cap triangles overlap the walking slab. The external
    // taper and bottom closure remain, with the west lip lowered to the slab.
    if (triangle.every(point => Math.abs(point.y - oldTop) < EPSILON)) continue;
    addTriangle(positions, ...triangle.map(point => {
      const next = point.clone(); if (Math.abs(next.y - oldTop) < EPSILON) next.y = floorOutline.y; return next;
    }));
  }
  addFace(positions, outer, floorOutline.ring, floorOutline.y);
  installGeometry(base, positions, relative);
}

/** Refine the imported static tower meshes before collision capture/batching. */
export function refineTowerFloors(exterior) {
  if (exterior.userData.towerFloorRefinement) return exterior.userData.towerFloorRefinement;
  exterior.updateWorldMatrix(true, true);
  const inverse = exterior.matrixWorld.clone().invert(), towers = [];
  const brass = new MeshStandardMaterial({ name: 'Tower_SatinBrass', color: 0xb49458, metalness: .68, roughness: .4 });
  for (const spec of SPECS) {
    const names = ['', '001', '002'].map(suffix => `${spec.prefix}M03_Tower_Floor${suffix}`);
    const floors = names.map(name => exterior.getObjectByName(name));
    const base = exterior.getObjectByName(`${spec.prefix}M03_Tower_ClosedBase`), roof = exterior.getObjectByName(spec.roof);
    if (!base?.isMesh || !roof?.isMesh || floors.some(node => !node?.isMesh)) continue;
    const relative = node => new Matrix4().multiplyMatrices(inverse, node.matrixWorld);
    const floorData = floors.map(node => { const matrix = relative(node); return { matrix, points: pointsOf(node, matrix) }; });
    const outlines = floorData.map(data => topOutline(data.points)), bottom = outlines[0];
    uncoverBottomFloor(base, pointsOf(base, relative(base)), relative(base), bottom);
    for (let i = 1; i < floors.length; i++) openFloor(floors[i], floorData[i].points, floorData[i].matrix);

    const roofPoints = pointsOf(roof, relative(roof));
    const roofTop = Math.max(...roofPoints.map(point => point.y));
    const topRing = roofPoints.filter(point => Math.abs(point.y - roofTop) < EPSILON);
    const socketRadius = Math.max(TOWER_POLE_RADIUS * 2, ...topRing.map(point => Math.hypot(point.x - bottom.center.x, point.z - bottom.center.z))) + .002;
    const pole = new Mesh(new CylinderGeometry(TOWER_POLE_RADIUS, TOWER_POLE_RADIUS, roofTop - bottom.y, 16), brass);
    pole.name = `Tower_FirePole_${spec.side}`;
    pole.position.set(bottom.center.x, (bottom.y + roofTop) / 2, bottom.center.z);
    pole.castShadow = true; pole.receiveShadow = true;
    exterior.add(pole);
    // The roof ends in an open, tiny ring. Its mounting collar bridges that
    // ring rather than leaving the pole visibly floating below the cone.
    for (const [end, y, radius] of [['Base', bottom.y + .003, .018], ['Roof', roofTop - .003, socketRadius]]) {
      const collar = new Mesh(new CylinderGeometry(radius, radius, .006, 16), brass);
      collar.name = `Tower_FirePole_${spec.side}_${end}Mount`; collar.position.set(bottom.center.x, y, bottom.center.z);
      collar.castShadow = true; collar.receiveShadow = true; exterior.add(collar);
    }
    towers.push({ side: spec.side, center: [bottom.center.x, bottom.center.z], floors: names, levels: outlines.map(outline => outline.y),
      openingRadius: TOWER_OPENING_RADIUS, poleRadius: TOWER_POLE_RADIUS, pole: pole.name, poleTop: roofTop });
  }
  exterior.updateWorldMatrix(true, true);
  const result = { towers, openedFloors: towers.length * 2, repairedBases: towers.length, poles: towers.length };
  exterior.userData.towerFloorRefinement = result;
  return result;
}
