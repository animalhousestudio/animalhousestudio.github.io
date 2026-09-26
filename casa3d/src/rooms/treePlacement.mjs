import { Box3, Matrix4, Vector3 } from 'three';
import { terrainHeight, noise, craters } from './terrainDetail.mjs';
import { naturalRockPlacements, isRockFootprintClear } from './rockLayout.mjs';
import { GARDEN } from './landscapeLayout.mjs';

export function createTreeTemplates(scene) {
  scene.updateMatrixWorld(true);
  return ['Green', 'Gold', 'Red'].map(variant => {
    const nodes = ['Branches', 'Leaves'].map(part => scene.getObjectByName(`Tree_${variant}_${part}`));
    if (nodes.some(node => !node?.isMesh)) throw new Error(`Missing tree parts: ${variant}`);
    const worldBounds = nodes.map(node => new Box3().setFromObject(node));
    const bounds = worldBounds[0].clone().union(worldBounds[1]);
    const base = worldBounds[0].min.y, height = bounds.max.y - base;
    // Use the trunk foot as the pivot. A low leaf must not make the roots float.
    const root = new Box3(), point = new Vector3();
    const positions = nodes[0].geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(nodes[0].matrixWorld);
      if (point.y <= base + height * .005) root.expandByPoint(point);
    }
    const center = root.getCenter(new Vector3()); center.y = base;
    const parts = nodes.map((node, i) => {
      const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
      geometry.translate(-center.x, -center.y, -center.z).scale(1 / height, 1 / height, 1 / height);
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      return { name: i ? 'Leaves' : 'Branches', geometry, material: node.material };
    });
    const normalizedBounds = parts.reduce((box, part) => box.union(part.geometry.boundingBox), new Box3());
    return { variant, parts, bounds: normalizedBounds };
  });
}

export function selectTreePlacements(templates, pitch) {
  const placements = [];
  for (let i = 0; i < 360 && placements.length < 6; i++) {
    const template = templates[placements.length % templates.length];
    const angle = noise(i, 71) * Math.PI * 2, radius = 26 + noise(i, 72) * 8;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const height = (template.variant === 'Green' ? 5.8 : 8) + noise(i, 73) * 2.2;
    const yaw = noise(i, 74) * Math.PI * 2;
    const matrix = new Matrix4().makeRotationY(yaw).scale(new Vector3(height, height, height));
    matrix.setPosition(x, terrainHeight(x, z) - .10, z);
    const bounds = template.bounds.clone().applyMatrix4(matrix);
    const footprint = { minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z };
    if (!isRockFootprintClear(footprint, pitch)) continue;
    if (craters.some(c => Math.hypot(x - c.x, z - c.z) < c.radius * 1.05)) continue;
    // Canopies may shade stones; the actual roots keep clear of boulders.
    if (naturalRockPlacements.some(r => Math.hypot(x - r.x, z - r.z) < r.size * .7 + 1.0)) continue;
    const canopyRadius = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2;
    if (placements.some(p => Math.hypot(x - p.x, z - p.z) < Math.max(7, canopyRadius + p.canopyRadius + .8))) continue;
    placements.push({ variant: template.variant, template, matrix, bounds, x, z, height, yaw, canopyRadius });
  }
  // A grove around the central pond reserve, plus the six sparse outer trees.
  for (let i = 0; i < 700 && placements.length < 12; i++) {
    const template = templates[(placements.length - 6) % templates.length];
    const angle = noise(i, 81) * Math.PI * 2, radius = .43 + noise(i, 82) * .34;
    const x = GARDEN.x + Math.cos(angle) * GARDEN.rx * radius;
    const z = GARDEN.z + Math.sin(angle) * GARDEN.rz * radius;
    const height = (template.variant === 'Green' ? 4.7 : 6) + noise(i, 83) * 1.8;
    const yaw = noise(i, 84) * Math.PI * 2;
    const matrix = new Matrix4().makeRotationY(yaw).scale(new Vector3(height, height, height));
    matrix.setPosition(x, terrainHeight(x, z) - .10, z);
    const bounds = template.bounds.clone().applyMatrix4(matrix);
    if (!isRockFootprintClear({ minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z }, pitch)) continue;
    if (naturalRockPlacements.some(r => Math.hypot(x - r.x, z - r.z) < r.size * .7 + 1)) continue;
    if (craters.some(c => Math.hypot(x - c.x, z - c.z) < c.radius * 1.05)) continue;
    if (Math.hypot(x + 14.35, z + 1.67) < 4) continue;
    const canopyRadius = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2;
    if (placements.some(p => Math.hypot(x - p.x, z - p.z) < Math.max(3.5, (canopyRadius + p.canopyRadius) * .7))) continue;
    placements.push({ variant: template.variant, template, matrix, bounds, x, z, height, yaw, canopyRadius, zone: 'garden' });
  }
  return placements;
}
