import { EYE_HEIGHT, WORLD_SCALE } from './layout.mjs';
import { ENTRY_STEPS } from './entry.mjs';
import { Group } from 'three';

// Parent is the mansion in model units; the panel and lens are human-sized.
export const INTERCOM_PLACEMENT = Object.freeze({ x: .08, y: ENTRY_STEPS.top, z: 6.7 });
export const INTERCOM_LENS_HEIGHT = EYE_HEIGHT;
export const INTERCOM_SCREEN_HEIGHT = 1.68;
export const INTERCOM_PANEL_SCALE = 1.5;
export const INTERCOM_PANEL_CENTER_HEIGHT = 2.15;
export const INTERCOM_REACH = 3;
export const INTERCOM_CALL_SECONDS = 2;
export function placeIntercom(root) {
  root.position.set(INTERCOM_PLACEMENT.x, INTERCOM_PLACEMENT.y, INTERCOM_PLACEMENT.z);
  root.scale.setScalar(1 / WORLD_SCALE);
  return root;
}

export function createIntercomAssembly() {
  const assembly = new Group(); assembly.name = 'Intercom_PanelAssembly';
  assembly.scale.setScalar(INTERCOM_PANEL_SCALE);
  assembly.position.y = INTERCOM_PANEL_CENTER_HEIGHT - 1.61 * INTERCOM_PANEL_SCALE;
  return assembly;
}

export function aimIntercomCamera(camera, lensPosition, viewerEye) {
  camera.position.copy(lensPosition);
  camera.lookAt(viewerEye);
  camera.updateMatrixWorld(true);
}

export function createIntercomCall({ getTarget, isBlocked, hasLineOfSight = () => true, onStart = () => {}, onOpen = () => {}, onFinish = () => {} }) {
  let phase = 'idle', startedAt = null;
  return {
    get phase() { return phase; },
    get startedAt() { return startedAt; },
    available(eye) {
      if (phase === 'calling' || isBlocked()) return false;
      const target = getTarget();
      return Boolean(target && eye.z >= target.z - .15 && eye.distanceTo(target) <= INTERCOM_REACH && hasLineOfSight(eye, target));
    },
    ring(eye, now) {
      if (!Number.isFinite(now) || !this.available(eye)) return false;
      phase = 'calling'; startedAt = now; onStart(); return true;
    },
    update(now) {
      if (phase !== 'calling' || !Number.isFinite(now) || now - startedAt < INTERCOM_CALL_SECONDS) return false;
      phase = 'idle'; startedAt = null;
      onOpen(); onFinish(); return true;
    },
  };
}
