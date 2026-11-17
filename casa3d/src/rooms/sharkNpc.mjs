import { AnimationMixer, Frustum, Group, MathUtils, Matrix4, Sphere, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STATIC_ASSETS } from '../world/assetCatalog.mjs';
import { disposeVisualObject } from '../world/visualLod.mjs';
import { WORLD_SCALE } from './layout.mjs';
import { createSharkRoute, SHARK_SCALE } from './sharkRoute.mjs';

export function addSharkNpc(garden, coaster) {
  const route = createSharkRoute(coaster.ponds.map(pond => pond.layout));
  const root = new Group();
  root.name = 'PondShark';
  root.scale.setScalar(1 / WORLD_SCALE);
  root.userData.streamingBoundary = true;
  root.userData.collisionDisabled = true;
  root.userData.worldLocalBounds = route.bounds;
  garden.add(root);

  const pose = { position: new Vector3() };
  const sphere = new Sphere(new Vector3(), 2.5);
  const projection = new Matrix4(), frustum = new Frustum();
  let loading, actor, mixer, action;
  let disposed = false, failed = false, visible = false, time = 0, poseAge = 0, evaluations = 0;
  let forcedTime = null, showModel = true;

  function release(model) {
    model.traverse(node => { if (node.isSkinnedMesh) node.skeleton.dispose(); });
    disposeVisualObject(model);
    model.removeFromParent();
  }

  function preload() {
    if (loading) return;
    loading = new GLTFLoader().loadAsync(STATIC_ASSETS.squalo.url).then(({ scene, animations }) => {
      const swim = animations.find(clip => clip.name === 'Swim');
      if (disposed || !swim) {
        release(scene);
        failed = !disposed;
        return;
      }
      actor = scene;
      actor.scale.setScalar(SHARK_SCALE);
      actor.visible = false;
      actor.traverse(node => { if (node.isSkinnedMesh) node.frustumCulled = false; });
      mixer = new AnimationMixer(actor);
      action = mixer.clipAction(swim).play();
      action.paused = true;
    }).catch(error => {
      if (!disposed) {
        failed = true;
        console.warn('Squalo NPC unavailable', error);
      }
    });
  }

  function update(dt, camera, { enabled, underwater }) {
    if (enabled) time += dt;
    const seconds = forcedTime ?? time;
    const near = enabled && route.bounds.distanceToPoint(camera.position) < 85;
    if (near) preload();
    if (near && actor && showModel) {
      route.sample(seconds, pose);
      sphere.center.copy(pose.position);
      // Above water, only submit the model while the fin can meet the
      // displaced surface. The opaque pond mesh occludes the submerged parts.
      const eligible = underwater || pose.position.y > pose.water - 1.25;
      if (eligible && sphere.center.distanceToSquared(camera.position) < 62 ** 2) {
        camera.updateWorldMatrix(true, false);
        frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        if (frustum.intersectsSphere(sphere)) {
          const parent = underwater ? coaster.submergedScene : root;
          if (actor.parent !== parent) parent.add(actor);
          actor.position.copy(pose.position);
          actor.rotation.set(-pose.pitch, pose.yaw, 0, 'YXZ');
          poseAge += dt;
          if (!visible || poseAge >= 1 / 30) {
            action.time = MathUtils.euclideanModulo(seconds, action.getClip().duration);
            mixer.update(0);
            poseAge %= 1 / 30;
            evaluations++;
          }
          actor.visible = visible = true;
          return;
        }
      }
    }
    if (actor) actor.visible = false;
    visible = false;
  }

  return {
    route, update,
    review({ seconds = null, visible = true } = {}) {
      forcedTime = seconds;
      showModel = visible;
      poseAge = 1;
    },
    get state() {
      const seconds = forcedTime ?? time;
      route.sample(seconds, pose);
      return { ready: Boolean(actor), failed, visible, evaluations, duration: route.duration,
        position: pose.position.toArray(), surface: pose.surface,
        seconds: MathUtils.euclideanModulo(seconds, route.duration) };
    },
    dispose() {
      disposed = true;
      root.removeFromParent();
      if (!actor) return;
      mixer.stopAllAction();
      mixer.uncacheRoot(actor);
      release(actor);
    },
  };
}
