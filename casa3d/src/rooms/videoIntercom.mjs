import * as THREE from 'three';
import { placeIntercom, createIntercomAssembly, aimIntercomCamera, INTERCOM_LENS_HEIGHT, INTERCOM_SCREEN_HEIGHT } from './intercomLayout.mjs';
import { createIntercomPortrait } from '../player/intercomPortrait.mjs';

function label(text, width = 512, height = 128) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#10242b'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#d4dcd5'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '36px sans-serif'; ctx.fillText(text, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

export function addVideoIntercom(exterior) {
  const root = placeIntercom(new THREE.Group()); root.name = 'EntryVideoIntercom';
  root.userData.streamingBoundary = true; root.userData.interactable = true;
  root.userData.collisionDisabled = true; root.userData.roomName = 'Videocitofono';
  const assembly = createIntercomAssembly(); root.add(assembly);
  const housing = new THREE.MeshStandardMaterial({ color: 0x253139, metalness: .65, roughness: .35 });
  const bezel = new THREE.MeshStandardMaterial({ color: 0x080d11, roughness: .5 });
  const addBox = (name, w, h, d, x, y, z, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.name = name;
    mesh.position.set(x, y, z); assembly.add(mesh); return mesh;
  };
  addBox('Intercom_Housing', .52, .98, .12, 0, 1.61, 0, housing);
  addBox('Intercom_ScreenBezel', .45, .46, .026, 0, INTERCOM_SCREEN_HEIGHT, .071, bezel);
  const screenMaterial = new THREE.MeshBasicMaterial({ map: label('ANIMAL HOUSE', 512, 512), toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.40, .40), screenMaterial);
  screen.name = 'Intercom_MirroredScreen'; screen.position.set(0, INTERCOM_SCREEN_HEIGHT, .088); assembly.add(screen);
  // Horizontal mirror is deliberate; the actual avatar/hand transforms stay unchanged.
  const uv = screen.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  const lens = new THREE.Mesh(new THREE.SphereGeometry(.026, 12, 8), new THREE.MeshStandardMaterial({ color: 0x09202d, metalness: .9, roughness: .15 }));
  lens.name = 'Intercom_Lens'; lens.position.set(0, INTERCOM_LENS_HEIGHT, .073); assembly.add(lens);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.063, .009, 6, 32), new THREE.MeshBasicMaterial({ color: 0xb7d6c7 }));
  ring.position.set(0, 1.25, .077); assembly.add(ring);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(.053, .053, .026, 24), housing);
  bell.rotation.x = Math.PI / 2; bell.position.set(0, 1.25, .077); bell.name = 'Intercom_CallButton'; assembly.add(bell);
  const title = new THREE.Mesh(new THREE.PlaneGeometry(.41, .07), new THREE.MeshBasicMaterial({ map: label('SUONA'), toneMapped: false }));
  title.position.set(0, 1.40, .079); assembly.add(title);
  exterior.add(root);
  const portraitScene = new THREE.Scene();
  portraitScene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const light = new THREE.DirectionalLight(0xfff5e2, 2.3); light.position.set(-2, 4, 5); portraitScene.add(light);
  const portraitCamera = new THREE.PerspectiveCamera(38, 1, .08, 4000);
  const lensWorld = new THREE.Vector3(), screenWorld = new THREE.Vector3();
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4();
  let portrait = null, target = null, lastFrame = -Infinity, frames = 0;
  return {
    root, screen, lens, bell,
    get frames() { return frames; },
    get lensWorldPosition() { return lens.getWorldPosition(new THREE.Vector3()); },
    get target() { return screen.getWorldPosition(new THREE.Vector3()); },
    attachBody(body) {
      portrait = createIntercomPortrait(body); portraitScene.add(portrait.root);
    },
    render(renderer, camera, now, { enabled = true, renderBackground = null } = {}) {
      if (!enabled || !portrait || now - lastFrame < 1 / 12) return;
      root.updateWorldMatrix(true, true); screen.getWorldPosition(screenWorld);
      if (camera.position.distanceTo(screenWorld) > 4.5 || camera.position.z < screenWorld.z) return;
      frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      if (!frustum.intersectsSphere(new THREE.Sphere(screenWorld, .5))) return;
      lastFrame = now;
      if (!target) {
        target = new THREE.WebGLRenderTarget(256, 256, { depthBuffer: true });
        target.texture.colorSpace = THREE.SRGBColorSpace;
        screenMaterial.map.dispose(); screenMaterial.map = target.texture; screenMaterial.needsUpdate = true;
      }
      portrait.sync(); lens.getWorldPosition(lensWorld);
      aimIntercomCamera(portraitCamera, lensWorld, camera.position);
      const previousTarget = renderer.getRenderTarget(), previousAutoClear = renderer.autoClear;
      const clearColor = renderer.getClearColor(new THREE.Color()), clearAlpha = renderer.getClearAlpha();
      try {
        renderer.autoClear = false; renderer.setRenderTarget(target); renderer.clear();
        renderBackground?.(portraitCamera);
        // Same camera and depth buffer for the real setting and complete bear.
        // Both pass through the screen's horizontal mirror together.
        renderer.render(portraitScene, portraitCamera); frames++;
      } finally {
        renderer.setRenderTarget(previousTarget); renderer.autoClear = previousAutoClear; renderer.setClearColor(clearColor, clearAlpha);
      }
    },
  };
}
