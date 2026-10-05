import { Box3, Frustum, Matrix4, Vector3 } from 'three';
import { WORLD_SCALE } from '../rooms/layout.mjs';
import { WORLD_ZONE_CATALOG } from './catalog.mjs';

const finiteVector = vector => Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);

/**
 * Registers existing roots without reparenting them. Content stays resident;
 * only explicitly decorative roots may be hidden. Floors, walls and walkable
 * objects use the default policy, even when their room is behind the camera.
 *
 * Register after placement and internal batching, before parent-level batching.
 * Start visibility updates only after collision capture. Refresh bounds after
 * adding content or changing transforms; the render loop never rescans meshes.
 * maxDistance and margin are world units, including the world's 5× scale.
 */
export function createWorldZones({ catalog = WORLD_ZONE_CATALOG, worldScale = WORLD_SCALE } = {}) {
  const definitions = new Map(catalog.map(zone => [zone.id, zone]));
  const entries = [], roots = new Map();
  const frustum = new Frustum(), projection = new Matrix4(), cameraPosition = new Vector3();
  const stats = { registered: 0, decorative: 0, visible: 0, culled: 0 };

  function refresh(entry) {
    entry.root.updateWorldMatrix(true, true);
    entry.bounds.setFromObject(entry.root);
    entry.validBounds = !entry.bounds.isEmpty() && finiteVector(entry.bounds.min) && finiteVector(entry.bounds.max);
    entry.paddedBounds.copy(entry.bounds).expandByScalar(entry.margin);
  }

  function restoreMetadata(entry, key) {
    if (entry.previousMetadata.has(key)) entry.root.userData[key] = entry.previousMetadata.get(key);
    else delete entry.root.userData[key];
  }

  return {
    catalog, worldScale, entries, stats,
    register(zoneId, root, { decorative = false, maxDistance = Infinity, margin = 2, contentId = null } = {}) {
      if (!definitions.has(zoneId)) throw new Error(`Unknown world zone: ${zoneId}`);
      if (!root?.isObject3D) throw new TypeError('A world zone requires an Object3D root');
      if (roots.has(root)) throw new Error(`World content already registered: ${root.name || root.uuid}`);
      if (!(maxDistance > 0) || !(Number.isFinite(maxDistance) || maxDistance === Infinity)
        || !Number.isFinite(margin) || margin < 0) throw new RangeError('Invalid world visibility distance or margin');
      const previousMetadata = new Map();
      for (const key of ['worldZone', 'streamingBoundary', 'worldContentId']) {
        if (Object.hasOwn(root.userData, key)) previousMetadata.set(key, root.userData[key]);
      }
      const entry = {
        zoneId, root, contentId, decorative: Boolean(decorative), maxDistance, margin,
        authoredVisible: root.visible, bounds: new Box3(), paddedBounds: new Box3(),
        validBounds: false, previousMetadata,
      };
      root.userData.worldZone = zoneId;
      root.userData.streamingBoundary = true;
      if (contentId !== null) root.userData.worldContentId = contentId;
      roots.set(root, entry); entries.push(entry);
      stats.registered = entries.length;
      if (entry.decorative) stats.decorative++;
      refresh(entry);
      return entry;
    },
    refreshBounds(root) {
      if (root === undefined) { for (const entry of entries) refresh(entry); return; }
      const entry = roots.get(root);
      if (!entry) throw new Error('World content is not registered');
      refresh(entry);
    },
    unregister(root) {
      const entry = roots.get(root);
      if (!entry) return false;
      if (entry.decorative) root.visible = entry.authoredVisible;
      for (const key of ['worldZone', 'streamingBoundary', 'worldContentId']) restoreMetadata(entry, key);
      roots.delete(root); entries.splice(entries.indexOf(entry), 1);
      stats.registered = entries.length;
      if (entry.decorative) stats.decorative--;
      return true;
    },
    update(camera, { enabled = true } = {}) {
      let validCamera = Boolean(enabled && camera?.isCamera);
      if (validCamera) {
        camera.updateWorldMatrix(true, false);
        cameraPosition.setFromMatrixPosition(camera.matrixWorld);
        projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        validCamera = finiteVector(cameraPosition) && projection.elements.every(Number.isFinite);
        if (validCamera) frustum.setFromProjectionMatrix(projection);
      }
      stats.visible = 0; stats.culled = 0;
      for (const entry of entries) {
        // The registry owns only the optional root's visibility, never authored
        // child visibility or another feature's structural visibility state.
        if (entry.decorative) {
          const visible = !validCamera || !entry.validBounds
            || (entry.paddedBounds.distanceToPoint(cameraPosition) <= entry.maxDistance
              && frustum.intersectsBox(entry.paddedBounds));
          entry.root.visible = entry.authoredVisible && visible;
          if (entry.authoredVisible && !visible) stats.culled++;
        }
        if (entry.root.visible) stats.visible++;
      }
      return stats;
    },
  };
}
