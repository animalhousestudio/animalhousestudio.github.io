import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';
import { getPondOutline } from './pondLayout.mjs';

function finishGeometry(positions, indices, colors) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  if (colors) geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export function createPondBasinGeometry(layout) {
  const outline = getPondOutline(layout), sides = outline.length;
  const profile = layout.profile.slice(1).reverse();
  const positions = [], colors = [], indices = [];
  const shallow = new Color('#71704d'), dry = new Color('#786448'), deep = new Color('#283b38'), color = new Color();
  for (const [radius, y] of profile) {
    for (let i = 0; i < sides; i++) {
      const [x, z] = outline[i], height = layout.ringHeightAt(radius, i);
      color.copy(deep).lerp(shallow, Math.max(0, (height - layout.bottomY) / layout.excavationDepth));
      color.lerp(dry, Math.max(0, Math.min(1, (height - layout.waterY + .04) / .1)));
      const variation = 1 + .065 * Math.sin(i * 1.9 + radius * 12) + .035 * Math.cos(i * .7);
      positions.push(layout.x + (x - layout.x) * radius, height, layout.z + (z - layout.z) * radius);
      colors.push(color.r * variation, color.g * variation, color.b * variation);
    }
  }
  for (let ring = 0; ring < profile.length - 1; ring++) for (let i = 0; i < sides; i++) {
    const a = ring * sides + i, b = ring * sides + (i + 1) % sides, c = a + sides, d = b + sides;
    // Faces point into the water volume and upward, visible from the shore.
    indices.push(a, c, b, b, c, d);
  }
  const centre = positions.length / 3, start = (profile.length - 1) * sides;
  positions.push(layout.x, layout.bottomY, layout.z); colors.push(deep.r, deep.g, deep.b);
  for (let i = 0; i < sides; i++) indices.push(start + i, centre, start + (i + 1) % sides);
  return finishGeometry(positions, indices, colors);
}

export function createPondBasin(layout) {
  const group = new Group(); group.name = 'GardenPondBasin';
  const basin = new Mesh(createPondBasinGeometry(layout), new MeshStandardMaterial({ vertexColors: true, roughness: .96 }));
  basin.name = 'Pond_ClosedBasin';
  // The analytic floor query also handles the gently sloping bank: walking
  // and swimming share it without adding hundreds of collision triangles.
  basin.userData.collisionDisabled = true;
  basin.receiveShadow = false; basin.castShadow = false;
  group.add(basin);
  group.userData.layout = layout;
  group.userData.explorationEnabled = true;
  group.userData.triangleCount = basin.geometry.index.count / 3;
  group.userData.dispose = () => {
    basin.geometry.dispose(); basin.material.dispose();
  };
  return group;
}
