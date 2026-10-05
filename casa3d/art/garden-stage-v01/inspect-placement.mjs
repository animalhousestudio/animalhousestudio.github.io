// Reproduce the local stage placement against the actual asteroid GLB perimeter.
// Run from any directory: node casa3d/art/garden-stage-v01/inspect-placement.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Box3, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { surfaceBoundary, containsSurface } from '../../src/rooms/asteroid.mjs';
import { terrainHeight } from '../../src/rooms/terrainDetail.mjs';
import { WORLD_SCALE, BASE_HOUSE_X, BASE_HOUSE_Z } from '../../src/rooms/layout.mjs';
import { createTreeTemplates, selectTreePlacements } from '../../src/rooms/treePlacement.mjs';
import { createRockTemplate, naturalRockTransform } from '../../src/rooms/rockPlacement.mjs';
import { naturalRockPlacements, isRockFootprintClear, PITCH_CLEARANCE } from '../../src/rooms/rockLayout.mjs';
import { gardenBorderClear } from '../../src/rooms/landscapeLayout.mjs';

const root = new URL('../../', import.meta.url);
const stagePath = 'src/assets/models/props/garden-stage.glb';
const asteroidPath = 'src/assets/models/asteroid.glb';
const rayInput = [-.88654025, .46265147];
const rayLength = Math.hypot(...rayInput);
const direction = rayInput.map(value => value / rayLength);
const targetDistanceMeters = 1;
const targetDistance = targetDistanceMeters / WORLD_SCALE;

async function loadModel(path) {
  const bytes = await readFile(new URL(path, root));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
  const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.updateMatrixWorld(true);
  return { scene, bytes: bytes.length, path, sha256: createHash('sha256').update(bytes).digest('hex') };
}

const [stage, asteroid] = await Promise.all([loadModel(stagePath), loadModel(asteroidPath)]);
const surface = asteroid.scene.getObjectByName('Asteroid_Surface');
if (!surface?.isMesh) throw new Error('Asteroid_Surface missing');
const surfaceGeometry = surface.geometry.clone().applyMatrix4(surface.matrixWorld);
const boundary = surfaceBoundary(surfaceGeometry);
const stagePoints = [], point = new Vector3();
let meshCount = 0;
stage.scene.traverse(mesh => {
  if (!mesh.isMesh) return;
  meshCount++;
  const positions = mesh.geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
    stagePoints.push([point.x, point.z]);
  }
});
if (!stagePoints.length) throw new Error('No stage mesh vertices');

function cross(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function convexHull(points) {
  const sorted = [...new Map(points.map(p => [`${p[0]},${p[1]}`, p])).values()]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower = [], upper = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of sorted.toReversed()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function closestPoint(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
  return [a[0] + t * dx, a[1] + t * dz];
}
function separation(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function properCrossing(a, b, c, d) {
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}
const hull = convexHull(stagePoints);

function measure(radius) {
  const x = radius * direction[0], z = radius * direction[1];
  const yaw = Math.atan2(BASE_HOUSE_X - x, BASE_HOUSE_Z - z);
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  const footprint = hull.map(([px, pz]) => [x + (px * cos + pz * sin) / WORLD_SCALE, z + (-px * sin + pz * cos) / WORLD_SCALE]);
  let inside = footprint.every(([px, pz]) => containsSurface(boundary, px, pz));
  let nearest = { distance: Infinity };
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i], b = footprint[(i + 1) % footprint.length];
    for (let j = 0; j < boundary.length; j++) {
      const [c, d] = boundary[j];
      if (properCrossing(a, b, c, d)) inside = false;
      const pairs = [[a, closestPoint(a, c, d)], [b, closestPoint(b, c, d)], [closestPoint(c, a, b), c], [closestPoint(d, a, b), d]];
      for (const [hullPoint, boundaryPoint] of pairs) {
        const distance = separation(hullPoint, boundaryPoint);
        if (distance < nearest.distance) nearest = { distance, hullEdge: i, boundaryEdge: j, hullPoint, boundaryPoint };
      }
    }
  }
  return { x, z, yaw, inside, footprint, nearest, radius };
}

let lo = 40, hi = 60;
if (!measure(lo).inside || measure(lo).nearest.distance < targetDistance || measure(hi).inside) {
  throw new Error('Placement search bracket no longer contains the intended rim');
}
for (let i = 0; i < 64; i++) {
  const mid = (lo + hi) / 2, current = measure(mid);
  if (current.inside && current.nearest.distance >= targetDistance) lo = mid;
  else hi = mid;
}
const placement = measure(lo);
if (!placement.inside || Math.abs(placement.nearest.distance - targetDistance) > 1e-9) throw new Error('Exact clearance not found');
const sourceBounds = new Box3().setFromObject(stage.scene, true);
const sourceBoundsRecord = { min: sourceBounds.min.toArray(), max: sourceBounds.max.toArray(), size: sourceBounds.getSize(new Vector3()).toArray() };
const minX = Math.min(...placement.footprint.map(p => p[0])), maxX = Math.max(...placement.footprint.map(p => p[0]));
const minZ = Math.min(...placement.footprint.map(p => p[1])), maxZ = Math.max(...placement.footprint.map(p => p[1]));
const footprintEdges = placement.footprint.map((p, i) => [p, placement.footprint[(i + 1) % placement.footprint.length]]);
const terrainSamples = [...placement.footprint, [placement.x, placement.z]];
for (let x = minX; x <= maxX; x += .1) for (let z = minZ; z <= maxZ; z += .1) {
  if (containsSurface(footprintEdges, x, z)) terrainSamples.push([x, z]);
}
const terrainHeights = terrainSamples.map(([x, z]) => terrainHeight(x, z));
const baseY = Math.max(...terrainHeights) - sourceBounds.min.y / WORLD_SCALE;
const minimumRadiusLocal = Math.min(...footprintEdges.map(([a, b]) => separation([0, 0], closestPoint([0, 0], a, b))));

// Recreate the actual deterministic placement acceptance used by the garden.
// AABB footprints deliberately give conservative decoration clearance values.
const [trees, rocks] = await Promise.all([loadModel('src/assets/models/trees-natural.glb'), loadModel('src/assets/models/rocks-natural.glb')]);
const treePlacements = selectTreePlacements(createTreeTemplates(trees.scene), PITCH_CLEARANCE);
const rockTemplates = [];
rocks.scene.traverse(mesh => { if (mesh.isMesh) rockTemplates.push(createRockTemplate(mesh)); });
rockTemplates.sort((a, b) => a.name.localeCompare(b.name));
const decorationBounds = treePlacements.map((p, i) => ({ name: `NaturalTree_${i}_${p.variant}`, kind: 'tree', bounds: p.bounds }));
naturalRockPlacements.forEach((p, i) => {
  const template = rockTemplates[p.size < 1.2 ? 1 : i % rockTemplates.length];
  const { bounds } = naturalRockTransform(template, p);
  const footprint = { minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z };
  if (isRockFootprintClear(footprint, PITCH_CLEARANCE) && gardenBorderClear(footprint)) decorationBounds.push({ name: `NaturalRock_${i}_${template.name}`, kind: 'rock', bounds });
});
function clearanceToBounds(bounds) {
  const rectangle = [[bounds.min.x, bounds.min.z], [bounds.max.x, bounds.min.z], [bounds.max.x, bounds.max.z], [bounds.min.x, bounds.max.z]];
  const edges = rectangle.map((p, i) => [p, rectangle[(i + 1) % rectangle.length]]);
  if (rectangle.some(([x, z]) => containsSurface(footprintEdges, x, z)) || placement.footprint.some(([x, z]) => containsSurface(edges, x, z))) return 0;
  let distance = Infinity;
  for (const [a, b] of footprintEdges) for (const [c, d] of edges) {
    if (properCrossing(a, b, c, d)) return 0;
    distance = Math.min(distance, separation(a, closestPoint(a, c, d)), separation(b, closestPoint(b, c, d)), separation(c, closestPoint(c, a, b)), separation(d, closestPoint(d, a, b)));
  }
  return distance;
}
const decorationClearance = decorationBounds.map(({ name, kind, bounds }) => ({ name, kind, clearanceMeters: clearanceToBounds(bounds) * WORLD_SCALE }))
  .sort((a, b) => a.clearanceMeters - b.clearanceMeters);
const meshBounds = [];
stage.scene.traverse(mesh => { if (mesh.isMesh) meshBounds.push({ name: mesh.name, bounds: new Box3().setFromObject(mesh, true) }); });
const plankTopMeters = Math.max(...meshBounds.filter(({ name }) => name.startsWith('Stage_Plank_')).map(({ bounds }) => bounds.max.y));
const groundSupports = meshBounds.filter(({ name }) => /^Stage_(Fascia_|Sub_|StairRiser_)/.test(name));
const deckAttachments = meshBounds.filter(({ name }) => /^Stage_(PostFoot_|MicrophoneBase$|MonitorMesh_-?\d+$)/.test(name));
const supportInspection = {
  plankTopMeters,
  groundSupportCount: groundSupports.length,
  groundSupportMaxAbsGapMeters: Math.max(...groundSupports.map(({ bounds }) => Math.abs(bounds.min.y + baseY * WORLD_SCALE))),
  deckAttachmentGapsMeters: deckAttachments.map(({ name, bounds }) => ({ name, gap: bounds.min.y - plankTopMeters })),
  note: 'Terrain is flat over the full placement. Ground support gaps are compared to terrain; attachment gaps are compared to the authored plank top. The microphone base preserves its authored 3 mm offset.',
};
const boundaryEdge = boundary[placement.nearest.boundaryEdge];
const nearestBoundaryVertex = boundaryEdge.reduce((best, p) => separation(p, placement.nearest.boundaryPoint) < separation(best, placement.nearest.boundaryPoint) ? p : best);
const report = {
  schema: 'garden-stage.placement.v1',
  screenshot: 'C:/Users/Amministratore/Pictures/Screenshots/Screenshot 2026-10-05 142845.png',
  screenshotInterpretation: 'Approximate negative-X / positive-Z sector inferred from red tree, entry and punchball alignment; screenshot does not establish exact coordinates.',
  method: 'Convex hull of all world-transformed source mesh vertices projected on XZ, including overhead beams. Uniform inverse WORLD_SCALE, semantic front +Z aimed at house center. Search along inferred radial direction until the full convex hull is inside the actual asteroid surface boundary with minimum Euclidean segment distance of one world metre.',
  worldScale: WORLD_SCALE,
  assetScaleInGarden: 1 / WORLD_SCALE,
  sourceAssets: [stage, asteroid].map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
  sourceMeshCount: meshCount,
  sourceProjectedVertexCount: stagePoints.length,
  sourceConvexHullVertexCount: hull.length,
  sourceBoundsMeters: sourceBoundsRecord,
  sourceConvexHullMetersXZ: hull,
  rayDirectionXZ: direction,
  houseTargetLocalXZ: [BASE_HOUSE_X, BASE_HOUSE_Z],
  coordinatesLocal: [placement.x, baseY, placement.z],
  coordinatesWorldMeters: [placement.x * WORLD_SCALE, baseY * WORLD_SCALE, placement.z * WORLD_SCALE],
  yawRadians: placement.yaw,
  yawDegrees: placement.yaw * 180 / Math.PI,
  frontAxis: '+Z',
  footprintInsideBoundary: placement.inside,
  minimumEdgeDistanceLocal: placement.nearest.distance,
  minimumEdgeDistanceMeters: placement.nearest.distance * WORLD_SCALE,
  nearestHullPointLocalXZ: placement.nearest.hullPoint,
  nearestBoundaryPointLocalXZ: placement.nearest.boundaryPoint,
  nearestBoundaryVertexLocalXZ: nearestBoundaryVertex,
  nearestBoundaryEdgeIndex: placement.nearest.boundaryEdge,
  nearestBoundaryEdgeLocalXZ: boundaryEdge,
  transformedConvexHullLocalXZ: placement.footprint,
  placedBoundsLocal: { min: [minX, baseY + sourceBounds.min.y / WORLD_SCALE, minZ], max: [maxX, baseY + sourceBounds.max.y / WORLD_SCALE, maxZ] },
  terrainHeight: { sampleCount: terrainSamples.length, sampleGridSpacingMeters: .5, minLocal: Math.min(...terrainHeights), maxLocal: Math.max(...terrainHeights), minWorldMeters: Math.min(...terrainHeights) * WORLD_SCALE, maxWorldMeters: Math.max(...terrainHeights) * WORLD_SCALE },
  supportInspection,
  sceneryClearance: {
    sourceAssets: [trees, rocks].map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
    method: 'Stage projected convex hull against accepted natural-tree and natural-rock world-aligned bounds; conservative separation estimate.',
    minimumHullRadiusLocal: minimumRadiusLocal,
    acceptedTreeCount: decorationBounds.filter(d => d.kind === 'tree').length,
    acceptedRockCount: decorationBounds.filter(d => d.kind === 'rock').length,
    overlaps: decorationClearance.filter(d => d.clearanceMeters <= 0),
    nearest: decorationClearance.slice(0, 5),
  },
  runtimeVisualVerification: 'pending',
};
await writeFile(new URL('placement-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ coordinatesLocal: report.coordinatesLocal, yawRadians: report.yawRadians, minimumEdgeDistanceMeters: report.minimumEdgeDistanceMeters, sourceConvexHullVertexCount: hull.length, terrainHeight: report.terrainHeight }, null, 2));
