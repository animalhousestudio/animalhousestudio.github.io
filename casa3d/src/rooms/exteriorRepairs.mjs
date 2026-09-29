import { Box3, MathUtils, Vector3 } from 'three';
import { BASEMENT_FOOTPRINT } from './basementFootprint.mjs';
import { BASE_FLOOR_Y } from './layout.mjs';
import { ELEVATOR_CABIN_HEIGHT } from './elevator.mjs';

// Edit copies in mansion-local coordinates before collision capture/batching.
function reshape(root, mesh, change, normals = true) {
  const matrix = root.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
  const inverse = matrix.clone().invert();
  const geometry = mesh.geometry.clone(), positions = geometry.attributes.position;
  const point = new Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
    change(point);
    point.applyMatrix4(inverse);
    positions.setXYZ(i, point.x, point.y, point.z);
  }
  positions.needsUpdate = true;
  if (normals) geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  mesh.geometry = geometry;
}

function localBounds(root, mesh) {
  const matrix = root.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
}

function westWallAt(z) {
  let west = Infinity;
  for (let i = 0; i < BASEMENT_FOOTPRINT.length; i++) {
    const [ax, az] = BASEMENT_FOOTPRINT[i];
    const [bx, bz] = BASEMENT_FOOTPRINT[(i + 1) % BASEMENT_FOOTPRINT.length];
    if ((az > z) !== (bz > z)) west = Math.min(west, ax + (bx - ax) * (z - az) / (bz - az));
  }
  return west;
}

export function fitVerandaToHouse(root) {
  root.updateWorldMatrix(true, true);
  // Extend the glazing, frames, apron and roof together. The outside end stays
  // anchored; only the bays beside the curved wall become slightly wider.
  // The overlap lies within the wall thickness, including its upper taper.
  const outer = -12.629, oldEnd = -7.373;
  root.traverse(mesh => {
    if (!mesh.isMesh || !mesh.name.startsWith('M01_Conservatory_')) return;
    reshape(root, mesh, p => {
      const extension = Math.max(0, westWallAt(p.z) + .10 - oldEnd);
      const weight = MathUtils.clamp((p.x - outer) / (oldEnd - outer), 0, 1);
      p.x += extension * weight;
    });
  });
}

export function fitElevatorHeadroom(root) {
  root.updateWorldMatrix(true, true);
  const extra = ELEVATOR_CABIN_HEIGHT - .46;
  root.traverse(mesh => {
    if (!mesh.isMesh || !mesh.name.startsWith('M10_Elevator_')) return;
    const name = mesh.name, bounds = localBounds(root, mesh);
    const header = name.startsWith('M10_Elevator_DoorHeader_');
    const top = name === 'M10_Elevator_TopRing' || name.endsWith('Glass_Front_Top');
    const front = /Shaft_Glass_Front_\d+/.test(name);
    const shaft = name === 'M10_Elevator_Shaft_Glass' || name.startsWith('M10_Elevator_Shaft_Post_');
    if (!header && !top && !front && !shaft) return;
    reshape(root, mesh, p => {
      if (header || top) p.y += extra;
      else if (front && Math.abs(p.y - bounds.min.y) < .001) p.y += extra;
      else if (shaft && p.y > BASE_FLOOR_Y.at(-1) + .46) p.y += extra;
    });
  });
}

export function shapeTreeAroundHouse(root) {
  root.updateWorldMatrix(true, true);
  const groups = [
    /^M01_Conservatory_/,
    /^M01_Reuse_AVIARY_Left_/,
    /^M04_WestTurret_/,
    /^M01_Reuse_CURVE_(Left|Front|Back)_Clapboard/,
  ];
  const volumes = groups.map(pattern => {
    const bounds = new Box3();
    root.traverse(mesh => {
      if (mesh.isMesh && pattern.test(mesh.name)) bounds.union(localBounds(root, mesh));
    });
    return bounds;
  }).filter(bounds => !bounds.isEmpty());
  // Reserve a little extra space for triangles spanning adjacent leaf/branch
  // vertices. The falloff outside each structure makes a gradual bend, while
  // the exponential curve keeps branch thickness instead of flattening tips.
  for (const volume of volumes) volume.expandByScalar(.18);
  let changed = 0;
  root.traverse(mesh => {
    if (!mesh.isMesh || !/^M09_HouseTree_Number5_(Branches|Leaves)$/.test(mesh.name)) return;
    reshape(root, mesh, p => {
      const originalX = p.x;
      for (const volume of volumes) {
        const distanceY = Math.max(volume.min.y - p.y, p.y - volume.max.y, 0);
        const distanceZ = Math.max(volume.min.z - p.z, p.z - volume.max.z, 0);
        const influence = (1 - MathUtils.smoothstep(Math.max(distanceY, distanceZ), 0, 1.2))
          * MathUtils.smoothstep(p.y, 1, 2.5);
        const bendWidth = 2.0, barrier = volume.min.x - .12, start = barrier - bendWidth;
        if (p.x <= start || influence === 0) continue;
        const bent = barrier - bendWidth * Math.exp(-(p.x - start) / bendWidth);
        p.x = MathUtils.lerp(p.x, bent, influence);
      }
      if (Math.abs(p.x - originalX) > 1e-6) changed++;
    });
  });
  return { changedVertices: changed, volumes };
}

export function repairExterior(root) {
  if (root.userData.exteriorRepairs) return root.userData.exteriorRepairs;
  fitVerandaToHouse(root);
  fitElevatorHeadroom(root);
  const tree = shapeTreeAroundHouse(root);
  return (root.userData.exteriorRepairs = { tree });
}
