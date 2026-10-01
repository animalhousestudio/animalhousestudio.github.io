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
  const shallow = new Color('#6a7463'), deep = new Color('#283b38'), color = new Color();
  for (const [radius, y] of profile) {
    color.copy(deep).lerp(shallow, Math.max(0, (y - layout.bottomY) / layout.excavationDepth));
    for (const [x, z] of outline) {
      positions.push(layout.x + (x - layout.x) * radius, y, layout.z + (z - layout.z) * radius);
      colors.push(color.r, color.g, color.b);
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

function createShoreGeometry(layout) {
  const outline = getPondOutline(layout), sides = outline.length;
  // A small stone parapet has physical side walls. The centre stays completely
  // open; there is no invisible walkable disk covering the future dive volume.
  const profile = [[1, -.03], [1, .14], [1.012, .16], [1.055, .16], [1.07, -.03]];
  const positions = [], indices = [];
  for (const [radius, height] of profile) for (const [x, z] of outline) {
    positions.push(layout.x + (x - layout.x) * radius, layout.shoreY + height, layout.z + (z - layout.z) * radius);
  }
  for (let ring = 0; ring < profile.length; ring++) for (let i = 0; i < sides; i++) {
    const next = (ring + 1) % profile.length;
    const a = ring * sides + i, b = ring * sides + (i + 1) % sides;
    const c = next * sides + i, d = next * sides + (i + 1) % sides;
    indices.push(a, b, c, b, d, c);
  }
  return finishGeometry(positions, indices);
}

export function createPondBasin(layout) {
  const group = new Group(); group.name = 'GardenPondBasin';
  const basin = new Mesh(createPondBasinGeometry(layout), new MeshStandardMaterial({ vertexColors: true, roughness: .96 }));
  basin.name = 'Pond_ClosedBasin';
  // Opt into these walls and floor when underwater movement is implemented.
  basin.userData.collisionDisabled = true;
  basin.receiveShadow = false; basin.castShadow = false;
  const shore = new Mesh(createShoreGeometry(layout), new MeshStandardMaterial({ color: '#858775', roughness: .98, flatShading: true }));
  shore.name = 'Pond_StoneShore'; shore.userData.collidable = true;
  shore.receiveShadow = true; shore.castShadow = false;
  group.add(basin, shore);
  group.userData.layout = layout;
  group.userData.explorationEnabled = false;
  group.userData.triangleCount = (basin.geometry.index.count + shore.geometry.index.count) / 3;
  group.userData.dispose = () => {
    basin.geometry.dispose(); basin.material.dispose(); shore.geometry.dispose(); shore.material.dispose();
  };
  return group;
}
