import { BufferGeometry, Float32BufferAttribute, Group, InstancedMesh, MeshStandardMaterial, Matrix4, Vector3, Quaternion, Color } from 'three';
import { GARDEN, paths, PATH_WIDTH } from './landscapeLayout.mjs';
import { terrainHeight, noise } from './terrainDetail.mjs';

// A repeating hand-placed rhythm keeps the path organic without turning it
// into a dense uniform grid. The six-stone row is still contained by PATH_WIDTH.
export const PATH_ROW_COLUMNS = Object.freeze([4, 5, 3, 4, 3, 6]);

export function roundedStoneGeometry(variant = 0) {
  // Ten sides keep the rounded tread while keeping the larger path dense.
  const positions = [], indices = [], sides = 10;
  // A broad flat tread with rounded shoulders; the bottom is sunk into soil.
  const rings = [[.74, -.35], [1, 0], [.96, .46], [.77, .62]];
  for (const [radius, y] of rings) for (let i = 0; i < sides; i++) {
    const a = i / sides * Math.PI * 2, r = radius * (1 + (noise(i, variant + 110) - .5) * .14);
    positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
  }
  for (let ring = 0; ring < rings.length - 1; ring++) for (let i = 0; i < sides; i++) {
    const a = ring * sides + i, b = ring * sides + (i + 1) % sides;
    indices.push(a, a + sides, b, b, a + sides, b + sides);
  }
  positions.push(0, rings.at(-1)[1], 0, 0, rings[0][1], 0);
  for (let i = 0; i < sides; i++) {
    indices.push(sides * 4, sides * 3 + (i + 1) % sides, sides * 3 + i);
    indices.push(sides * 4 + 1, i, (i + 1) % sides);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
export function stonePlacements() {
  const placements = [];
  paths.forEach((curve, route) => {
    // Fill the entrance route with small overlapping-looking clusters while
    // keeping the row cadence low enough that collision capture stays cheap.
    const count = Math.ceil(curve.getLength() / .15);
    for (let i = 0; i <= count; i++) {
      const p = curve.getPointAt(i / count), tangent = curve.getTangentAt(i / count);
      // Do not stack the branch's first stone on top of the main walk.
      if (route && i < 2) continue;
      const columns = PATH_ROW_COLUMNS[i % PATH_ROW_COLUMNS.length];
      const spacing = PATH_WIDTH / columns;
      for (let column = 0; column < columns; column++) {
        const seed = i * 3 + column + route * 10000;
        const offset = (column - (columns - 1) / 2) * spacing;
        const diameter = spacing * (.87 + noise(seed, 2) * .08);
        placements.push({ x: p.x + tangent.z * offset, z: p.z - tangent.x * offset,
          yaw: noise(seed, 1) * Math.PI * 2, width: diameter,
          depth: diameter * (.94 + noise(seed, 3) * .12), height: .025,
          kind: 'path', route, row: i });
      }
    }
  });
  const count = 290;
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    if (Math.abs(a - GARDEN.gate) < .065) continue;
    placements.push({ x: GARDEN.x + Math.cos(a) * GARDEN.rx, z: GARDEN.z + Math.sin(a) * GARDEN.rz,
      yaw: -a, width: .23 + noise(i, 6) * .055, depth: .19 + noise(i, 7) * .025,
      height: .055 + noise(i, 8) * .025, kind: 'border' });
  }
  return placements;
}
export function addRoundStoneLandscape(garden) {
  const group = new Group(); group.name = 'RoundStoneLandscape';
  const sites = stonePlacements();
  const material = new MeshStandardMaterial({ color: 0xffffff, roughness: .96 });
  const palette = ['#a6a394', '#919c9c', '#b7ad98', '#8f9490'].map(c => new Color(c));
  for (let variant = 0; variant < 3; variant++) {
    const subset = sites.filter((_, i) => i % 3 === variant);
    const mesh = new InstancedMesh(roundedStoneGeometry(variant), material, subset.length);
    mesh.name = `RoundedSteppingStones_${variant}`;
    subset.forEach((p, i) => {
      const normal = new Vector3(
        terrainHeight(p.x - .08, p.z) - terrainHeight(p.x + .08, p.z), .16,
        terrainHeight(p.x, p.z - .08) - terrainHeight(p.x, p.z + .08)).normalize();
      const up = new Vector3(0, 1, 0);
      const rotation = new Quaternion().setFromUnitVectors(up, normal)
        .multiply(new Quaternion().setFromAxisAngle(up, p.yaw));
      const matrix = new Matrix4().compose(new Vector3(p.x, terrainHeight(p.x, p.z) + .002, p.z),
        rotation, new Vector3(p.width / 2, p.height, p.depth / 2));
      mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, palette[i % palette.length]);
    });
    mesh.receiveShadow = true; mesh.userData.collidable = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); group.add(mesh);
  }
 group.userData.stoneCount = sites.length; garden.add(group); return group;
}
