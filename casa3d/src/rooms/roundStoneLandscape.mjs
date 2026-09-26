import { BufferGeometry, Float32BufferAttribute, Group, InstancedMesh, MeshStandardMaterial, Matrix4, Vector3, Quaternion, Color, Mesh } from 'three';
import { GARDEN, POND_RESERVE, paths, PATH_WIDTH } from './landscapeLayout.mjs';
import { terrainHeight, noise } from './terrainDetail.mjs';

export function roundedStoneGeometry(variant = 0) {
  // Twelve sides keep the rounded tread while saving 16 triangles per stone.
  const positions = [], indices = [], sides = 12;
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
    const count = Math.ceil(curve.getLength() / .19);
    for (let i = 0; i <= count; i++) {
      const p = curve.getPointAt(i / count), tangent = curve.getTangentAt(i / count);
      // Do not stack the branch's first stone on top of the main walk.
      if (route && i < 2) continue;
      const seed = i + route * 1000;
      placements.push({ x: p.x + (noise(seed, 1) - .5) * .025, z: p.z,
        yaw: Math.atan2(tangent.x, tangent.z), width: PATH_WIDTH * (.83 + noise(seed, 2) * .13),
        depth: .17 + noise(seed, 3) * .025, height: .045, kind: 'path' });
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
  // A conforming, walkable patch of earth marks the future pond. No water yet.
  const positions = [POND_RESERVE.x, terrainHeight(POND_RESERVE.x, POND_RESERVE.z) + .006, POND_RESERVE.z];
  const indices = [], rings = 8, sides = 64;
  // One center vertex replaces the collapsed inner ring and its 64 zero-area faces.
  for (let ring = 1; ring <= rings; ring++) for (let i = 0; i < sides; i++) {
    const a = i / sides * Math.PI * 2, r = ring / rings;
    const x = POND_RESERVE.x + Math.cos(a) * POND_RESERVE.rx * r;
    const z = POND_RESERVE.z + Math.sin(a) * POND_RESERVE.rz * r;
    positions.push(x, terrainHeight(x, z) + .006, z);
  }
  for (let i = 0; i < sides; i++) indices.push(0, 1 + (i + 1) % sides, 1 + i);
  for (let ring = 0; ring < rings - 1; ring++) for (let i = 0; i < sides; i++) {
    const a = 1 + ring * sides + i, b = 1 + ring * sides + (i + 1) % sides;
    indices.push(a, b, a + sides, b, b + sides, a + sides);
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const reserve = new Mesh(geometry, new MeshStandardMaterial({ color: '#685747', roughness: 1 }));
  reserve.name = 'FuturePond_ReservedEarth'; reserve.receiveShadow = true; reserve.userData.collisionDisabled = true;
  group.add(reserve); group.userData.stoneCount = sites.length; garden.add(group); return group;
}
