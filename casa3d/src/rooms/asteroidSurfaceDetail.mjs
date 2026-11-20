import {
  DataTexture, Group, MathUtils, Matrix4, RepeatWrapping, TextureLoader, Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeVisualObject, queueVisualLoad } from '../world/visualLod.mjs';
import { WORLD_SCALE } from './layout.mjs';
import { terrainSculptOffset } from './terrainDetail.mjs';
import sectors from '../assets/terrain-detail/sectors.json';

const files = import.meta.glob('../assets/terrain-detail/*.glb',{query:'?url',import:'default'});
const MAX_CELLS = 3;
const RELEASE_AFTER = 10;
const RANGE = 3.8;
const TILE_SIZE = 8.5 / WORLD_SCALE;

function configureTexture(texture) {
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.setScalar(104 / TILE_SIZE);
  texture.anisotropy = 4;
  return texture;
}

function fitPebblesToTerrain(sector) {
  // The GLBs were baked against the original relief. Deform once before mounting
  // the sector so partly buried rocks keep their contact with the new surface.
  sector.updateMatrixWorld(true);
  const point = new Vector3(), worldToMesh = new Matrix4();
  sector.traverse(mesh => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.getAttribute('position');
    worldToMesh.copy(mesh.matrixWorld).invert();
    let changed = false;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      const offset = terrainSculptOffset(point.x, point.z);
      if (offset === 0) continue;
      point.y += offset;
      point.applyMatrix4(worldToMesh);
      positions.setXYZ(i, point.x, point.y, point.z);
      changed = true;
    }
    if (!changed) return;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  });
}

export function addAsteroidSurfaceDetail(asteroid) {
  const root = new Group();
  root.name = 'AsteroidGroundDetail';
  root.userData.collisionDisabled = true;
  root.userData.streamingBoundary = true;
  asteroid.model.add(root);

  const material = asteroid.surface.material;
  const fallback = configureTexture(new DataTexture(new Uint8Array([128,128,128,255]),1,1));
  fallback.needsUpdate = true;
  // Retain Three's UV transform and sampler. RGB contains planar slopes and tone.
  material.bumpMap = fallback;
  const detailWeight = { value: 0 };
  material.onBeforeCompile = shader => {
    shader.uniforms.groundDetailWeight = detailWeight;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <bumpmap_pars_fragment>', `
        uniform sampler2D bumpMap;
        uniform float groundDetailWeight;
      `)
      .replace('#include <map_fragment>',`
        #include <map_fragment>
        float groundClose = 0.0;
        vec3 regolith = vec3(.5);
        if (groundDetailWeight > 0.0) {
          float distance2 = dot(vViewPosition,vViewPosition);
          groundClose = groundDetailWeight * (1.0 - smoothstep(144.0,1444.0,distance2));
          if (groundClose > .002) {
            regolith = texture2D(bumpMap,vBumpMapUv).rgb;
            vec2 driftUv = mat2(.191,.107,-.107,.191) * vBumpMapUv + .37;
            float drift = texture2D(bumpMap,driftUv,2.0).b;
            float shade = clamp(.16 + 1.55*regolith.b + .88*(drift-.5),.25,1.65);
            vec3 mineral = vec3(1.38,1.12,.79) * shade;
            diffuseColor.rgb *= mix(vec3(1.0),mineral,groundClose);
          }
        }
      `)
      .replace('#include <roughnessmap_fragment>',`
        #include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor,.94-.09*regolith.b,groundClose);
      `)
      .replace('#include <normal_fragment_maps>',`
        if (groundClose > .002) {
          vec2 slope = (regolith.rg * (255.0 / 128.0) - 1.0) * (1.2 * groundClose);
          vec3 tilt = mat3(viewMatrix) * vec3(slope.x,0.0,slope.y);
          normal = normalize(normal + tilt - normal * dot(normal,tilt));
        }
      `);
  };
  material.customProgramCacheKey = ()=>'asteroid-regolith-detail';
  material.needsUpdate = true;

  const loader = new GLTFLoader(), textureLoader = new TextureLoader();
  const cache = new Map(), retry = new Map();
  let wanted = new Set(), texture = null, texturePending = false, textureRetry = 0;
  let now = 0, nextUpdate = 0, closeUntil = 0, close = false, disposed = false;
  function evict(id, entry) {
    disposeVisualObject(entry.node);
    cache.delete(id);
  }
  function requestCell(id) {
    const entry = {node:null,lastSeen:now};
    cache.set(id,entry);
    queueVisualLoad(async () => {
      if (disposed || !wanted.has(id)) return null;
      const url = await files[`../assets/terrain-detail/${id}.glb`]();
      if (disposed || !wanted.has(id)) return null;
      return (await loader.loadAsync(url)).scene;
    }).then(node=>{
      if (!node || disposed || !wanted.has(id)) {
        disposeVisualObject(node);
        cache.delete(id);
        return;
      }
      node.name = id;
      fitPebblesToTerrain(node);
      root.add(node);
      entry.node = node;
    }).catch(()=>{
      retry.set(id,now+15);
      cache.delete(id);
    });
  }
  function requestTexture() {
    texturePending = true;
    queueVisualLoad(async ()=>{
      if (!close || disposed) return null;
      const {default:url} = await import('../assets/terrain-detail/regolith-detail.png?url');
      return close&&!disposed ? textureLoader.loadAsync(url) : null;
    }).then(map=>{
      if (!map) return;
      if (disposed || !close) { map.dispose(); return; }
      texture = configureTexture(map);
      material.bumpMap = texture;
    }).catch(()=>{ textureRetry = now+15; }).finally(()=>{ texturePending = false; });
  }
  function releaseTexture() {
    if (!texture) return;
    material.bumpMap = fallback;
    texture.dispose();
    texture = null;
  }
  return {
    update(seconds,camera,{enabled,ground}) {
      if (disposed) return;
      now = seconds;
      const altitude = ground === null ? Infinity : camera.position.y - ground * WORLD_SCALE;
      close = Boolean(enabled && altitude < 15);
      detailWeight.value = close && texture ? 1 - MathUtils.smoothstep(altitude, 13, 15) : 0;
      root.visible = close;
      if (close) closeUntil = seconds+RELEASE_AFTER;
      if (seconds<nextUpdate) return;
      nextUpdate = seconds+.23;
      const x = camera.position.x/WORLD_SCALE, z = camera.position.z/WORLD_SCALE;
      wanted = new Set(close ? sectors.map(cell=>{
        const dx = Math.max(cell.minX-x,0,x-cell.minX-cell.size);
        const dz = Math.max(cell.minZ-z,0,z-cell.minZ-cell.size);
        return {id:cell.id,distance:Math.hypot(dx,dz)};
      }).filter(cell=>cell.distance<=(cache.get(cell.id)?.node ? RANGE+1.5 : RANGE))
        .sort((a,b)=>a.distance-b.distance).slice(0,MAX_CELLS).map(cell=>cell.id) : []);
      for (const [id,entry] of cache) {
        if (wanted.has(id)) entry.lastSeen = seconds;
        if (!entry.node) continue;
        entry.node.visible = wanted.has(id);
        if (!entry.node.visible && seconds-entry.lastSeen>=RELEASE_AFTER) evict(id,entry);
      }
      for (const id of wanted) {
        if (cache.has(id) || seconds<(retry.get(id)??0)) continue;
        if (cache.size>=MAX_CELLS) {
          const spare = [...cache].find(([key,entry])=>entry.node && !wanted.has(key));
          if (!spare) break;
          evict(...spare);
        }
        requestCell(id);
      }
      if (close && !texture && !texturePending && seconds>=textureRetry) requestTexture();
      if (!close && seconds>=closeUntil) releaseTexture();
    },
    get state() {
      return {texture:Boolean(texture),cells:[...cache].filter(([,entry])=>entry.node).map(([id])=>id),
        visible:root.visible};
    },
    dispose() {
      disposed = true;
      for (const [id,entry] of cache) if (entry.node) evict(id,entry);
      root.removeFromParent();
      releaseTexture();
      material.bumpMap = null;
      fallback.dispose();
    },
  };
}
