import { Box3, Matrix4, Raycaster, Vector3 } from 'three';

// Garden-local coordinates, before WORLD_SCALE. The former reserved ellipse
// was 2.1 by 1.55; grow both radii by 8% without moving its established centre.
export const POND_FOOTPRINT = Object.freeze({ x: -24, z: 3, rx: 2.1 * 1.08, rz: 1.55 * 1.08 });
export const POND_SIDES = 48;
const TAU = Math.PI * 2;

export function getPondOutline(layout = POND_FOOTPRINT, sides = layout.sides ?? POND_SIDES, margin = 0) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = i / sides * TAU;
    return [layout.x + Math.cos(angle) * (layout.rx + margin), layout.z + Math.sin(angle) * (layout.rz + margin)];
  });
}

// Match the polygon used by the actual hole and basin, including the small
// difference between a polygon edge and the ideal ellipse. No mesh raycasts
// are required by the per-frame surface/depth/containment queries.
function polygonRadius(layout, x, z, margin = 0) {
  const u = (x - layout.x) / (layout.rx + margin), v = (z - layout.z) / (layout.rz + margin);
  const angle = (Math.atan2(v, u) + TAU) % TAU;
  const step = TAU / layout.sides;
  return Math.hypot(u, v) * Math.cos(angle % step - step / 2) / Math.cos(step / 2);
}

function measureShell(model, footprint, shoreY) {
  if (model?.isBox3) {
    return { bounds: model.clone(), undersideY: model.min.y, shallowestUndersideY: model.min.y, method: 'bounds' };
  }
  if (!model?.isObject3D) throw new TypeError('A measured asteroid model or Box3 is required for the pond depth');
  model.updateWorldMatrix(true, true);
  const inverse = model.matrixWorld.clone().invert(), localMatrix = new Matrix4();
  const bounds = new Box3(), meshes = [];
  const rock = model.getObjectByName('Asteroid_Rock');
  (rock ?? model).traverse(node => {
    if (!node.isMesh || !node.geometry?.attributes.position) return;
    if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
    localMatrix.multiplyMatrices(inverse, node.matrixWorld);
    bounds.union(node.geometry.boundingBox.clone().applyMatrix4(localMatrix));
    meshes.push(node);
  });
  if (bounds.isEmpty() || bounds.min.y >= shoreY) throw new RangeError('The asteroid has no measured depth below the pond');
  // Cast upward from outside the rock, so the underside's original outward
  // faces remain hittable without changing materials or their side setting.
  const direction = new Vector3(0, 1, 0).transformDirection(model.matrixWorld);
  const ray = new Raycaster(), origin = new Vector3(), localHit = new Vector3();
  const samples = [[footprint.x, footprint.z], ...getPondOutline({ ...footprint, sides: 8 }, 8)];
  const depths = samples.map(([x, z]) => {
    origin.set(x, bounds.min.y - 1, z).applyMatrix4(model.matrixWorld);
    ray.set(origin, direction);
    for (const hit of ray.intersectObjects(meshes, false)) {
      localHit.copy(hit.point).applyMatrix4(inverse);
      if (localHit.y < shoreY - .01) return localHit.y;
    }
    // Missing rock beneath even one sample is not a safe place to excavate.
    throw new RangeError(`Pond footprint leaves the asteroid shell at ${x}, ${z}`);
  });
  return { bounds, undersideY: depths[0], shallowestUndersideY: Math.max(...depths), method: 'local-shell-raycast' };
}

export function createPondLayout(model, { heightAt = () => 0, sides = POND_SIDES } = {}) {
  if (!Number.isInteger(sides) || sides < 16 || sides > 128) throw new RangeError('Pond sides must be an integer between 16 and 128');
  const shoreY = heightAt(POND_FOOTPRINT.x, POND_FOOTPRINT.z);
  const measured = measureShell(model, POND_FOOTPRINT, shoreY);
  const measuredThickness = shoreY - measured.undersideY;
  // Aim at half the local rock thickness, retaining >= 35% of the shallowest
  // sampled shell under the cavity if a future asteroid has a sloping base.
  const excavationDepth = Math.min(measuredThickness * .5, (shoreY - measured.shallowestUndersideY) * .65);
  if (!(excavationDepth > 1)) throw new RangeError('The asteroid shell is too shallow for a deep pond');
  const bottomY = shoreY - excavationDepth, waterY = shoreY - .06;
  const layout = {
    ...POND_FOOTPRINT, sides, shoreY, waterY, bottomY,
    depth: waterY - bottomY, excavationDepth, measuredThickness,
    measurement: Object.freeze({ method: measured.method, undersideY: measured.undersideY,
      shallowestUndersideY: measured.shallowestUndersideY, minY: measured.bounds.min.y, maxY: measured.bounds.max.y }),
    explorationEnabled: false,
    // Radius-height pairs from centre outwards: a broad closed floor, steep
    // walls, and a narrow shallow shelf. Geometry and depth queries share it.
    profile: Object.freeze([
      Object.freeze([0, bottomY]), Object.freeze([.52, bottomY]),
      Object.freeze([.66, bottomY + Math.min(.65, excavationDepth * .08)]),
      Object.freeze([.87, waterY - .65]), Object.freeze([.985, waterY - .16]),
      Object.freeze([1, shoreY]),
    ]),
  };
  layout.normalizedRadius = (x, z, margin = 0) => polygonRadius(layout, x, z, margin);
  layout.contains = (x, z, margin = 0) => layout.normalizedRadius(x, z, margin) <= 1 + 1e-10;
  layout.getSurfaceHeight = (x, z) => layout.contains(x, z) ? waterY : null;
  layout.floorAt = (x, z) => {
    const radius = layout.normalizedRadius(x, z);
    if (radius > 1 + 1e-10) return null;
    for (let i = 1; i < layout.profile.length; i++) {
      const [a, ay] = layout.profile[i - 1], [b, by] = layout.profile[i];
      if (radius <= b + 1e-10) return ay + (by - ay) * Math.max(0, Math.min(1, (radius - a) / (b - a)));
    }
    return shoreY;
  };
  layout.sampleDepth = (x, z) => {
    const floor = layout.floorAt(x, z);
    return floor === null ? null : Math.max(0, waterY - floor);
  };
  layout.containsVolume = (x, y, z) => {
    const floor = layout.floorAt(x, z);
    return floor !== null && y >= floor && y <= waterY;
  };
  return Object.freeze(layout);
}
