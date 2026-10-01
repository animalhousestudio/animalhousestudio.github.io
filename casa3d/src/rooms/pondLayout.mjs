import { Box3, Matrix4, Raycaster, Vector3 } from 'three';

// Garden-local coordinates, before WORLD_SCALE. Double the former pond area;
// its asymmetric coves share one polygon across terrain, water and movement.
export const POND_FOOTPRINT = Object.freeze({ x: -24, z: 3, rx: 2.1 * 1.08 * Math.SQRT2, rz: 1.55 * 1.08 * Math.SQRT2 });
export const POND_SIDES = 48;
const TAU = Math.PI * 2;
const shapes = new Map();

function pondShape(sides) {
  if (shapes.has(sides)) return shapes.get(sides);
  const radii = Array.from({ length: sides }, (_, i) => {
    const angle = i / sides * TAU;
    return 1 + .115 * Math.sin(angle * 3 + .5) + .07 * Math.sin(angle * 2 - 1) + .04 * Math.cos(angle * 5 + .7);
  });
  const area = radii.reduce((sum, radius, i) => sum + radius * radii[(i + 1) % sides] * Math.sin(TAU / sides) / 2, 0);
  const scale = Math.sqrt(Math.PI / area);
  const points = radii.map((radius, i) => [Math.cos(i / sides * TAU) * radius * scale, Math.sin(i / sides * TAU) * radius * scale]);
  shapes.set(sides, points);
  return points;
}

export function getPondOutline(layout = POND_FOOTPRINT, sides = layout.sides ?? POND_SIDES, margin = 0) {
  return pondShape(sides).map(([u, v]) => [layout.x + u * (layout.rx + margin), layout.z + v * (layout.rz + margin)]);
}

// O(1) sector lookup, followed by the exact ray/polygon-edge intersection.
// No mesh raycasts, per-frame arrays or approximated ellipse boundaries.
export function getPondRadius(layout, x, z, margin = 0) {
  const u = (x - layout.x) / (layout.rx + margin), v = (z - layout.z) / (layout.rz + margin);
  const angle = (Math.atan2(v, u) + TAU) % TAU;
  const sides = layout.sides ?? POND_SIDES, shape = pondShape(sides), i = Math.floor(angle / TAU * sides) % sides;
  const [ax, az] = shape[i], [bx, bz] = shape[(i + 1) % sides];
  return (u * (bz - az) + v * (ax - bx)) / (ax * bz - az * bx);
}

export function getPondBoundaryPoint(layout, angle, margin = 0) {
  const u = Math.cos(angle), v = Math.sin(angle);
  const radius = getPondRadius(layout, layout.x + u * (layout.rx + margin), layout.z + v * (layout.rz + margin), margin);
  return [layout.x + u * (layout.rx + margin) / radius, layout.z + v * (layout.rz + margin) / radius];
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
  const samples = [[footprint.x, footprint.z], ...getPondOutline(footprint)];
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
  const measured = measureShell(model, { ...POND_FOOTPRINT, sides }, shoreY);
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
    explorationEnabled: true,
    // A closed deep bowl transitions into a broad walkable earth bank. All
    // rings follow the same organic outline, keeping queries cheap and exact.
    profile: Object.freeze([
      Object.freeze([0, bottomY]), Object.freeze([.42, bottomY]),
      Object.freeze([.55, bottomY + Math.min(.65, excavationDepth * .08)]),
      Object.freeze([.71, waterY - .85]), Object.freeze([.78, waterY - .30]),
      Object.freeze([.86, waterY - .065]), Object.freeze([.94, waterY + .022]),
      Object.freeze([1, shoreY]),
    ]),
  };
  const outline = getPondOutline(layout), edgeHeights = outline.map(([x, z]) => heightAt(x, z));
  layout.ringHeightAt = (radius, i) => radius === 1 ? edgeHeights[i] : layout.profile.find(([r]) => r === radius)[1];
  layout.pointAtAngle = (angle, radius = 1) => {
    const [x, z] = getPondBoundaryPoint(layout, angle);
    return [layout.x + (x - layout.x) * radius, layout.z + (z - layout.z) * radius];
  };
  layout.normalizedRadius = (x, z, margin = 0) => getPondRadius(layout, x, z, margin);
  layout.contains = (x, z, margin = 0) => layout.normalizedRadius(x, z, margin) <= 1 + 1e-10;
  layout.getSurfaceHeight = (x, z) => layout.contains(x, z) ? waterY : null;
  layout.floorAt = (x, z) => {
    const u = (x - layout.x) / layout.rx, v = (z - layout.z) / layout.rz;
    const angle = (Math.atan2(v, u) + TAU) % TAU, sector = Math.floor(angle / TAU * sides) % sides;
    const shape = pondShape(sides), next = (sector + 1) % sides;
    const [ax, az] = shape[sector], [bx, bz] = shape[next], det = ax * bz - az * bx;
    const aWeight = (u * bz - v * bx) / det, bWeight = (ax * v - az * u) / det;
    const radius = aWeight + bWeight;
    if (radius > 1 + 1e-10) return null;
    if (radius <= layout.profile[1][0]) return bottomY;
    for (let i = 1; i < layout.profile.length; i++) {
      const [a, ay] = layout.profile[i - 1], [b, by] = layout.profile[i];
      if (radius > b + 1e-10) continue;
      if (b !== 1) return ay + (by - ay) * Math.max(0, Math.min(1, (radius - a) / (b - a)));
      // The terrain seam is not perfectly level. Interpolate the same two
      // triangles as the render mesh rather than smoothing through its faces.
      if (aWeight / a + bWeight / b >= 1) {
        const inner = (b - radius) / (b - a), outerNext = bWeight / b;
        return ay * inner + edgeHeights[next] * outerNext + edgeHeights[sector] * (1 - inner - outerNext);
      }
      const outerNext = (radius - a) / (b - a);
      return ay * (1 - outerNext) + edgeHeights[next] * outerNext;
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
