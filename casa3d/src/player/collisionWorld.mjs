import { Box3, BoxGeometry, Matrix4, Triangle, Vector3 } from 'three';

// Capture before render batching erases object names. Geometry remains shared;
// only transforms are copied. A render flag such as collidable=false is not an
// opt-out: older GLBs applied it to every mesh, including their walls.
const decoration = /Grass|Ivy|Flowers|WindowCat|(?:^|_)Cat_|(?:^|_)Plant(?!er)|Bird|Beak|Lamp|Light|Glow|Bulb/i;
const movable = /JETPACK|EntryDoorPivot|PlayableElevatorCabin/;
const unitBox = new BoxGeometry(1, 1, 1);
export function captureCollisionSource(root, { dynamic = false, filter = () => true } = {}) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const source = [];
  root.traverseVisible(node => {
    if (!node.isMesh || !node.geometry?.attributes.position || !filter(node)) return;
    for (let parent = node; parent; parent = parent.parent) {
      if (parent.userData.collisionDisabled || decoration.test(parent.name)
        || (!dynamic && (parent.userData.collisionDynamic || movable.test(parent.name)))) return;
      if (parent === root) break;
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (materials.every(material => !material.visible) && !node.userData.collidable) return;
    const local = inverse.clone().multiply(node.matrixWorld);
    if (node.isInstancedMesh) {
      for (let index = 0; index < node.count; index++) {
        const instance = new Matrix4();
        node.getMatrixAt(index, instance);
        source.push({ geometry: node.geometry, matrix: local.clone().multiply(instance), name: node.name,
          ...(dynamic ? { object: node, instanceIndex: index } : {}) });
      }
    } else source.push({ geometry: node.geometry, matrix: local, name: node.name, ...(dynamic ? { object: node } : {}) });
  });
  return source;
}

const a = new Vector3(), b = new Vector3(), c = new Vector3();
const axisStart = new Vector3(), axisEnd = new Vector3(), previousCenter = new Vector3();
const triangle = new Triangle(a, b, c), normal = new Vector3();
const onAxis = new Vector3(), onTriangle = new Vector3();
const candidateAxis = new Vector3(), candidateTriangle = new Vector3();
const edgeDirection = new Vector3(), segmentDirection = new Vector3(), offset = new Vector3();
const contactNormal = new Vector3(), bestNormal = new Vector3(), translation = new Vector3();
const clamp = value => Math.max(0, Math.min(1, value));
const EPSILON = 1e-9;

// Closest points between two finite segments, including parallel/degenerate
// edges. Used with the entire player's vertical capsule, not just its head.
function segmentClosest(p, q, r, s) {
  segmentDirection.subVectors(q, p);
  edgeDirection.subVectors(s, r);
  offset.subVectors(p, r);
  const aa = segmentDirection.lengthSq(), ee = edgeDirection.lengthSq();
  const f = edgeDirection.dot(offset);
  let u = 0, v = 0;
  if (aa <= EPSILON) v = ee <= EPSILON ? 0 : clamp(f / ee);
  else {
    const cc = segmentDirection.dot(offset);
    if (ee <= EPSILON) u = clamp(-cc / aa);
    else {
      const bb = segmentDirection.dot(edgeDirection), denominator = aa * ee - bb * bb;
      u = denominator > EPSILON ? clamp((bb * f - cc * ee) / denominator) : 0;
      v = (bb * u + f) / ee;
      if (v < 0) { v = 0; u = clamp(-cc / aa); }
      else if (v > 1) { v = 1; u = clamp((bb - cc) / aa); }
    }
  }
  candidateAxis.copy(p).addScaledVector(segmentDirection, u);
  candidateTriangle.copy(r).addScaledVector(edgeDirection, v);
}

function capsuleContact(radius) {
  triangle.getNormal(normal);
  if (normal.lengthSq() < .5) return 0;
  const startDistance = normal.dot(offset.subVectors(axisStart, a));
  const endDistance = normal.dot(offset.subVectors(axisEnd, a));
  if (Math.min(startDistance, endDistance) > radius || Math.max(startDistance, endDistance) < -radius) return 0;

  let distanceSquared = Infinity;
  if (startDistance * endDistance <= 0 && Math.abs(startDistance - endDistance) > EPSILON) {
    candidateAxis.copy(axisStart).lerp(axisEnd, startDistance / (startDistance - endDistance));
    if (triangle.containsPoint(candidateAxis)) {
      onAxis.copy(candidateAxis); onTriangle.copy(candidateAxis); distanceSquared = 0;
    }
  }
  const consider = () => {
    const distance = candidateAxis.distanceToSquared(candidateTriangle);
    if (distance < distanceSquared) {
      distanceSquared = distance; onAxis.copy(candidateAxis); onTriangle.copy(candidateTriangle);
    }
  };
  if (distanceSquared > 0) {
    candidateAxis.copy(axisStart); triangle.closestPointToPoint(axisStart, candidateTriangle); consider();
    candidateAxis.copy(axisEnd); triangle.closestPointToPoint(axisEnd, candidateTriangle); consider();
    segmentClosest(axisStart, axisEnd, a, b); consider();
    segmentClosest(axisStart, axisEnd, b, c); consider();
    segmentClosest(axisStart, axisEnd, c, a); consider();
  }
  if (distanceSquared >= radius * radius) return 0;
  const distance = Math.sqrt(distanceSquared);
  if (distance > 1e-7) contactNormal.subVectors(onAxis, onTriangle).divideScalar(distance);
  else {
    // Both faces collide, even for one-sided panes and mirrored GLB objects.
    const side = normal.dot(offset.subVectors(previousCenter, a)) >= 0 ? 1 : -1;
    contactNormal.copy(normal).multiplyScalar(side);
  }
  return radius - distance;
}

class TriangleGrid {
  constructor(records, cellSize = 5) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this.large = [];
    this.bounds = new Box3();
    const capacity = records.reduce((total, record) => total
      + (record.geometry.index?.count ?? record.geometry.attributes.position.count), 0);
    const data = new Float32Array(capacity * 3);
    let length = 0;
    for (const { geometry, matrix } of records) {
      const position = geometry.attributes.position, index = geometry.index;
      const count = index?.count ?? position.count;
      for (let i = 0; i + 2 < count; i += 3) {
        a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(matrix);
        b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(matrix);
        c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(matrix);
        if (triangle.getArea() < 1e-10) continue;
        a.toArray(data, length); b.toArray(data, length + 3); c.toArray(data, length + 6);
        this.bounds.expandByPoint(a).expandByPoint(b).expandByPoint(c);
        const id = length / 9;
        const minX = Math.floor(Math.min(a.x, b.x, c.x) / cellSize);
        const minY = Math.floor(Math.min(a.y, b.y, c.y) / cellSize);
        const minZ = Math.floor(Math.min(a.z, b.z, c.z) / cellSize);
        const maxX = Math.floor(Math.max(a.x, b.x, c.x) / cellSize);
        const maxY = Math.floor(Math.max(a.y, b.y, c.y) / cellSize);
        const maxZ = Math.floor(Math.max(a.z, b.z, c.z) / cellSize);
        if ((maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1) > 256) this.large.push(id);
        else for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
          const key = `${x},${y},${z}`;
          if (!this.cells.has(key)) this.cells.set(key, []);
          this.cells.get(key).push(id);
        }
        length += 9;
      }
    }
    this.data = data.subarray(0, length);
    this.triangleCount = length / 9;
    this.visited = new Uint32Array(this.triangleCount);
    this.queryId = 0;
    for (const [key, ids] of this.cells) this.cells.set(key, Uint32Array.from(ids));
  }

  candidates(bounds, result) {
    if (!this.bounds.intersectsBox(bounds)) return;
    const mark = ++this.queryId;
    if (mark === 0xffffffff) { this.visited.fill(0); this.queryId = 1; }
    const add = id => { if (this.visited[id] !== mark) { this.visited[id] = mark; result.push(id); } };
    this.large.forEach(add);
    const size = this.cellSize;
    for (let x = Math.floor(bounds.min.x / size); x <= Math.floor(bounds.max.x / size); x++)
      for (let y = Math.floor(bounds.min.y / size); y <= Math.floor(bounds.max.y / size); y++)
        for (let z = Math.floor(bounds.min.z / size); z <= Math.floor(bounds.max.z / size); z++) {
          const ids = this.cells.get(`${x},${y},${z}`);
          if (ids) for (const id of ids) add(id);
        }
  }
}

export class CollisionWorld {
  static fromBoxes(boxes) {
    const world = new CollisionWorld();
    for (const box of boxes) {
      const size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
      world.sources.push({ geometry: unitBox, matrix: new Matrix4().makeScale(size.x, size.y, size.z).setPosition(center) });
    }
    return world.build();
  }

  constructor() {
    this.sources = [];
    this.dynamic = [];
    this.grid = null;
    this.queryBounds = new Box3();
    this.candidates = [];
    this.stats = { triangles: 0, cells: 0, lastTriangleTests: 0 };
  }

  addSource(source, worldMatrix = new Matrix4()) {
    for (const record of source) this.sources.push({ ...record, matrix: worldMatrix.clone().multiply(record.matrix) });
    return this;
  }

  addRoot(root, options) {
    const source = captureCollisionSource(root, options);
    return this.addSource(source, root.matrixWorld);
  }

  addDynamicRoot(root, options = {}) {
    const source = captureCollisionSource(root, { ...options, dynamic: true });
    this.dynamic.push({ root, source, matrices: null, grid: null });
    return this;
  }

  build() {
    this.grid = new TriangleGrid(this.sources);
    this.sources.length = 0;
    this.stats.triangles = this.grid.triangleCount;
    this.stats.cells = this.grid.cells.size;
    return this;
  }

  updateDynamic() {
    for (const item of this.dynamic) {
      item.root.updateWorldMatrix(true, true);
      const matrices = item.source.map(record => {
        const matrix = record.object.matrixWorld.clone();
        if (record.instanceIndex !== undefined) {
          const instance = new Matrix4(); record.object.getMatrixAt(record.instanceIndex, instance); matrix.multiply(instance);
        }
        return matrix;
      });
      if (item.matrices && matrices.every((matrix, i) => matrix.equals(item.matrices[i]))) continue;
      item.matrices = matrices;
      item.grid = new TriangleGrid(item.source.map((record, i) => ({ ...record, matrix: matrices[i] })));
    }
  }

  // Maximum travel per step is less than the radius: even an infinitely thin
  // pane cannot be crossed at low frame rates or while boosting the jetpack.
  move(position, displacement, { radius = .35, eyeHeight = 1.65, headClearance = .16, velocity } = {}) {
    this.updateDynamic();
    const result = { position: position.clone(), grounded: false, ceiling: false };
    const steps = Math.max(1, Math.ceil(displacement.length() / (radius * .4)));
    const increment = displacement.clone().divideScalar(steps);
    const grids = [this.grid, ...this.dynamic.map(item => item.grid)];
    this.stats.lastTriangleTests = 0;
    for (let step = 0; step < steps; step++) {
      previousCenter.copy(result.position); previousCenter.y += (headClearance - eyeHeight) / 2;
      result.position.add(increment);
      for (let iteration = 0; iteration < 5; iteration++) {
        let deepest = 0;
        for (const grid of grids) {
          if (!grid) continue;
          const bounds = this.queryBounds;
          bounds.min.set(result.position.x - radius, result.position.y - eyeHeight, result.position.z - radius);
          bounds.max.set(result.position.x + radius, result.position.y + headClearance, result.position.z + radius);
          this.candidates.length = 0;
          grid.candidates(bounds, this.candidates);
          for (const id of this.candidates) {
            const index = id * 9;
            a.fromArray(grid.data, index); b.fromArray(grid.data, index + 3); c.fromArray(grid.data, index + 6);
            if (Math.max(a.x, b.x, c.x) < bounds.min.x || Math.min(a.x, b.x, c.x) > bounds.max.x
              || Math.max(a.y, b.y, c.y) < bounds.min.y || Math.min(a.y, b.y, c.y) > bounds.max.y
              || Math.max(a.z, b.z, c.z) < bounds.min.z || Math.min(a.z, b.z, c.z) > bounds.max.z) continue;
            axisStart.copy(result.position); axisStart.y += -eyeHeight + radius;
            axisEnd.copy(result.position); axisEnd.y += headClearance - radius;
            this.stats.lastTriangleTests++;
            const depth = capsuleContact(radius);
            if (depth > deepest) { deepest = depth; bestNormal.copy(contactNormal); }
          }
        }
        if (deepest < 1e-7) break;
        // The deepest face wins over its neighbouring triangle's edge. This
        // prevents internal triangulation seams from dragging a walker sideways.
        result.position.add(translation.copy(bestNormal).multiplyScalar(deepest + 1e-6));
        if (bestNormal.y > .55) result.grounded = true;
        if (bestNormal.y < -.55) result.ceiling = true;
        if (velocity) {
          const intoSurface = velocity.dot(bestNormal);
          if (intoSurface < 0) velocity.addScaledVector(bestNormal, -intoSurface);
        }
      }
    }
    return result;
  }
}
