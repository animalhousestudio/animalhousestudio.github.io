import { Frustum, Group, Matrix4, Sphere, Vector3 } from 'three';

/** A queue shared by independent props, including their first resident tier. */
export function createLodLoader({ concurrency = 2 } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new RangeError('LOD concurrency must be a positive integer');
  const queue = [], state = { active: 0, pending: 0 };
  function drain() {
    while (state.active < concurrency && queue.length) {
      const { task, resolve, reject } = queue.shift();
      state.pending = queue.length;
      state.active++;
      Promise.resolve().then(task).then(resolve, reject).finally(() => {
        state.active--;
        drain();
      });
    }
  }
  return {
    state,
    run(task) {
      return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        state.pending = queue.length;
        drain();
      });
    },
  };
}

const sharedLoader = createLodLoader();
// A tier may share material/geometry/texture objects with the resident tier or
// with another controller. Release only after the final adopted tier lets go.
const resourceOwners = new WeakMap();
function resourcesOf(root) {
  const resources = new Set(), inspected = new Set();
  function textures(value) {
    if (!value || typeof value !== 'object' || inspected.has(value)) return;
    inspected.add(value);
    if (value.isTexture) resources.add(value);
    else if (Array.isArray(value)) value.forEach(textures);
    else if (value.constructor === Object) Object.values(value).forEach(textures);
  }
  root.traverse(node => {
    if (node.geometry) resources.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!material) continue;
      resources.add(material);
      Object.values(material).forEach(textures);
    }
    // InstancedMesh owns an instance buffer in addition to shared geometry.
    if (node.isInstancedMesh) resources.add(node);
    if (node.skeleton) resources.add(node.skeleton);
  });
  return resources;
}
function retain(root) {
  const resources = resourcesOf(root);
  for (const resource of resources) resourceOwners.set(resource, (resourceOwners.get(resource) ?? 0) + 1);
  return resources;
}
function release(resources) {
  for (const resource of resources) {
    const owners = (resourceOwners.get(resource) ?? 1) - 1;
    if (owners > 0) resourceOwners.set(resource, owners);
    else {
      resourceOwners.delete(resource);
      resource.dispose?.();
      // Do not call ImageBitmap.close() here: GLTFLoader/THREE.Cache can share
      // decoded images with textures not yet adopted by a controller. GPU
      // texture ownership does not imply exclusive ownership of its source.
    }
  }
}

/** Release a loaded visual that failed preparation before controller adoption. */
export function disposeVisualObject(root) {
  if (!root?.isObject3D) return;
  root.removeFromParent();
  // Temporarily retain it so resources shared with any adopted tier survive.
  release(retain(root));
}

/**
 * Levels are coarse-to-fine { id, minPixels, load: () => Promise<Object3D> }.
 * Bounds are fixed in root-local space, independently of the loaded visuals.
 * Loaders transfer visual ownership; collision siblings stay outside this group.
 * update uses monotonically increasing seconds (the same clock as animation).
 */
export function createVisualLod({ root, bounds, levels, hysteresis = .15,
  unloadAfter = 20, retryDelay = 15, maxRetries = 1, loader = sharedLoader } = {}) {
  if (!root?.isObject3D || !(bounds instanceof Sphere) || !Number.isFinite(bounds.radius) || bounds.radius <= 0
    || !bounds.center.toArray().every(Number.isFinite)) throw new TypeError('LOD needs a root and finite local sphere');
  if (!Array.isArray(levels) || !levels.length || levels[0].minPixels !== 0
    || levels.some((level, index) => !level.id || typeof level.load !== 'function'
      || !Number.isFinite(level.minPixels) || level.minPixels < 0
      || (index > 0 && level.minPixels <= levels[index - 1].minPixels))
    || new Set(levels.map(level => level.id)).size !== levels.length) {
    throw new TypeError('LOD levels need unique ids, loaders, and increasing minPixels starting at zero');
  }
  if (!(hysteresis >= 0 && hysteresis < 1) || !Number.isFinite(unloadAfter) || unloadAfter < 0
    || !Number.isFinite(retryDelay) || retryDelay < 0 || !Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new RangeError('Invalid LOD hysteresis, timeout, or retry limit');
  }
  const localBounds = bounds.clone(), worldBounds = new Sphere(), frustum = new Frustum();
  const inverseCamera = new Matrix4(), viewProjection = new Matrix4(), viewCenter = new Vector3();
  const visuals = new Group();
  visuals.name = `${root.name || 'Object'}_VisualLOD`;
  visuals.userData.streamingBoundary = true;
  visuals.userData.collisionDisabled = true;
  root.userData.streamingBoundary = true;
  root.add(visuals);
  const entries = levels.map(level => ({ ...level, node: null, resources: null, promise: null,
    status: 'idle', attempts: 0, nextRetryAt: 0, error: null }));
  const state = { activeLevel: null, targetLevel: entries[0].id, projectedPixels: 0,
    inFrustum: false, disposed: false, levels: entries };
  let now = 0, targetIndex = 0, farSince = 0, eligible = false;

  function selectVisible() {
    let selected = 0;
    for (let index = 1; index <= targetIndex; index++) if (entries[index].node) selected = index;
    entries.forEach((entry, index) => { if (entry.node) entry.node.visible = index === selected; });
    state.activeLevel = entries[selected].node ? entries[selected].id : null;
  }
  function evictUnused() {
    if (targetIndex !== 0 || farSince === null || now - farSince < unloadAfter) return;
    for (const entry of entries.slice(1)) {
      if (!entry.node) continue;
      entry.node.removeFromParent();
      release(entry.resources);
      entry.node = null; entry.resources = null;
      entry.status = 'idle'; entry.attempts = 0; entry.error = null;
    }
  }
  function canRequest(entry) {
    return !entry.node && !entry.promise && entry.attempts <= maxRetries && now >= entry.nextRetryAt;
  }
  function pump() {
    if (state.disposed || !eligible || !entries[0].node || targetIndex === 0) return;
    // One request per prop: approaching quickly still reveals intermediate detail
    // while a finer tier is pending. Independent props share the global queue.
    if (entries.some(entry => entry.promise)) return;
    for (let index = 1; index <= targetIndex; index++) {
      if (canRequest(entries[index])) {
        request(index).catch(() => {});
        break;
      }
    }
  }
  function request(index) {
    const entry = entries[index];
    if (entry.promise) return entry.promise;
    entry.status = 'queued';
    entry.promise = loader.run(async () => {
      // A queued optional request can become irrelevant before a slot is free.
      if (state.disposed || (index > 0 && (!eligible || index > targetIndex))) return null;
      entry.status = 'loading'; entry.attempts++;
      const node = await entry.load();
      if (!node?.isObject3D) throw new TypeError(`LOD loader ${entry.id} did not return an Object3D`);
      const resources = retain(node);
      if (state.disposed) {
        node.removeFromParent(); release(resources);
        return null;
      }
      node.visible = false;
      entry.node = node; entry.resources = resources;
      visuals.add(node);
      entry.status = 'loaded'; entry.error = null;
      selectVisible(); evictUnused();
      return node;
    }).catch(error => {
      entry.status = state.disposed ? 'disposed' : 'failed'; entry.error = error;
      entry.nextRetryAt = now + retryDelay;
      throw error;
    }).finally(() => {
      entry.promise = null;
      if (entry.status === 'queued' || entry.status === 'loading') entry.status = 'idle';
      pump();
    });
    return entry.promise;
  }

  const ready = request(0);
  // The public promise still rejects for boot handling; avoid an unhandled
  // rejection if the caller wires its boot dependencies later in the same turn.
  ready.catch(() => {});
  return {
    ready, state,
    get object() { return entries.find(entry => entry.id === state.activeLevel)?.node ?? null; },
    update(seconds, camera, viewportHeight, { enabled = true } = {}) {
      if (state.disposed) return;
      if (Number.isFinite(seconds)) now = Math.max(now, seconds);
      let shown = enabled && Number.isFinite(viewportHeight) && viewportHeight > 0
        && (camera?.isPerspectiveCamera || camera?.isOrthographicCamera);
      for (let ancestor = root; shown && ancestor; ancestor = ancestor.parent) shown = ancestor.visible;
      state.inFrustum = false; state.projectedPixels = 0;
      if (shown) {
        root.updateWorldMatrix(true, false);
        camera.updateWorldMatrix(true, false);
        worldBounds.copy(localBounds).applyMatrix4(root.matrixWorld);
        inverseCamera.copy(camera.matrixWorld).invert();
        viewProjection.multiplyMatrices(camera.projectionMatrix, inverseCamera);
        frustum.setFromProjectionMatrix(viewProjection);
        state.inFrustum = frustum.intersectsSphere(worldBounds);
        if (state.inFrustum) {
          viewCenter.copy(worldBounds.center).applyMatrix4(inverseCamera);
          const depth = -viewCenter.z;
          state.projectedPixels = camera.isPerspectiveCamera
            ? (depth <= worldBounds.radius ? Infinity : worldBounds.radius * viewportHeight * camera.projectionMatrix.elements[5] / depth)
            : worldBounds.radius * viewportHeight * camera.projectionMatrix.elements[5];
        }
      }
      eligible = Boolean(shown && state.inFrustum);
      if (!eligible) targetIndex = 0;
      else {
        const pixels = state.projectedPixels;
        while (targetIndex + 1 < entries.length && pixels >= entries[targetIndex + 1].minPixels * (1 + hysteresis)) targetIndex++;
        while (targetIndex > 0 && pixels < entries[targetIndex].minPixels * (1 - hysteresis)) targetIndex--;
      }
      state.targetLevel = entries[targetIndex].id;
      if (targetIndex > 0) farSince = null;
      else if (farSince === null) farSince = now;
      selectVisible(); evictUnused(); pump();
    },
    dispose() {
      if (state.disposed) return;
      state.disposed = true; eligible = false;
      for (const entry of entries) {
        if (entry.node) { entry.node.removeFromParent(); release(entry.resources); }
        entry.node = null; entry.resources = null; entry.status = 'disposed';
      }
      visuals.removeFromParent(); state.activeLevel = null;
    },
  };
}
