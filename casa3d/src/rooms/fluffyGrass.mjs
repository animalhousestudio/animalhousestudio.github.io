/*! FluffyGrass adaptation: Copyright (c) 2023 Ebenezer, MIT.
 * https://github.com/thebenezer/FluffyGrass — license bundled with the assets.
 * Reuses its tuft meshes and alpha mask; shading integrates with our lighting,
 * spatial colour patches, rooted wind and cell-based distance detail.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { partitionInstances } from './optimize.mjs';
import { grassSites } from './grassPlacement.mjs';
import grassUrl from '../assets/fluffy-grass/grassLODs.glb?url';
import maskUrl from '../assets/fluffy-grass/grass.jpeg?url';
import license from '../assets/fluffy-grass/LICENSE?raw';

export async function addFluffyGrass(garden, isClearArea) {
  const [{ scene }, mask] = await Promise.all([
    new GLTFLoader().loadAsync(grassUrl), new THREE.TextureLoader().loadAsync(maskUrl),
  ]);
  // The original FluffyGrass shader flips the model UV vertically.
  mask.flipY = false; mask.anisotropy = 4;
  const windTime = { value: 0 };
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1,
    alphaMap: mask, alphaTest: .45, side: THREE.DoubleSide });
  material.name = 'FluffyGrass_GreenAndCosmic';
  material.onBeforeCompile = shader => {
    shader.uniforms.uMeadowTime = windTime;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      uniform float uMeadowTime;
      varying float vMeadowHeight;
      varying vec2 vMeadowSite;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vMeadowHeight = clamp(position.y / .15, 0.0, 1.0);
      vMeadowSite = instanceMatrix[3].xz;
      float phase = dot(vMeadowSite, vec2(.37, .53)) + uMeadowTime * 1.65;
      float gust = sin(phase) + .35 * sin(phase * 2.17 + uMeadowTime * .4);
      transformed.x += gust * .026 * vMeadowHeight * vMeadowHeight;
      transformed.z += cos(phase * .83) * .015 * vMeadowHeight * vMeadowHeight;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying float vMeadowHeight;
      varying vec2 vMeadowSite;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float meadowPatch = sin(vMeadowSite.x * .71 + sin(vMeadowSite.y * .47) * 1.8)
        * cos(vMeadowSite.y * .62 - vMeadowSite.x * .13);
      float cosmic = smoothstep(.24, .61, meadowPatch);
      float hue = .5 + .5 * sin(vMeadowSite.x * .48 + vMeadowSite.y * .57);
      vec3 greenTip = mix(vec3(.12, .32, .08), vec3(.38, .59, .20), hue);
      vec3 cosmicTip = mix(vec3(.055, .58, .55), vec3(.58, .12, .51), hue);
      vec3 rootColor = mix(vec3(.026, .075, .022), vec3(.035, .055, .10), cosmic);
      diffuseColor.rgb *= mix(rootColor, mix(greenTip, cosmicTip, cosmic), sqrt(vMeadowHeight));`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      normal = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));`);
  };
  material.customProgramCacheKey = () => 'fluffy-meadow-v1';
  const prepare = name => {
    const geometry = scene.getObjectByName(name).geometry.clone(); geometry.computeBoundingBox();
    geometry.translate(0, -geometry.boundingBox.min.y, 0);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
  };
  const nearGeometry = prepare('GrassLOD01'), farGeometry = prepare('GrassLOD02');
  // Far cards have a different authored height: normalize to keep a quiet switch.
  farGeometry.scale(1, nearGeometry.boundingBox.max.y / farGeometry.boundingBox.max.y, 1);
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.hardwareConcurrency <= 4;
  const sites = grassSites(mobile ? 9500 : 26000, isClearArea);
  const source = new THREE.InstancedMesh(nearGeometry, material, sites.length);
  const matrix = new THREE.Matrix4();
  sites.forEach((p, i) => {
    matrix.makeRotationY(p.yaw).scale(new THREE.Vector3(p.width, p.height, p.width)).setPosition(p.x, p.y, p.z);
    source.setMatrixAt(i, matrix);
  });
  const cells = partitionInstances(source, 8); cells.name = 'FluffyMeadow';
  cells.userData.collisionDisabled = true; cells.userData.license = license;
  for (const cell of cells.children) {
    cell.receiveShadow = true;
    // Bounds include wind displacement and the wider far silhouette.
    cell.boundingSphere.radius += .15;
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  garden.userData.animateGrass = seconds => { windTime.value = reducedMotion ? 0 : seconds; };
  garden.userData.updateGrassDetail = (x, y, z) => {
    for (const cell of cells.children) {
      const c = cell.boundingSphere.center, distance = Math.hypot(c.x - x, c.y - y, c.z - z);
      cell.geometry = distance < 13 ? nearGeometry : farGeometry;
      cell.count = Math.max(1, Math.round(cell.userData.fullCount * (1 - .92 * THREE.MathUtils.smoothstep(distance, 12, 37))));
    }
  };
  const sourceGeometries = new Set(); scene.traverse(n => { if (n.isMesh) sourceGeometries.add(n.geometry); });
  sourceGeometries.forEach(g => g.dispose());
  garden.add(cells); return cells;
}
