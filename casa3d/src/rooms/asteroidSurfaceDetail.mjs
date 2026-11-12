import {
  DataTexture, Group, RepeatWrapping, TextureLoader,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeVisualObject, queueVisualLoad } from '../world/visualLod.mjs';
import { WORLD_SCALE } from './layout.mjs';
import sectors from '../assets/terrain-detail/sectors.json';

const files = import.meta.glob('../assets/terrain-detail/*.glb',{query:'?url',import:'default'});
const MAX_CELLS = 3;
const RELEASE_AFTER = 10;
const RANGE = 3.8;

function configureTexture(texture) {
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.setScalar(104/2.7);
  texture.anisotropy = 4;
  return texture;
}

export function addAsteroidSurfaceDetail(asteroid) {
  const root = new Group();
  root.name = 'AsteroidGroundDetail';
  root.userData.collisionDisabled = true;
  root.userData.streamingBoundary = true;
  asteroid.model.add(root);

  const material = asteroid.surface.material;
  const fallback = configureTexture(new DataTexture(new Uint8Array([128,128,146,255]),1,1));
  fallback.needsUpdate = true;
  material.bumpMap = fallback;
  material.bumpScale = .35;
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_fragment>',`
        #include <map_fragment>
        float groundClose = 1.0-smoothstep(13.0,43.0,length(vViewPosition));
        vec3 groundDetail = vec3(.5,.5,.57);
        if (groundClose>.002) groundDetail = texture2D(bumpMap,vBumpMapUv).rgb;
        diffuseColor.rgb *= mix(1.0,.28+1.47*groundDetail.g,groundClose);
      `)
      .replace('#include <roughnessmap_fragment>',`
        #include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor,.57+.39*groundDetail.b,groundClose);
      `)
      .replace('#include <normal_fragment_maps>',`
        if (groundClose>.002) {
          normal = perturbNormalArb(-vViewPosition,normal,dHdxy_fwd()*groundClose,faceDirection);
        }
      `);
  };
  material.customProgramCacheKey = ()=>'asteroid-rock-detail-v06';
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
      const {default:url} = await import('../assets/terrain-detail/rock-micro.png?url');
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
      close = Boolean(enabled && ground!==null && camera.position.y-ground*WORLD_SCALE<15);
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
